import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { online } from './online.js';

const boxes = [
 {name:'กล่องธรรมดา',en:'Food Box',price:1,rarity:'COMMON',color:0x8a92a6,accent:0x6c7a89,icon:'🍔',rewards:['ชุดอาหารพรีเมียม','ขนมนำเข้า','เครื่องดื่ม','บะหมี่พิเศษ']},
 {name:'กล่องหายาก',en:'Fashion Box',price:2,rarity:'UNCOMMON',color:0x22c55e,accent:0x4ade80,icon:'👕',rewards:['เสื้อยืดแฟชั่น','หมวก','กระเป๋า','รองเท้า']},
 {name:'กล่องแรร์',en:'Utility Box',price:3,rarity:'RARE',color:0x2563eb,accent:0x38bdf8,icon:'◉',rewards:['หูฟัง','แก้วเก็บอุณหภูมิ','อุปกรณ์โต๊ะ','ของใช้พรีเมียม']},
 {name:'กล่องอีพิค',en:'Big Prize',price:4,rarity:'EPIC',color:0x9333ea,accent:0xc084fc,icon:'🎁',rewards:['บัตรของขวัญ','สินค้า Limited','ของสะสม','รางวัลพิเศษ']},
 {name:'กล่องเลเจนด์',en:'Legend Box',price:5,rarity:'LEGENDARY',color:0xd97706,accent:0xfde047,icon:'♛',rewards:['iPhone 15 Pro Max','AirPods Pro 2','รางวัลใหญ่','สินค้า Rare']}
];

let points = 24;
let selected = 4;
let rollCount = 1;

// คลังรางวัลของผู้ใช้ — ผู้เล่นใหม่ต้องเริ่มจากคลังว่าง
// รางวัลจะถูกเพิ่มเข้าคลังเฉพาะเมื่อมีการสุ่มสำเร็จเท่านั้น
let rewards = [];

// รายการรางวัลล่าสุดที่สุ่มได้จากการเปิดครั้งนี้
let lastRolledItems = [];

const EXPIRE_TIME = 24 * 60 * 60 * 1000;
const HISTORY_EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000;
const HISTORY_STORAGE_KEY = 'mystery_box_roll_history';

const initialMockWinners = [
  {id:1, username:'OpChan_Live', prizeName:'iPhone 15 Pro Max', rarity:'LEGENDARY', icon:'📱', boxName:'กล่องเลเจนด์', timestamp: Date.now() - 100000},
  {id:2, username:'Gamer_Pro', prizeName:'AirPods Pro 2', rarity:'EPIC', icon:'🎧', boxName:'กล่องอีพิค', timestamp: Date.now() - 300000},
  {id:3, username:'User_9921', prizeName:'เสื้อยืดแฟชั่น', rarity:'UNCOMMON', icon:'👕', boxName:'กล่องหายาก', timestamp: Date.now() - 600000},
  {id:4, username:'LuckyGuy', prizeName:'แก้วเก็บอุณหภูมิ', rarity:'RARE', icon:'◉', boxName:'กล่องแรร์', timestamp: Date.now() - 900000},
  {id:5, username:'BoxMaster', prizeName:'ชุดอาหารพรีเมียม', rarity:'COMMON', icon:'🍔', boxName:'กล่องธรรมดา', timestamp: Date.now() - 1200000}
];

let rawWinners = localStorage.getItem('mystery_box_winners');
let winners = rawWinners ? JSON.parse(rawWinners) : initialMockWinners;

// ประวัติการสุ่ม: เก็บไว้ในเครื่องของผู้ใช้ย้อนหลัง 7 วัน
let rawRollHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
let rollHistory = rawRollHistory ? JSON.parse(rawRollHistory) : [];

const $ = s => document.querySelector(s); const $$ = s => [...document.querySelectorAll(s)];

function cleanupRollHistory() {
  const now = Date.now();
  const before = rollHistory.length;
  rollHistory = rollHistory.filter(item => (now - item.timestamp) < HISTORY_EXPIRE_TIME);
  if (rollHistory.length !== before) {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(rollHistory));
  }
}

function formatHistoryTime(timestamp) {
  const d = new Date(timestamp);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderRollHistory() {
  cleanupRollHistory();
  const el = $('#historyList');
  if (!el) return;

  if (rollHistory.length === 0) {
    el.innerHTML = '<div class="history-empty">ยังไม่มีประวัติการสุ่มในช่วง 7 วันที่ผ่านมา</div>';
    return;
  }

  el.innerHTML = rollHistory.map(item => `
    <div class="history-row">
      <div class="history-icon">${item.icon}</div>
      <div class="history-main">
        <b>${item.prizeName}</b>
        <span>สุ่มจาก ${item.boxName}</span>
      </div>
      <span class="rarity ${item.rarity.toLowerCase()}">${item.rarity}</span>
      <div class="history-time">${formatHistoryTime(item.timestamp)}</div>
    </div>
  `).join('');
}

function addRollHistory(items, boxName) {
  const timestamp = Date.now();
  items.forEach(item => {
    rollHistory.unshift({
      id: Date.now() + Math.random(),
      prizeName: item.name,
      rarity: item.rarity,
      icon: item.icon,
      boxName,
      timestamp
    });
  });
  cleanupRollHistory();
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(rollHistory));
  renderRollHistory();
  online.addRollHistory(items, boxName, timestamp).catch(err => console.warn('Online history sync unavailable:', err));
}

