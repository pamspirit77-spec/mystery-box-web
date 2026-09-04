(() => {
  'use strict';

  // Shop-only data. Currency and Inventory remain owned by the existing GameInventory API.
  const SHOP_CONFIG = [
    { id: 'shop_health_item', name: 'Restoration Kit', type: 'item', description: 'ไอเท็มสำหรับคืนสภาพอาวุธที่แตก', icon: '🧰', price: 100, currency: 'coin', quantity: 1, inventoryItemId: 'restoration_kit' },
    { id: 'shop_repair_item', name: 'Repair Kit', type: 'item', description: 'ไอเท็มสำหรับซ่อม Durability', icon: '🔧', price: 80, currency: 'coin', quantity: 1, inventoryItemId: 'repair_kit' },
    { id: 'shop_character_core', name: 'Character Core', type: 'upgrade', description: 'วัสดุสำหรับอัปเกรดตัวละคร', icon: '💠', price: 150, currency: 'coin', quantity: 1, inventoryItemId: 'char_core' },
    { id: 'shop_enhancement_guard', name: 'Enhancement Guard', type: 'enhancement', description: 'ป้องกันการลดระดับ Enhancement 1 ครั้ง', icon: '🛡️', price: 200, currency: 'coin', quantity: 1, inventoryItemId: 'enhance_protect' },
    { id: 'shop_ore', name: 'Mystic Ore', type: 'material', description: 'วัตถุดิบ Mock สำหรับระบบตีบวก', icon: '⛏️', price: 50, currency: 'coin', quantity: 1, inventoryItemId: 'mystic_ore' },
    { id: 'shop_essence', name: 'Power Essence', type: 'material', description: 'วัตถุดิบ Mock สำหรับระบบอัปเกรด', icon: '✨', price: 120, currency: 'coin', quantity: 1, inventoryItemId: 'power_essence' }
  ];

  const CATEGORY_LABELS = {
    all: 'ทั้งหมด', item: 'ไอเท็ม', material: 'วัตถุดิบ', upgrade: 'อัปเกรด', enhancement: 'ตีบวก'
  };

  let selectedCategory = 'all';

  const getInventory = () => window.GameInventory;
  const getRoot = () => document.getElementById('gameShopRoot');
  const getCoin = () => {
    const api = getInventory();
    return api && typeof api.getCurrency === 'function' ? Number(api.getCurrency().coin || 0) : 0;
  };
  const updateBalance = () => {
    const el = document.getElementById('gameShopCoinBalance');
    if (el) el.textContent = getCoin();
  };
  const setFeedback = (message, type = 'info') => {
    const el = document.getElementById('gameShopFeedback');
    if (!el) return;
    el.className = `game-shop-feedback ${type}`;
    el.textContent = message;
    window.setTimeout(() => {
      if (el.textContent === message) {
        el.textContent = '';
        el.className = 'game-shop-feedback';
      }
    }, 2600);
  };

  const visibleProducts = () => selectedCategory === 'all'
    ? SHOP_CONFIG
    : SHOP_CONFIG.filter(product => product.type === selectedCategory);

  const renderProducts = () => {
    const list = document.getElementById('gameShopProducts');
    if (!list) return;
    list.innerHTML = visibleProducts().map(product => `
      <article class="game-shop-card" data-shop-product="${product.id}">
        <div class="game-shop-card-icon">${product.icon}</div>
        <div class="game-shop-card-body">
          <span class="game-shop-type">${CATEGORY_LABELS[product.type] || product.type}</span>
          <h3>${product.name}</h3>
          <p>${product.description}</p>
          <div class="game-shop-meta"><span>จำนวน ${product.quantity} ชิ้น</span><strong>🪙 ${product.price}</strong></div>
          <div class="game-shop-buy-row">
            <button type="button" class="game-shop-buy" data-shop-buy="${product.id}" data-shop-qty="1">×1</button>
            <button type="button" class="game-shop-buy" data-shop-buy="${product.id}" data-shop-qty="5">×5</button>
            <button type="button" class="game-shop-buy" data-shop-buy="${product.id}" data-shop-qty="10">×10</button>
          </div>
        </div>
      </article>
    `).join('');
  };

  const renderShop = () => {
    if (!getRoot()) return;
    updateBalance();
    renderProducts();
  };

  const purchase = (productId, requestedQty) => {
    const api = getInventory();
    const product = SHOP_CONFIG.find(item => item.id === productId);
    const qty = Number(requestedQty);
    if (!api || !product || !Number.isInteger(qty) || qty <= 0) {
      setFeedback('ไม่สามารถทำรายการสินค้าได้', 'fail');
      return;
    }
    if (product.currency !== 'coin') {
      setFeedback('สินค้านี้ไม่ได้ใช้ Coin', 'fail');
      return;
    }
    const totalQuantity = product.quantity * qty;
    const totalPrice = product.price * qty;
    if (typeof api.hasCoin !== 'function' || typeof api.spendCoin !== 'function' || typeof api.addItem !== 'function') {
      setFeedback('ไม่พบฟังก์ชัน Currency / Inventory เดิม', 'fail');
      return;
    }
    if (!api.hasCoin(totalPrice)) {
      setFeedback(`Coin ไม่เพียงพอ · ต้องใช้ ${totalPrice} Coin`, 'fail');
      return;
    }
    if (!api.spendCoin(totalPrice)) {
      setFeedback('ไม่สามารถหัก Coin ได้ · ไม่ได้เพิ่ม Item', 'fail');
      return;
    }
    try {
      const inventoryItem = api.addItem({
        id: product.inventoryItemId,
        name: product.name,
        type: product.type,
        description: product.description,
        icon: product.icon
      }, totalQuantity);
      if (!inventoryItem) throw new Error('Inventory addItem failed');
      updateBalance();
      setFeedback(`ซื้อ ${product.name} ×${totalQuantity} สำเร็จ · ใช้ ${totalPrice} Coin`, 'success');
    } catch (error) {
      if (typeof api.addCoin === 'function') api.addCoin(totalPrice);
      updateBalance();
      setFeedback('เพิ่ม Item ไม่สำเร็จ · คืน Coin ให้แล้ว', 'fail');
      console.error('[Shop]', error);
    }
  };

  const bindShopEvents = () => {
    const root = getRoot();
    if (!root || root.dataset.shopBound === '1') return;
    root.dataset.shopBound = '1';
    root.addEventListener('click', event => {
      const category = event.target.closest('[data-shop-category]');
      if (category) {
        selectedCategory = category.dataset.shopCategory || 'all';
        root.querySelectorAll('[data-shop-category]').forEach(button => button.classList.toggle('active', button === category));
        renderProducts();
        return;
      }
      const buy = event.target.closest('[data-shop-buy]');
      if (buy) purchase(buy.dataset.shopBuy, buy.dataset.shopQty);
    });
  };

  const openShop = () => {
    try {
      if (!document.querySelector('#gameLobbyPage [data-game-panel-view="shop"]')) return;
      bindShopEvents();
      renderShop();
    } catch (error) {
      console.error('[Shop]', error);
      setFeedback('Shop ไม่สามารถแสดงผลได้ แต่ระบบอื่นยังทำงานต่อ', 'fail');
    }
  };

  // Observe the existing Game Lobby navigation without replacing or modifying its handler.
  document.addEventListener('click', event => {
    const button = event.target.closest('#gameLobbyPage [data-game-panel="shop"]');
    if (!button) return;
    window.setTimeout(openShop, 0);
  }, true);
})();
