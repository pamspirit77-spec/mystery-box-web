(() => {
  'use strict';

  // Shop-only configuration. It uses the existing Coin and Item storage from V8.
  const COIN_KEY = 'gameLobbyGachaCurrencyV1';
  const ITEM_KEY = 'gameLobbyItemInventoryV1';
  const UPGRADE_ITEM_KEY = 'gameLobbyCharacterUpgradeItemsV1';

  const SHOP_CONFIG = Object.freeze([
    { id:'char_core', name:'Character Core', type:'upgrade', icon:'💠', description:'วัสดุสำหรับอัปเกรดตัวละคร', price:120, currency:'coin', quantity:1 },
    { id:'enhance_protect', name:'Enhancement Guard', type:'enhancement', icon:'🛡️', description:'ป้องกันการลดระดับ Enhancement 1 ครั้ง', price:100, currency:'coin', quantity:1 },
    { id:'restoration_kit', name:'Restoration Kit', type:'item', icon:'🧰', description:'ไอเท็มสำหรับคืนสภาพอาวุธที่แตก', price:80, currency:'coin', quantity:1 },
    { id:'repair_kit', name:'Repair Kit', type:'material', icon:'🔧', description:'ไอเท็มสำหรับซ่อม Durability', price:60, currency:'coin', quantity:1 }
  ]);

  const state = { category:'all', quantity:1 };

  function readCoin() {
    try {
      const value = Number(localStorage.getItem(COIN_KEY));
      return Number.isFinite(value) && value >= 0 ? value : 0;
    } catch (_) { return 0; }
  }

  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }

  function writeArray(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  }

  function getItems() {
    const items = readArray(ITEM_KEY);
    const upgradeItems = readArray(UPGRADE_ITEM_KEY);
    if (!items.length && upgradeItems.length) return upgradeItems.map(x => ({...x}));
    const merged = items.map(x => ({...x}));
    upgradeItems.forEach(up => {
      const existing = merged.find(x => x.id === up.id);
      if (!existing) merged.push({...up});
    });
    return merged;
  }

  function addToExistingInventory(product, amount) {
    const items = getItems();
    let item = items.find(x => x.id === product.id);
    if (item) item.quantity = Math.max(0, Number(item.quantity) || 0) + amount;
    else {
      item = {
        id: product.id,
        type: product.type,
        name: product.name,
        icon: product.icon,
        description: product.description,
        quantity: amount
      };
      items.push(item);
    }

    if (!writeArray(ITEM_KEY, items)) return false;

    // Character Core already belongs to the existing Character Upgrade inventory.
    if (product.id === 'char_core') {
      const upgrades = readArray(UPGRADE_ITEM_KEY);
      const existing = upgrades.find(x => x.id === product.id);
      if (existing) existing.quantity = Math.max(0, Number(existing.quantity) || 0) + amount;
      else upgrades.push({id:product.id, name:product.name, icon:product.icon, description:product.description, quantity:amount});
      if (!writeArray(UPGRADE_ITEM_KEY, upgrades)) return false;
    }
    return true;
  }

  function spendCoin(amount) {
    const balance = readCoin();
    if (balance < amount) return false;
    try { localStorage.setItem(COIN_KEY, String(balance - amount)); return true; }
    catch (_) { return false; }
  }

  function refundCoin(amount) {
    const balance = readCoin();
    try { localStorage.setItem(COIN_KEY, String(balance + amount)); } catch (_) {}
  }

  function money(value) { return Number(value).toLocaleString('en-US'); }

  function filteredProducts() {
    return SHOP_CONFIG.filter(p => state.category === 'all' || p.type === state.category);
  }

  function renderShop() {
    const root = document.getElementById('gameShopRoot');
    if (!root) return;

    const balance = readCoin();
    const products = filteredProducts();
    root.innerHTML = `
      <div class="game-shop-head">
        <div>
          <div class="game-shop-kicker">GAME SHOP</div>
          <h2>ร้านค้า</h2>
          <p>ซื้อไอเทมด้วย Coin และเพิ่มเข้าคลัง Item เดิมของเกม</p>
        </div>
        <div class="game-shop-balance"><span>🪙</span><strong>${money(balance)}</strong><small>COIN</small></div>
      </div>
      <div class="game-shop-tabs">
        ${[['all','ทั้งหมด'],['item','ไอเทม'],['material','วัตถุดิบ'],['upgrade','อัปเกรด'],['enhancement','ตีบวก']].map(([id,label]) =>
          `<button type="button" class="game-shop-tab ${state.category===id?'active':''}" data-shop-category="${id}">${label}</button>`).join('')}
      </div>
      <div class="game-shop-grid">
        ${products.map(product => `
          <article class="game-shop-card">
            <div class="game-shop-icon">${product.icon}</div>
            <div class="game-shop-card-body">
              <div class="game-shop-type">${product.type.toUpperCase()}</div>
              <h3>${product.name}</h3>
              <p>${product.description}</p>
              <div class="game-shop-buy-row">
                <div class="game-shop-price">🪙 ${money(product.price)} <small>/ ชิ้น</small></div>
                <div class="game-shop-qty" aria-label="จำนวน">
                  ${[1,5,10].map(q => `<button type="button" class="game-shop-qty-btn ${state.quantity===q?'active':''}" data-shop-qty="${q}">x${q}</button>`).join('')}
                </div>
              </div>
              <button type="button" class="game-shop-buy" data-shop-buy="${product.id}">ซื้อ x${state.quantity} · ${money(product.price*state.quantity)} Coin</button>
            </div>
          </article>`).join('') || '<div class="game-shop-empty">ไม่พบสินค้าในหมวดนี้</div>'}
      </div>
      <div id="gameShopMessage" class="game-shop-message" role="status"></div>
      <button class="game-panel-back game-shop-back" type="button" data-game-panel="play">← กลับ Game Lobby</button>
    `;
  }

  function showMessage(message, type) {
    const el = document.getElementById('gameShopMessage');
    if (!el) return;
    el.className = `game-shop-message ${type || ''}`;
    el.textContent = message;
  }

  function handleBuy(productId) {
    const product = SHOP_CONFIG.find(p => p.id === productId);
    if (!product) return;
    const qty = state.quantity;
    const total = product.price * qty;
    if (product.currency !== 'coin') return;

    if (!spendCoin(total)) {
      showMessage('Coin ไม่เพียงพอ', 'fail');
      return;
    }

    if (!addToExistingInventory(product, qty)) {
      refundCoin(total);
      showMessage('ซื้อไม่สำเร็จ · Coin ถูกคืนแล้ว', 'fail');
      return;
    }

    // Reload only after a successful isolated Shop transaction so V8's existing
    // systems reload their own in-memory state from their original storage.
    try { location.reload(); } catch (_) { renderShop(); showMessage(`ซื้อ ${product.name} x${qty} สำเร็จ`, 'success'); }
  }

  const lobby = document.getElementById('gameLobbyPage');
  if (!lobby) return;

  // No global Shop initialization. Render only when the existing Shop navigation is opened.
  lobby.addEventListener('click', event => {
    const shopButton = event.target.closest('[data-game-panel="shop"]');
    if (shopButton) {
      setTimeout(renderShop, 0);
      return;
    }

    const category = event.target.closest('[data-shop-category]');
    if (category) {
      state.category = category.dataset.shopCategory || 'all';
      renderShop();
      return;
    }

    const quantity = event.target.closest('[data-shop-qty]');
    if (quantity) {
      state.quantity = Number(quantity.dataset.shopQty) || 1;
      renderShop();
      return;
    }

    const buy = event.target.closest('[data-shop-buy]');
    if (buy) handleBuy(buy.dataset.shopBuy);
  }, true);
})();