function syncPoints() {
  const top = $('#topPoints');
  const side = $('#sidePoints');
  if(top) top.textContent = points;
  if(side) side.textContent = points;
}

function toast(t) {
  const e = $('#toast');
  if(!e) return;
  e.textContent = t;
  e.classList.add('show');
  setTimeout(() => e.classList.remove('show'), 2500);
}

function boxMarkup(b, i) {
  return `<article class="box-card ${i===4?'legend':''}" data-i="${i}">
    <span class="price">🪙 ${b.price}</span>
    <div class="card-scene"><canvas id="cardCanvas${i}"></canvas></div>
    <h3>${b.name}</h3>
    <p>${b.en}</p>
    <div class="rarity ${b.rarity.toLowerCase()}">${b.rarity}</div>
  </article>`;
}

const boxGrid = $('#boxGrid');
if(boxGrid) boxGrid.innerHTML = boxes.map(boxMarkup).join('');

function makeRenderer(canvas) {
  const r = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true});
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}

function resize(r, c) {
  const w = Math.max(1, c.clientWidth);
  const h = Math.max(1, c.clientHeight);
  r.setSize(w, h, false);
}

function createTextTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.font = '140px Kanit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createLuxuryBox(b) {
  const group = new THREE.Group();
  const rarity = b.rarity;

  const baseMat = new THREE.MeshStandardMaterial({
    color: b.color,
    metalness: rarity === 'LEGENDARY' ? 0.95 : (rarity === 'EPIC' ? 0.85 : 0.6),
    roughness: rarity === 'LEGENDARY' ? 0.1 : (rarity === 'EPIC' ? 0.15 : 0.3),
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 0.9,
    roughness: 0.1,
  });

  const glowMat = new THREE.MeshStandardMaterial({
    color: b.accent,
    emissive: b.accent,
    emissiveIntensity: rarity === 'LEGENDARY' ? 3.5 : (rarity === 'EPIC' ? 2.5 : 1.5),
    metalness: 0.2,
    roughness: 0.1
  });

  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x0a0b10,
    metalness: 0.8,
    roughness: 0.2
  });

  const bodyGroup = new THREE.Group();
  const wallMat = baseMat;
  
  const bottomBox = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 2.2), wallMat);
  bottomBox.position.y = -0.85;
  bodyGroup.add(bottomBox);
  
  const wallFront = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.7, 0.1), wallMat);
  wallFront.position.set(0, 0, 1.05);
  bodyGroup.add(wallFront);

  const wallBack = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.7, 0.1), wallMat);
  wallBack.position.set(0, 0, -1.05);
  bodyGroup.add(wallBack);

  const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.7, 2.0), wallMat);
  wallLeft.position.set(-1.05, 0, 0);
  bodyGroup.add(wallLeft);

  const wallRight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.7, 2.0), wallMat);
  wallRight.position.set(1.05, 0, 0);
  bodyGroup.add(wallRight);

  group.add(bodyGroup);

  const edgeGeo = new THREE.BoxGeometry(0.12, 1.82, 0.12);
  const corners = [
    [-1.05, 0, -1.05], [1.05, 0, -1.05],
    [-1.05, 0, 1.05],  [1.05, 0, 1.05]
  ];

  corners.forEach(([x, y, z]) => {
    const edge = new THREE.Mesh(edgeGeo, (rarity === 'LEGENDARY' ? goldMat : darkMat));
    edge.position.set(x, y, z);
    group.add(edge);

    const neonBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.06), glowMat);
    neonBar.position.set(x * 1.02, y, z * 1.02);
    group.add(neonBar);
  });

  const lockGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
  const lock = new THREE.Mesh(lockGeo, (rarity === 'COMMON' ? darkMat : goldMat));
  lock.rotation.x = Math.PI / 2;
  lock.position.set(0, 0.2, 1.12);
  group.add(lock);

  const lockGlow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), glowMat);
  lockGlow.position.set(0, 0.2, 1.18);
  group.add(lockGlow);

  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.9, -1.1);

  const lidMat = (rarity === 'LEGENDARY' || rarity === 'EPIC') ? goldMat : darkMat;
  const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.35, 2.32), lidMat);
  lidMesh.position.set(0, 0.175, 1.1);
  lidMesh.castShadow = true;
  lidPivot.add(lidMesh);

  if (rarity === 'EPIC' || rarity === 'LEGENDARY') {
    const gemGeo = new THREE.OctahedronGeometry(0.35);
    const gem = new THREE.Mesh(gemGeo, glowMat);
    gem.position.set(0, 0.5, 1.1);
    lidPivot.add(gem);
    group.userData.gem = gem;
  }
  group.add(lidPivot);
  group.userData.lidPivot = lidPivot;

  if (rarity === 'EPIC' || rarity === 'LEGENDARY') {
    const ringGeo = new THREE.TorusGeometry(1.8, 0.03, 16, 100);
    const ring = new THREE.Mesh(ringGeo, glowMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.5;
    group.add(ring);
    group.userData.ring = ring;
  }

  const rewardGroup = new THREE.Group();
  rewardGroup.position.set(0, -0.4, 0);
  rewardGroup.scale.set(0, 0, 0);

  const itemMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.6),
    new THREE.MeshBasicMaterial({
      map: createTextTexture(b.icon),
      transparent: true,
      side: THREE.DoubleSide
    })
  );
  rewardGroup.add(itemMesh);

  const rewardGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 16, 16),
    new THREE.MeshBasicMaterial({
      color: b.accent,
      transparent: true,
      opacity: 0.5
    })
  );
  rewardGroup.add(rewardGlow);

  group.add(rewardGroup);
  group.userData.rewardGroup = rewardGroup;
  group.userData.rewardMesh = itemMesh;

  const root = new THREE.Group();
  root.add(group);
  
  const light = new THREE.PointLight(b.accent, rarity === 'LEGENDARY' ? 8 : 4, 6);
  light.position.set(0, 0.5, 0);
  root.add(light);

  return root;
}

