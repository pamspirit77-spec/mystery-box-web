/* Shop module: isolated from existing Game Lobby initialization/navigation. */
(() => {
  'use strict';

  const SHOP_CONFIG = Object.freeze([
    {id:'shop_basic_potion',name:'น้ำยาฟื้นฟู',type:'item',description:'ไอเท็มสำหรับใช้งานในเกม',icon:'🧪',price:50,currency:'coin',quantity:1},
    {id:'shop_char_core',name:'Character Core',type:'upgrade',description:'วัสดุสำหรับอัปเกรดตัวละคร',icon:'💠',price:120,currency:'coin',quantity:1},
    {id:'shop_enhance_stone',name:'Enhance Stone',type:'ตีบวก',description:'วัสดุสำหรับการตีบวกอาวุธ',icon:'🔷',price:100,currency:'coin',quantity:1},
    {id:'shop_ore',name:'Mystic Ore',type:'วัตถุดิบ',description:'วัตถุดิบสำหรับระบบคราฟต์ในอนาคต',icon:'⛏️',price:75,currency:'coin',quantity:1}
  ]);

  const labels = {all:'ทั้งหมด',item:'ไอเท็ม',material:'วัตถุดิบ',upgrade:'อัปเกรด',enhance:'ตีบวก'};
  let activeCategory = 'all';
  let quantities = Object.fromEntries(SHOP_CONFIG.map(x => [x.id, 1]));

  const root = () => document.getElementById('gameShopRoot');
  const inventory = () => window.GameInventory;
  const filtered = () => SHOP_CONFIG.filter(p => activeCategory === 'all' || p.type === activeCategory);
  const categoryOf = type => type === 'material' ? 'material' : type === 'enhance' ? 'enhance' : type;

  function message(text, type='') {
    const el = root()?.querySelector('#gameShopMessage');
    if (!el) return;
    el.className = `game-shop-message ${type}`;
    el.textContent = text;
  }

  function render() {
    const el = root();
    if (!el) return;
    try {
      const api = inventory();
      const balance = Number(api?.getCurrency?.()?.coin || 0);
      el.innerHTML = `
        <div class="game-shop-head">
          <div class="game-shop-title"><h2>🛒 ร้านค้า</h2><p>ซื้อไอเท็มด้วย Coin จาก Currency กลางของเกม</p></div>
          <div class="game-shop-balance"><span>COIN</span><strong>🪙 ${balance.toLocaleString()}</strong></div>
        </div>
        <div class="game-shop-tabs">${Object.entries(labels).map(([key,label]) => `<button type="button" class="game-shop-tab ${activeCategory===key?'active':''}" data-shop-category="${key}">${label}</button>`).join('')}</div>
        <div id="gameShopMessage" class="game-shop-message"></div>
        <div class="game-shop-grid">${filtered().map(productCard).join('')}</div>
      `;
      el.querySelectorAll('[data-shop-category]').forEach(btn => btn.addEventListener('click', () => { activeCategory=btn.dataset.shopCategory; render(); }));
      el.querySelectorAll('[data-shop-qty]').forEach(btn => btn.addEventListener('click', () => { quantities[btn.dataset.shopQty] = Number(btn.dataset.qty); render(); }));
      el.querySelectorAll('[data-shop-buy]').forEach(btn => btn.addEventListener('click', () => purchase(btn.dataset.shopBuy)));
    } catch (err) {
      console.error('[Shop]', err);
      el.innerHTML = '<div class="game-shop-empty"><div><div style="font-size:38px">🛒</div><strong>ไม่สามารถโหลดร้านค้าได้</strong><div>Shop ถูกแยกออกจากระบบเดิมและจะไม่หยุดระบบอื่น</div></div></div>';
    }
  }

  function productCard(p) {
    const qty = quantities[p.id] || 1;
    return `<article class="game-shop-card">
      <div class="game-shop-card-icon">${p.icon}</div><h3>${p.name}</h3><p>${p.description}</p>
      <div class="game-shop-meta"><span>${labels[categoryOf(p.type)] || p.type}</span><span>×${p.quantity}</span></div>
      <div class="game-shop-price">🪙 ${p.price.toLocaleString()} Coin / ชิ้น</div>
      <div class="game-shop-qty">${[1,5,10].map(n => `<button type="button" class="${qty===n?'active':''}" data-shop-qty="${p.id}" data-qty="${n}">×${n}</button>`).join('')}</div>
      <div class="game-shop-meta"><span>รวม</span><strong class="game-shop-price">🪙 ${(p.price*qty).toLocaleString()}</strong></div>
      <button type="button" class="game-shop-buy" data-shop-buy="${p.id}">ซื้อ</button>
    </article>`;
  }

  function purchase(id) {
    try {
      const p = SHOP_CONFIG.find(x => x.id === id);
      const api = inventory();
      const qty = quantities[id] || 1;
      if (!p || !api || typeof api.getCurrency !== 'function' || typeof api.spendCoin !== 'function' || typeof api.addItem !== 'function') {
        message('ระบบ Currency / Inventory กลางยังไม่พร้อม', 'error'); return;
      }
      if (![1,5,10].includes(qty)) { message('จำนวนไม่ถูกต้อง', 'error'); return; }
      const total = p.price * qty;
      if (!api.hasCoin?.(total)) { message('Coin ไม่เพียงพอ', 'error'); return; }
      if (!api.spendCoin(total)) { message('ไม่สามารถหัก Coin ได้', 'error'); return; }
      const added = api.addItem({id:p.id,name:p.name,type:p.type,description:p.description,icon:p.icon}, p.quantity * qty);
      if (!added) { api.addCoin?.(total); message('เพิ่ม Item ไม่สำเร็จ — คืน Coin แล้ว', 'error'); return; }
      render();
      message(`ซื้อ ${p.name} ×${p.quantity*qty} สำเร็จ`, 'success');
    } catch (err) {
      console.error('[Shop purchase]', err);
      message('เกิดข้อผิดพลาดในการซื้อ', 'error');
    }
  }

  function onShopOpen() {
    // Only render after the existing navigation handler has selected the panel.
    setTimeout(render, 0);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const lobby = document.getElementById('gameLobbyPage');
    if (!lobby) return;
    lobby.addEventListener('click', event => {
      const btn = event.target.closest?.('[data-game-panel="shop"]');
      if (btn) onShopOpen();
    }, true);
  });

  window.GameShop = Object.freeze({
    config: SHOP_CONFIG,
    refresh: render
  });
})();
