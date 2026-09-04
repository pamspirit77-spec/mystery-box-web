(() => {
  'use strict';

  // Mission / Achievement is intentionally isolated from the existing Game Lobby systems.
  // It uses only window.GameInventory for shared Currency + Inventory rewards.
  const MISSION_STORAGE_KEY = 'gameLobbyMissionStateV1';
  const ACHIEVEMENT_STORAGE_KEY = 'gameLobbyAchievementStateV1';

  const MISSION_CONFIG = [
    { id: 'gacha_once', name: 'เปิด Gacha 1 ครั้ง', description: 'เปิด Gacha ให้สำเร็จ 1 ครั้ง', progress: 0, target: 1, reward: { type: 'coin', amount: 100, label: '🪙 100 Coin' } },
    { id: 'shop_buy_once', name: 'ซื้อ Item จาก Shop 1 ครั้ง', description: 'ซื้อสินค้าใน Shop ให้สำเร็จ 1 ครั้ง', progress: 0, target: 1, reward: { type: 'item', item: { id: 'mission_reward_box', name: 'Mission Reward Box', type: 'item', icon: '🎁', description: 'Mock Reward จากระบบ Mission' }, amount: 1, label: '🎁 Mission Reward Box ×1' } },
    { id: 'character_upgrade_once', name: 'อัปเกรด Character 1 ครั้ง', description: 'อัปเกรดตัวละครให้สำเร็จ 1 ครั้ง', progress: 0, target: 1, reward: { type: 'coin', amount: 150, label: '🪙 150 Coin' } },
    { id: 'weapon_enhance_once', name: 'ตีบวก Weapon 1 ครั้ง', description: 'ตีบวกอาวุธให้สำเร็จ 1 ครั้ง', progress: 0, target: 1, reward: { type: 'item', item: { id: 'mission_enhance_token', name: 'Enhancement Token', type: 'enhancement', icon: '🔨', description: 'Mock Reward สำหรับระบบตีบวก' }, amount: 1, label: '🔨 Enhancement Token ×1' } }
  ];

  const ACHIEVEMENT_CONFIG = [
    { id: 'first_character', icon: '👤', name: 'ได้ Character ตัวแรก', description: 'มี Character อย่างน้อย 1 ตัวใน Inventory', target: 1 },
    { id: 'first_weapon', icon: '⚔️', name: 'ได้ Weapon ตัวแรก', description: 'มี Weapon อย่างน้อย 1 ชิ้นใน Inventory', target: 1 },
    { id: 'has_item', icon: '🎁', name: 'มี Item ใน Inventory', description: 'มี Item อย่างน้อย 1 ชิ้นใน Inventory', target: 1 },
    { id: 'character_upgraded', icon: '⬆️', name: 'อัปเกรด Character สำเร็จ', description: 'เตรียม Progress สำหรับ Event จาก Character Upgrade', target: 1 }
  ];

  let missionState = loadState(MISSION_STORAGE_KEY);
  let achievementState = loadState(ACHIEVEMENT_STORAGE_KEY);
  let activeTab = 'mission';

  function loadState(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === 'object' ? value : {};
    } catch (_) { return {}; }
  }

  function saveState() {
    try {
      localStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(missionState));
      localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(achievementState));
    } catch (_) {}
  }

  function clampProgress(value, target) {
    return Math.max(0, Math.min(target, Number(value) || 0));
  }

  function getInventory() {
    return window.GameInventory && typeof window.GameInventory.getCharacters === 'function'
      ? window.GameInventory : null;
  }

  function missionProgress(item) {
    const saved = missionState[item.id];
    return clampProgress(saved?.progress ?? item.progress, item.target);
  }

  function missionClaimed(item) {
    return missionState[item.id]?.claimed === true;
  }

  function achievementProgress(item) {
    const inventory = getInventory();
    if (item.id === 'first_character') return inventory ? Math.min(item.target, inventory.getCharacters().length) : 0;
    if (item.id === 'first_weapon') return inventory ? Math.min(item.target, inventory.getWeapons().length) : 0;
    if (item.id === 'has_item') return inventory ? Math.min(item.target, inventory.getItems().filter(i => (i.quantity || 0) > 0).length) : 0;
    return clampProgress(achievementState[item.id]?.progress || 0, item.target);
  }

  function achievementUnlocked(item) {
    return achievementProgress(item) >= item.target;
  }

  function rewardLabel(reward) {
    return reward?.label || 'Mock Reward';
  }

  function grantReward(reward) {
    const inventory = getInventory();
    if (!inventory || !reward) return false;
    if (reward.type === 'coin') return inventory.addCoin(Number(reward.amount) || 0);
    if (reward.type === 'diamond') return inventory.addDiamond(Number(reward.amount) || 0);
    if (reward.type === 'item') return Boolean(inventory.addItem(reward.item, Number(reward.amount) || 1));
    return false;
  }

  function setFeedback(message, type = 'info') {
    const el = document.getElementById('missionFeedback');
    if (!el) return;
    el.className = `mission-feedback ${type}`;
    el.textContent = message;
    clearTimeout(setFeedback.timer);
    setFeedback.timer = setTimeout(() => { if (el) { el.textContent = ''; el.className = 'mission-feedback'; } }, 3200);
  }

  function renderMission() {
    const root = document.getElementById('missionList');
    if (!root) return;
    root.innerHTML = MISSION_CONFIG.map(item => {
      const progress = missionProgress(item);
      const complete = progress >= item.target;
      const claimed = missionClaimed(item);
      const percent = Math.round((progress / item.target) * 100);
      return `<article class="mission-card ${complete ? 'is-complete' : ''} ${claimed ? 'is-claimed' : ''}">
        <div class="mission-card-icon">🎯</div>
        <div class="mission-card-main">
          <div class="mission-card-top"><div><span class="mission-card-type">MISSION</span><h3>${item.name}</h3><p>${item.description}</p></div><strong>${progress} / ${item.target}</strong></div>
          <div class="mission-progress"><i style="width:${percent}%"></i></div>
          <div class="mission-card-bottom"><span>รางวัล: <b>${rewardLabel(item.reward)}</b></span>${claimed ? '<em class="mission-status claimed">รับแล้ว</em>' : complete ? `<button type="button" class="game-action-placeholder mission-claim-btn" data-mission-claim="${item.id}">รับรางวัล</button>` : '<em class="mission-status">กำลังดำเนินการ</em>'}</div>
        </div>
      </article>`;
    }).join('') || emptyState('🎯', 'ไม่มีภารกิจ', 'ยังไม่มี Mission ให้ทำในขณะนี้');
  }

  function renderAchievements() {
    const root = document.getElementById('achievementList');
    if (!root) return;
    root.innerHTML = ACHIEVEMENT_CONFIG.map(item => {
      const progress = achievementProgress(item);
      const unlocked = achievementUnlocked(item);
      const percent = Math.round((progress / item.target) * 100);
      return `<article class="achievement-card ${unlocked ? 'is-unlocked' : ''}">
        <div class="achievement-icon">${item.icon}</div>
        <div class="achievement-main">
          <div class="achievement-top"><div><span class="mission-card-type">ACHIEVEMENT</span><h3>${item.name}</h3><p>${item.description}</p></div><strong>${progress} / ${item.target}</strong></div>
          <div class="mission-progress"><i style="width:${percent}%"></i></div>
          <div class="achievement-status">${unlocked ? '<b>✓ ปลดล็อกแล้ว</b>' : '<span>🔒 ยังไม่ปลดล็อก</span>'}</div>
        </div>
      </article>`;
    }).join('') || emptyState('🏆', 'ไม่มีความสำเร็จ', 'ยังไม่มี Achievement ให้ปลดล็อกในขณะนี้');
  }

  function emptyState(icon, title, description) {
    return `<div class="inventory-empty-state mission-empty-state"><span>${icon}</span><strong>${title}</strong><small>${description}</small></div>`;
  }

  function render() {
    const panel = document.querySelector('[data-game-panel-view="missions"]');
    if (!panel) return;
    const missionTab = panel.querySelector('[data-mission-tab="mission"]');
    const achievementTab = panel.querySelector('[data-mission-tab="achievement"]');
    missionTab?.classList.toggle('active', activeTab === 'mission');
    achievementTab?.classList.toggle('active', activeTab === 'achievement');
    panel.querySelector('[data-mission-view="mission"]')?.classList.toggle('active', activeTab === 'mission');
    panel.querySelector('[data-mission-view="achievement"]')?.classList.toggle('active', activeTab === 'achievement');
    renderMission();
    renderAchievements();
  }

  function claimMission(id) {
    const item = MISSION_CONFIG.find(x => x.id === id);
    if (!item || missionClaimed(item)) return;
    if (missionProgress(item) < item.target) {
      setFeedback('ภารกิจยังไม่สำเร็จ · ยังรับรางวัลไม่ได้', 'fail');
      return;
    }
    if (!grantReward(item.reward)) {
      setFeedback('ไม่สามารถเพิ่มรางวัลผ่านระบบกลางได้', 'fail');
      return;
    }
    missionState[item.id] = { progress: item.target, claimed: true };
    saveState();
    render();
    setFeedback(`รับรางวัลสำเร็จ · ${rewardLabel(item.reward)}`, 'success');
  }

  // Future integration API: other systems can report progress without depending on Mission UI.
  window.GameMission = {
    setProgress(id, progress) {
      const item = MISSION_CONFIG.find(x => x.id === id);
      if (!item || missionClaimed(item)) return false;
      missionState[id] = { ...(missionState[id] || {}), progress: clampProgress(progress, item.target), claimed: false };
      saveState();
      if (activeTab === 'mission') renderMission();
      return true;
    },
    increment(id, amount = 1) {
      const item = MISSION_CONFIG.find(x => x.id === id);
      if (!item) return false;
      return this.setProgress(id, missionProgress(item) + (Number(amount) || 0));
    },
    unlockAchievement(id) {
      const item = ACHIEVEMENT_CONFIG.find(x => x.id === id);
      if (!item) return false;
      achievementState[id] = { ...(achievementState[id] || {}), progress: item.target };
      saveState();
      if (activeTab === 'achievement') renderAchievements();
      return true;
    },
    setAchievementProgress(id, progress) {
      const item = ACHIEVEMENT_CONFIG.find(x => x.id === id);
      if (!item) return false;
      achievementState[id] = { ...(achievementState[id] || {}), progress: clampProgress(progress, item.target) };
      saveState();
      if (activeTab === 'achievement') renderAchievements();
      return true;
    },
    getMissions: () => MISSION_CONFIG.map(item => ({ ...item, progress: missionProgress(item), claimed: missionClaimed(item) })),
    getAchievements: () => ACHIEVEMENT_CONFIG.map(item => ({ ...item, progress: achievementProgress(item), unlocked: achievementUnlocked(item) }))
  };

  document.addEventListener('click', event => {
    const missionTab = event.target.closest('[data-mission-tab]');
    if (missionTab) {
      const panel = missionTab.closest('[data-game-panel-view="missions"]');
      if (!panel) return;
      activeTab = missionTab.dataset.missionTab;
      render();
      return;
    }
    const claim = event.target.closest('[data-mission-claim]');
    if (claim) claimMission(claim.dataset.missionClaim);
  });

  // Re-render only when the existing Game Lobby navigation selects Missions.
  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-game-panel="missions"]');
    if (!nav) return;
    setTimeout(() => {
      try { render(); } catch (err) { console.error('Mission render error:', err); }
    }, 0);
  }, true);

  // Refresh Achievement state from the shared Inventory only when Mission is opened.
  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-game-panel="missions"]');
    if (!nav) return;
    setTimeout(() => {
      try { renderAchievements(); } catch (err) { console.error('Achievement render error:', err); }
    }, 0);
  });
})();