const scenes = [];

function mountScene(canvas, b, interactive = false) {
  if(!canvas) return null;
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 1.8, 5.5);
  camera.lookAt(0, 0, 0);
  
  const renderer = makeRenderer(canvas);
  const controls = interactive ? new OrbitControls(camera, renderer.domElement) : null;
  if(controls) {
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 3.5;
    controls.maxDistance = 7.5;
    controls.target.set(0, 0, 0);
  }
  
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 2.5);
  mainLight.position.set(5, 8, 5);
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(b.accent, 2.0);
  fillLight.position.set(-5, -2, -5);
  scene.add(fillLight);

  const boxObj = createLuxuryBox(b);
  scene.add(boxObj);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 64),
    new THREE.MeshBasicMaterial({color: b.accent, transparent: true, opacity: 0.15})
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.2;
  scene.add(floor);

  const particles = new THREE.Group();
  const particleCount = b.rarity === 'LEGENDARY' ? 60 : 25;
  for(let i = 0; i < particleCount; i++) {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.02 + Math.random() * 0.02, 8, 8),
      new THREE.MeshBasicMaterial({color: b.accent, transparent: true, opacity: 0.7})
    );
    p.position.set(
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 5
    );
    particles.add(p);
  }
  scene.add(particles);

  const obj = {scene, camera, renderer, controls, box: boxObj, particles, data: b};
  scenes.push(obj);

  const tick = () => {
    if(!obj.isOpening) {
      obj.box.rotation.y += 0.008;
    }
    particles.rotation.y -= 0.002;

    const innerBox = obj.box.children[0];
    if (innerBox.userData.ring) {
      innerBox.userData.ring.rotation.z += 0.02;
    }
    if (innerBox.userData.gem) {
      innerBox.userData.gem.rotation.y += 0.03;
    }

    controls?.update();
    resize(renderer, canvas);
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  tick();
  return obj;
}

const heroCanvas = $('#heroCanvas');
let hero = null;
if(heroCanvas) {
  hero = mountScene(heroCanvas, boxes[4], true);
  if(hero) hero.camera.position.set(0, 1.5, 4.8);
}

boxes.forEach((b, i) => {
  const c = $(`#cardCanvas${i}`);
  if(c) mountScene(c, b, false);
});

const openCanvas = $('#openCanvas');
let openScene = null;
if(openCanvas) openScene = mountScene(openCanvas, boxes[4], true);

// แสดงผลคลังรางวัลที่หน้าแรก
function renderInventory() {
  const el = $('#inventoryGrid');
  if(!el) return;
  el.innerHTML = rewards.slice(0, 10).map(r => 
    `<div class="item">
      <div class="item-visual">${r.icon}</div>
      <b>${r.name}</b>
      <small class="rarity ${r.rarity.toLowerCase()}">${r.rarity}</small>
    </div>`
  ).join('') || '<div class="item" style="grid-column: 1/-1;">ไม่มีรางวัลในคลัง</div>';
}

// เปิด Modal คลังรางวัลทั้งหมด
function openInventoryModal() {
  const modal = $('#inventoryModal');
  const listEl = $('#fullInventoryList');
  if(!modal || !listEl) return;

  if (rewards.length === 0) {
    listEl.innerHTML = `<div class="no-rewards">ไม่มีรางวัลคงเหลือในคลัง</div>`;
  } else {
    listEl.innerHTML = rewards.map((r) => `
      <div class="inventory-row-item">
        <div class="item-left">
          <span class="icon">${r.icon}</span>
          <div class="details">
            <b>${r.name}</b>
            <span class="rarity ${r.rarity.toLowerCase()}">${r.rarity}</span>
          </div>
        </div>
        <button class="claim-single-btn" data-id="${r.id}">ขอรับรางวัล</button>
      </div>
    `).join('');

    // ผูก Event ให้ปุ่มกดขอรับรายชิ้น
    $$('.claim-single-btn').forEach(btn => {
      btn.onclick = () => {
        const id = Number(btn.dataset.id);
        rewards = rewards.filter(item => item.id !== id);
        renderInventory();
        openInventoryModal(); // render ใหม่
        toast('รางวัลจะถูกส่งภายใน 24 ชั่วโมง');
      };
    });
  }

  modal.classList.remove('hidden');
}

// ขอรับรางวัลทั้งหมดในคลัง
const claimAllBtn = $('#claimAllBtn');
if(claimAllBtn) {
  claimAllBtn.onclick = () => {
    if(rewards.length === 0) {
      toast('ไม่มีรางวัลในคลังให้ขอรับ');
      return;
    }
    rewards = [];
    renderInventory();
    openInventoryModal();
    toast('รางวัลจะถูกส่งภายใน 24 ชั่วโมง');
  };
}

$('#closeInventoryModal')?.addEventListener('click', () => {
  $('#inventoryModal')?.classList.add('hidden');
});

renderInventory();
syncPoints();

// =========================================================
// Supabase Auth — registration, login and logout
// =========================================================
const authScreen = $('#authScreen');
const loginForm = $('#loginForm');
const registerForm = $('#registerForm');
const loginTab = $('#loginTab');
const registerTab = $('#registerTab');
const accountModal = $('#accountModal');

function setAuthMessage(id, message, success = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('success', success);
}

function showAuthMode(mode) {
  const login = mode === 'login';
  loginForm?.classList.toggle('hidden', !login);
  registerForm?.classList.toggle('hidden', login);
  loginTab?.classList.toggle('active', login);
  registerTab?.classList.toggle('active', !login);
  setAuthMessage('#loginMessage', '');
  setAuthMessage('#registerMessage', '');
}

function showGame(profile, user) {
  document.body.classList.remove('auth-pending');
  authScreen?.classList.add('hidden');

  const username = profile?.username || user?.user_metadata?.username || 'ผู้ใช้';
  const welcome = $('#welcomeUsername');
  if (welcome) welcome.textContent = username;
  const accountUsername = $('#accountUsername');
  const accountEmail = $('#accountEmail');
  const accountPageUsername = $('#accountPageUsername');
  const accountPageEmail = $('#accountPageEmail');
  if (accountUsername) accountUsername.textContent = username;
  if (accountEmail) accountEmail.textContent = user?.email || '';
  if (accountPageUsername) accountPageUsername.textContent = username;
  if (accountPageEmail) accountPageEmail.textContent = user?.email || '';
}

function showLoggedOut() {
  document.body.classList.add('auth-pending');
  authScreen?.classList.remove('hidden');
  accountModal?.classList.add('hidden');
  showAuthMode('login');
  if (loginForm) loginForm.reset();
  if (registerForm) registerForm.reset();
}

loginTab?.addEventListener('click', () => showAuthMode('login'));
registerTab?.addEventListener('click', () => showAuthMode('register'));

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = loginForm.querySelector('button[type="submit"]');
  const email = $('#loginEmail')?.value.trim();
  const password = $('#loginPassword')?.value || '';
  setAuthMessage('#loginMessage', '');
  if (btn) btn.disabled = true;

  try {
    const profile = await online.signIn(email, password);
    showGame(profile, online.user);
    if (Number.isFinite(Number(profile?.coins))) {
      points = Number(profile.coins);
      syncPoints();
    }
    try {
      const cloudHistory = await online.getRollHistory();
      if (cloudHistory.length) {
        rollHistory = cloudHistory;
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(rollHistory));
        renderRollHistory();
      }
    } catch (err) {
      console.warn('Online history load unavailable:', err);
    }
    await applySiteSettings();
  } catch (err) {
    setAuthMessage('#loginMessage', err?.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  } finally {
    if (btn) btn.disabled = false;
  }
});

registerForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = registerForm.querySelector('button[type="submit"]');
  const username = $('#registerUsername')?.value.trim();
  const email = $('#registerEmail')?.value.trim();
  const password = $('#registerPassword')?.value || '';
  const confirm = $('#registerPasswordConfirm')?.value || '';
  setAuthMessage('#registerMessage', '');

  if (password !== confirm) {
    setAuthMessage('#registerMessage', 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
    return;
  }
  if (password.length < 6) {
    setAuthMessage('#registerMessage', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    return;
  }
  if (username.length < 3) {
    setAuthMessage('#registerMessage', 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร');
    return;
  }

  if (btn) btn.disabled = true;
  try {
    const data = await online.signUp(email, password, username);
    if (!data?.session || !data?.user) {
      // signUp() has already cleared any previous local session. Do not let
      // the old account remain visible while the new account waits for email
      // confirmation.
      showLoggedOut();
      throw new Error('บัญชีถูกสร้างแล้ว แต่ต้องยืนยันอีเมลก่อนเข้าสู่ระบบ');
    }
    online.user = data.user;
    const profile = await online.loadProfile();
    showGame(profile, data.user);
    if (Number.isFinite(Number(profile?.coins))) {
      points = Number(profile.coins);
      syncPoints();
    }
    setAuthMessage('#registerMessage', '');
    await applySiteSettings();
  } catch (err) {
    setAuthMessage('#registerMessage', err?.message || 'สมัครสมาชิกไม่สำเร็จ');
  } finally {
    if (btn) btn.disabled = false;
  }
});

$('#accountBtn')?.addEventListener('click', () => accountModal?.classList.remove('hidden'));
$('#closeAccountModal')?.addEventListener('click', () => accountModal?.classList.add('hidden'));
accountModal?.querySelector('.modal-backdrop')?.addEventListener('click', () => accountModal?.classList.add('hidden'));

$('#logoutBtn')?.addEventListener('click', async () => {
  const btn = $('#logoutBtn');
  if (btn) btn.disabled = true;
  try {
    await online.signOut();
    showLoggedOut();
  } catch (err) {
    toast(err?.message || 'ออกจากระบบไม่สำเร็จ');
  } finally {
    if (btn) btn.disabled = false;
  }
});

// Online bridge: load the authenticated player's cloud balance/history.
async function applySiteSettings() {
  try {
    const settings = await online.getSiteSettings();
    const announcement = String(settings.announcement || '').trim();
    const banner = $('#siteAnnouncement');
    const maintenance = $('#maintenanceOverlay');
    const maintenanceText = $('#maintenanceAnnouncement');
    if (banner) {
      banner.textContent = announcement;
      banner.classList.toggle('hidden', !announcement);
    }
    if (maintenanceText) maintenanceText.textContent = announcement;
    if (maintenance) maintenance.classList.toggle('hidden', !settings.maintenance_mode);
    if (settings.maintenance_mode) document.body.classList.add('site-maintenance');
  } catch (err) {
    console.warn('Site settings unavailable:', err);
  }
}

online.init().then(async profile => {
  if (!online.user) {
    showLoggedOut();
    return;
  }
  showGame(profile, online.user);
  await applySiteSettings();

  if (Number.isFinite(Number(profile?.coins))) {
    points = Number(profile.coins);
    syncPoints();
  }
  try {
    const cloudHistory = await online.getRollHistory();
    if (cloudHistory.length) {
      rollHistory = cloudHistory;
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(rollHistory));
      renderRollHistory();
    }
  } catch (err) {
    console.warn('Online history load unavailable:', err);
  }
}).catch(err => {
  console.warn('Supabase authentication unavailable:', err);
  showLoggedOut();
});

let isUserInteracting = false;

function renderWinners() {
  const now = Date.now();
  winners = winners.filter(w => (now - w.timestamp) < EXPIRE_TIME);
  localStorage.setItem('mystery_box_winners', JSON.stringify(winners));
  
  const el = $('#winnersList');
  if(!el) return;
  if(winners.length === 0) {
    el.innerHTML = `<div class="winner-empty">ยังไม่มีประวัติการเปิดกล่องใน 24 ชม. ที่ผ่านมา</div>`;
    return;
  }

  const itemsHtml = winners.map(w => {
    const timeAgo = Math.floor((now - w.timestamp) / 60000);
    const timeStr = timeAgo < 1 ? 'เมื่อสักครู่' : `${timeAgo} นาทีที่แล้ว`;
    return `<div class="winner-item">
      <div class="winner-user">
        <span class="winner-avatar">👤</span>
        <div>
          <b>${w.username}</b>
          <small>สุ่มได้จาก ${w.boxName}</small>
        </div>
      </div>
      <div class="winner-prize">
        <span class="prize-icon">${w.icon}</span>
        <div>
          <span class="prize-name">${w.prizeName}</span>
          <span class="rarity ${w.rarity.toLowerCase()}">${w.rarity}</span>
        </div>
      </div>
      <div class="winner-time">${timeStr}</div>
    </div>`;
  }).join('');

  el.innerHTML = itemsHtml + itemsHtml;
}

renderWinners();

const winnersListEl = $('#winnersList');
if(winnersListEl) {
  let scrollSpeed = 0.5;
  function autoScrollStep() {
    if(!isUserInteracting && winnersListEl.scrollHeight > winnersListEl.clientHeight) {
      winnersListEl.scrollTop += scrollSpeed;
      if (winnersListEl.scrollTop >= winnersListEl.scrollHeight / 2) {
        winnersListEl.scrollTop = 0;
      }
    }
    requestAnimationFrame(autoScrollStep);
  }
  requestAnimationFrame(autoScrollStep);

  winnersListEl.addEventListener('mouseenter', () => isUserInteracting = true);
  winnersListEl.addEventListener('mouseleave', () => isUserInteracting = false);
  winnersListEl.addEventListener('touchstart', () => isUserInteracting = true, {passive: true});
  winnersListEl.addEventListener('touchend', () => isUserInteracting = false, {passive: true});
}

function addWinnerRecord(prizeName, rarity, icon, boxName) {
  const newRecord = {
    id: Date.now() + Math.random(),
    username: 'Player_' + Math.floor(1000 + Math.random() * 9000),
    prizeName,
    rarity,
    icon,
    boxName,
    timestamp: Date.now()
  };
  winners.unshift(newRecord);
  renderWinners();
}

function resetRollBtnState(b) {
  const btn = $('#rollBtn');
  if(!btn) return;
  btn.disabled = false;
  const totalPrice = b.price * rollCount;
  btn.innerHTML = `เปิดกล่อง ${rollCount} ครั้ง <span>🪙 ${totalPrice}</span>`;
  hasClaimed = true;
  rolling = false;
  if(openScene) openScene.isOpening = false;
  const overlay = $('#floatingOverlay');
  if(overlay) overlay.classList.remove('active');
}

function setSelected(i) {
  selected = i;
  rollCount = 1;
  
  $$('.amount-btn').forEach(btn => btn.classList.remove('active'));
  const defaultBtn = $('.amount-btn[data-count="1"]');
  if(defaultBtn) defaultBtn.classList.add('active');

  const b = boxes[i];
  
  if($('#modalTitle')) $('#modalTitle').textContent = b.name;
  if($('#modalRarity')) {
    $('#modalRarity').textContent = b.rarity;
    $('#modalRarity').className = 'rarity ' + b.rarity.toLowerCase();
  }
  
  const overlay = $('#floatingOverlay');
  if(overlay) overlay.classList.remove('active');
  
  if(openScene) {
    openScene.scene.remove(openScene.box);
    openScene.box = createLuxuryBox(b);
    openScene.scene.add(openScene.box);
    openScene.camera.position.set(0, 1.8, 5.2);
    openScene.camera.lookAt(0, 0, 0);
    openScene.isOpening = false;
  }
  
  resetRollBtnState(b);
}

// เลือกจำนวนครั้งที่จะเปิด
$$('.amount-btn').forEach(btn => {
  btn.onclick = () => {
    if(rolling || !hasClaimed) return;
    $$('.amount-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    rollCount = parseInt(btn.dataset.count) || 1;
    const b = boxes[selected];
    resetRollBtnState(b);
  };
});

function openBox(i) {
  setSelected(i);
  const modal = $('#openModal');
  if(modal) modal.classList.remove('hidden');
  setTimeout(() => {
    if(openScene && openCanvas) resize(openScene.renderer, openCanvas);
  }, 30);
}

$$('.box-card').forEach(c => c.addEventListener('click', () => openBox(+c.dataset.i)));
$$('[data-open]').forEach(b => b.addEventListener('click', () => openBox(+b.dataset.open)));

$('#closeModal')?.addEventListener('click', () => $('#openModal')?.classList.add('hidden'));

// ปุ่ม "ดูทั้งหมด" ของคลังรางวัล
$('#viewAll')?.addEventListener('click', openInventoryModal);

function spawnSparks() {
  const layer = $('#sparkLayer');
  if(!layer) return;
  layer.innerHTML = '';
  for(let i = 0; i < 55; i++) {
    const s = document.createElement('i');
    s.className = 'spark';
    s.style.left = (45 + Math.random() * 10) + '%';
    s.style.top = (42 + Math.random() * 15) + '%';
    s.style.setProperty('--x', ((Math.random() - .5) * 520) + 'px');
    s.style.setProperty('--y', ((Math.random() - .6) * 360) + 'px');
    layer.appendChild(s);
  }
}

let rolling = false;
let hasClaimed = true;

// ปิด Modal รายการรางวัลที่สุ่มได้หลายชิ้น
$('#closeResultModal')?.addEventListener('click', () => {
  $('#resultModal')?.classList.add('hidden');
});

$('#claimResultBtn')?.addEventListener('click', () => {
  $('#resultModal')?.classList.add('hidden');
  toast('ย้ายรางวัลทั้งหมดเข้าคลังแล้ว');
});

const rollBtn = $('#rollBtn');
if(rollBtn) {
  rollBtn.onclick = async () => {
    const b = boxes[selected];
    const totalPrice = b.price * rollCount;
    
    // เมื่อสุ่มเสร็จแล้ว กดปุ่มรับรางวัล / ดูกล่อง
    if(!hasClaimed) {
      if(rollCount > 1) {
        // กรณี 2 ชิ้นขึ้นไป: เปิด Modal แสดงรายการทั้งหมด
        const resultModal = $('#resultModal');
        const listEl = $('#resultList');
        if(listEl) {
          listEl.innerHTML = lastRolledItems.map(item => `
            <div class="result-item">
              <div class="result-item-icon">${item.icon}</div>
              <div class="result-item-name">${item.name}</div>
              <span class="rarity ${item.rarity.toLowerCase()}">${item.rarity}</span>
            </div>
          `).join('');
        }
        if(resultModal) resultModal.classList.remove('hidden');
      }

      // ปิดแอนิเมชันกล่อง และย้ายของเข้าคลัง
      if(!openScene) return;
      rollBtn.disabled = true;
      const boxGroup = openScene.box.children[0];
      const lidPivot = boxGroup.userData.lidPivot;
      const rewardGroup = boxGroup.userData.rewardGroup;
      
      const overlay = $('#floatingOverlay');
      if(overlay) overlay.classList.remove('active');

      const closeStartTime = performance.now();
      const closeDuration = 800;

      function animateClosing(now) {
        const elapsed = now - closeStartTime;
        const progress = Math.min(1, elapsed / closeDuration);
        const ease = 1 - Math.pow(1 - progress, 2);

        lidPivot.rotation.x = -(1 - ease) * (Math.PI * 0.7);
        rewardGroup.position.y = 1.8 - (ease * 2.2);
        const s = (1 - ease) * 1.3;
        rewardGroup.scale.set(s, s, s);

        if(progress < 1) {
          requestAnimationFrame(animateClosing);
        } else {
          if(rollCount === 1) toast(`บันทึกรางวัลเรียบร้อยแล้ว`);
          resetRollBtnState(b);
        }
      }
      requestAnimationFrame(animateClosing);
      return;
    }
    
    if(rolling) return;
    if(points < totalPrice) {
      toast(`แต้มไม่พอ (ต้องการ 🪙 ${totalPrice})`);
      return;
    }
    
    // Save the new balance first so a refresh cannot restore the old coins.
    const newPoints = points - totalPrice;
    try {
      await online.saveCoins(newPoints);
    } catch (err) {
      toast('บันทึกเหรียญไม่สำเร็จ กรุณาลองใหม่');
      return;
    }

    rolling = true;
    hasClaimed = false;
    points = newPoints;
    syncPoints();
    
    rollBtn.disabled = true;
    
    if(!openScene) return;
    openScene.isOpening = true;
    
    openScene.camera.position.set(0, 1.8, 5.2);
    openScene.camera.lookAt(0, 0, 0);

    const boxGroup = openScene.box.children[0];
    const lidPivot = boxGroup.userData.lidPivot;
    const rewardGroup = boxGroup.userData.rewardGroup;
    const rewardMesh = boxGroup.userData.rewardMesh;

    // สุ่มของรางวัลตามจำนวน rollCount
    lastRolledItems = [];
    for(let k = 0; k < rollCount; k++) {
      const rewardName = b.rewards[Math.floor(Math.random() * b.rewards.length)];
      lastRolledItems.push({
        id: Date.now() + Math.random(),
        name: rewardName,
        rarity: b.rarity,
        icon: b.icon
      });
    }

    const mainReward = lastRolledItems[0];
    
    if(rewardMesh) {
      rewardMesh.material.map = createTextTexture(mainReward.icon);
      rewardMesh.material.needsUpdate = true;
    }

    lidPivot.rotation.x = 0;
    rewardGroup.scale.set(0, 0, 0);
    rewardGroup.position.set(0, -0.4, 0);

    const startTime = performance.now();
    const spinDuration = 2000; 
    const totalRounds = 6;     

    function animateSpinAndOpen(now) {
      const elapsed = now - startTime;

      if (elapsed < spinDuration) {
        const spinProgress = elapsed / spinDuration;
        const easeOut = 1 - Math.pow(1 - spinProgress, 3);
        openScene.box.rotation.y = easeOut * (Math.PI * 2 * totalRounds);
        requestAnimationFrame(animateSpinAndOpen);
      } else {
        openScene.box.rotation.y = 0;

        const openStartTime = performance.now();
        const openDuration = 1200;

        function animatePopup(popupNow) {
          const popupElapsed = popupNow - openStartTime;
          const popProgress = Math.min(1, popupElapsed / openDuration);
          const easeOutBack = Math.sin(popProgress * Math.PI / 2);

          lidPivot.rotation.x = -easeOutBack * (Math.PI * 0.7);
          rewardGroup.position.y = -0.4 + (easeOutBack * 2.2);
          const s = easeOutBack * 1.3;
          rewardGroup.scale.set(s, s, s);
          rewardGroup.rotation.y = (1 - popProgress) * Math.PI * 2;

          if (popProgress < 1) {
            requestAnimationFrame(animatePopup);
          } else {
            // บันทึกรางวัลทั้งหมดลงคลัง
            addRollHistory(lastRolledItems, b.name);
            lastRolledItems.forEach(item => {
              rewards.unshift(item);
              addWinnerRecord(item.name, b.rarity, b.icon, b.name);
            });
            renderInventory();
            
            if($('#floatRarity')) {
              $('#floatRarity').textContent = b.rarity;
              $('#floatRarity').className = 'rarity ' + b.rarity.toLowerCase();
            }
            if($('#floatName')) {
              $('#floatName').textContent = rollCount > 1 ? `${mainReward.name} (+อีก ${rollCount - 1} ชิ้น)` : mainReward.name;
            }
            if($('#floatSub')) $('#floatSub').textContent = `สุ่มสำเร็จ ${rollCount} ครั้ง ได้ระดับ ${b.rarity}`;
            
            const overlay = $('#floatingOverlay');
            if(overlay) overlay.classList.add('active');

            const flash = $('#flash');
            if(flash) {
              flash.classList.remove('go');
              void flash.offsetWidth;
              flash.classList.add('go');
            }
            
            spawnSparks();
            
            rollBtn.disabled = false;
            // ปรับชื่อปุ่มตามเงื่อนไข (1 ชิ้น vs 2 ชิ้นขึ้นไป)
            if (rollCount === 1) {
              rollBtn.innerHTML = `รับรางวัล`;
            } else {
              rollBtn.innerHTML = `ดูรางวัลที่ได้ (${rollCount} ชิ้น)`;
            }
            rolling = false;
          }
        }
        requestAnimationFrame(animatePopup);
      }
    }
    requestAnimationFrame(animateSpinAndOpen);
  };
}

const soundBtn = $('#soundBtn');
if(soundBtn) soundBtn.onclick = () => toast('ระบบเสียงพร้อมใช้งานใน Prototype');

// Top-up system: isolated from the existing box/3D/gameplay logic.
const topupModal = $('#topupModal');
const topupForm = $('#topupForm');
const topupMethod = $('#topupMethod');
const topupAmount = $('#topupAmount');
const walletFields = $('#walletFields');
const cardFields = $('#cardFields');
const walletLink = $('#walletLink');
const cardAmount = $('#cardAmount');
const cardCode = $('#cardCode');
const cardProof = $('#cardProof');
const topupSubmit = $('#topupSubmit');

function setTopupMethod(method) {
  if (topupMethod) topupMethod.value = method;
  $$('.topup-method').forEach(btn => btn.classList.toggle('active', btn.dataset.method === method));
  if (walletFields) walletFields.classList.toggle('hidden', method !== 'wallet');
  if (cardFields) cardFields.classList.toggle('hidden', method !== 'card');
  if (topupAmount) topupAmount.value = method === 'card' ? (cardAmount?.value || '50') : '';
  if (walletLink) walletLink.required = method === 'wallet';
  if (cardCode) cardCode.required = method === 'card';
  if (cardProof) cardProof.required = false;
}

function openTopupModal() {
  if (!topupModal) return;
  setTopupMethod(topupMethod?.value || 'wallet');
  topupModal.classList.remove('hidden');
}

$('#topUpBtn')?.addEventListener('click', openTopupModal);
$('#closeTopupModal')?.addEventListener('click', () => topupModal?.classList.add('hidden'));
topupModal?.querySelector('.modal-backdrop')?.addEventListener('click', () => topupModal.classList.add('hidden'));
$$('.topup-method').forEach(btn => btn.addEventListener('click', () => setTopupMethod(btn.dataset.method)));
cardAmount?.addEventListener('change', () => { if (topupMethod?.value === 'card' && topupAmount) topupAmount.value = cardAmount.value; });
cardCode?.addEventListener('input', () => { cardCode.value = cardCode.value.replace(/\D/g, '').slice(0, 14); });

topupForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!online.user) {
    toast('กรุณาเข้าสู่ระบบก่อนเติมเงิน');
    return;
  }
  const method = topupMethod?.value || 'wallet';
  const amount = Number(topupAmount?.value || 0);
  if (!Number.isInteger(amount) || amount < 10) {
    toast('ยอดเติมขั้นต่ำ 10 บาท');
    return;
  }
  if (method === 'card') {
    const selectedCardAmount = Number(cardAmount?.value || 0);
    if (amount !== selectedCardAmount) {
      if (topupAmount) topupAmount.value = selectedCardAmount;
      toast('กรุณาใช้จำนวนเงินตามมูลค่าบัตร');
      return;
    }
    if (!/^\d{14}$/.test(cardCode?.value || '')) {
      toast('กรุณากรอกรหัสบัตร 14 หลัก');
      return;
    }
  } else if (!/^https?:\/\//i.test(walletLink?.value || '')) {
    toast('กรุณาวางลิงก์ Wallet ให้ถูกต้อง');
    return;
  }

  if (topupSubmit) { topupSubmit.disabled = true; topupSubmit.textContent = 'กำลังส่งคำขอ...'; }
  try {
    let proofPath = null;
    if (method === 'card' && cardProof?.files?.[0]) proofPath = await online.uploadTopupProof(cardProof.files[0]);
    await online.submitTopup({
      method,
      amount,
      walletLink: method === 'wallet' ? walletLink.value.trim() : null,
      cardCode: method === 'card' ? cardCode.value : null,
      proofPath
    });
    topupForm.reset();
    setTopupMethod('wallet');
    topupModal.classList.add('hidden');
    toast('ส่งคำขอเติมเงินแล้ว รอแอดมินตรวจสอบ');
  } catch (err) {
    console.error('Top-up submit failed:', err);
    toast(err?.message || 'ส่งคำขอเติมเงินไม่สำเร็จ');
  } finally {
    if (topupSubmit) { topupSubmit.disabled = false; topupSubmit.textContent = 'ส่งคำขอเติมเงิน'; }
  }
});


function showAccountPage() {
  ['.hero', '.content', '.bottom-grid'].forEach(sel => document.querySelector(sel)?.classList.add('hidden'));
  $('#accountPage')?.classList.remove('hidden');
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function showHomePage() {
  ['.hero', '.content', '.bottom-grid'].forEach(sel => document.querySelector(sel)?.classList.remove('hidden'));
  $('#accountPage')?.classList.add('hidden');
}

$$('.nav').forEach(n => n.onclick = () => {
  $$('.nav').forEach(x => x.classList.remove('active'));
  n.classList.add('active');
  const p = n.dataset.page;
  if(p === 'account') showAccountPage();
  else if(p === 'rewards') { showHomePage(); openInventoryModal(); }
  else if(p === 'history') {
    showHomePage();
    renderRollHistory();
    $('#historyModal')?.classList.remove('hidden');
  }
  else if(p === 'boxes') { showHomePage(); document.querySelector('.content')?.scrollIntoView({behavior: 'smooth'}); }
  else if(p === 'home') { showHomePage(); document.querySelector('.hero')?.scrollIntoView({behavior: 'smooth'}); }
});

$('#accountPageLogout')?.addEventListener('click', async () => {
  const btn = $('#accountPageLogout');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังออกจากระบบ...'; }
  try {
    await online.signOut();
    showLoggedOut();
  } catch (err) {
    toast(err?.message || 'ออกจากระบบไม่สำเร็จ');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🚪 ออกจากระบบ'; }
  }
});

$('#accountBackHome')?.addEventListener('click', () => {
  const home = document.querySelector('.nav[data-page="home"]');
  home?.click();
});

$('#closeHistoryModal')?.addEventListener('click', () => {
  $('#historyModal')?.classList.add('hidden');
});

$('#clearHistoryBtn')?.addEventListener('click', () => {
  if (rollHistory.length === 0) {
    toast('ไม่มีประวัติให้ล้าง');
    return;
  }
  rollHistory = [];
  localStorage.removeItem(HISTORY_STORAGE_KEY);
  renderRollHistory();
  toast('ล้างประวัติการสุ่มแล้ว');
});

// ตรวจสอบอายุประวัติเป็นระยะ เพื่อให้รายการเก่ากว่า 7 วันหายอัตโนมัติ
cleanupRollHistory();
setInterval(() => {
  const before = rollHistory.length;
  cleanupRollHistory();
  if (rollHistory.length !== before) renderRollHistory();
}, 60 * 1000);

window.addEventListener('resize', () => scenes.forEach(o => {
  if(!o || !o.renderer || !o.renderer.domElement) return;
  resize(o.renderer, o.renderer.domElement);
  o.camera.aspect = o.renderer.domElement.clientWidth / o.renderer.domElement.clientHeight;
  o.camera.updateProjectionMatrix();
}));