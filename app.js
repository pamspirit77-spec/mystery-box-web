import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { online } from './online.js';

// Keep the core app independent from optional Three.js addon modules.
// A segmented BoxGeometry is used as a safe fallback for rounded visual assets.
const RoundedBoxGeometry = class extends THREE.BoxGeometry {
  constructor(width, height, depth, segments = 3) { super(width, height, depth, segments, segments, segments); }
};

const defaultBoxes = [
 {id:'box1',name:'กล่องธรรมดา',en:'Food Box',price:1,rarity:'COMMON',color:0x8a92a6,accent:0x6c7a89,icon:'🍔',rewards:[{id:'box1-item1',name:'ชุดอาหารพรีเมียม',rarity:'COMMON',drop_rate:25,image_url:''},{id:'box1-item2',name:'ขนมนำเข้า',rarity:'COMMON',drop_rate:25,image_url:''},{id:'box1-item3',name:'เครื่องดื่ม',rarity:'COMMON',drop_rate:25,image_url:''},{id:'box1-item4',name:'บะหมี่พิเศษ',rarity:'COMMON',drop_rate:25,image_url:''}]},
 {id:'box2',name:'กล่องหายาก',en:'Fashion Box',price:2,rarity:'UNCOMMON',color:0x22c55e,accent:0x4ade80,icon:'👕',rewards:[{id:'box2-item1',name:'เสื้อยืดแฟชั่น',rarity:'UNCOMMON',drop_rate:25,image_url:''},{id:'box2-item2',name:'หมวก',rarity:'UNCOMMON',drop_rate:25,image_url:''},{id:'box2-item3',name:'กระเป๋า',rarity:'UNCOMMON',drop_rate:25,image_url:''},{id:'box2-item4',name:'รองเท้า',rarity:'UNCOMMON',drop_rate:25,image_url:''}]},
 {id:'box3',name:'กล่องแรร์',en:'Utility Box',price:3,rarity:'RARE',color:0x2563eb,accent:0x38bdf8,icon:'◉',rewards:[{id:'box3-item1',name:'หูฟัง',rarity:'RARE',drop_rate:25,image_url:''},{id:'box3-item2',name:'แก้วเก็บอุณหภูมิ',rarity:'RARE',drop_rate:25,image_url:''},{id:'box3-item3',name:'อุปกรณ์โต๊ะ',rarity:'RARE',drop_rate:25,image_url:''},{id:'box3-item4',name:'ของใช้พรีเมียม',rarity:'RARE',drop_rate:25,image_url:''}]},
 {id:'box4',name:'กล่องอีพิค',en:'Big Prize',price:4,rarity:'EPIC',color:0x9333ea,accent:0xc084fc,icon:'🎁',rewards:[{id:'box4-item1',name:'บัตรของขวัญ',rarity:'EPIC',drop_rate:25,image_url:''},{id:'box4-item2',name:'สินค้า Limited',rarity:'EPIC',drop_rate:25,image_url:''},{id:'box4-item3',name:'ของสะสม',rarity:'EPIC',drop_rate:25,image_url:''},{id:'box4-item4',name:'รางวัลพิเศษ',rarity:'EPIC',drop_rate:25,image_url:''}]},
 {id:'box5',name:'กล่องเลเจนด์',en:'Legend Box',price:5,rarity:'LEGENDARY',color:0xd97706,accent:0xfde047,icon:'♛',rewards:[{id:'box5-item1',name:'iPhone 15 Pro Max',rarity:'LEGENDARY',drop_rate:25,image_url:''},{id:'box5-item2',name:'AirPods Pro 2',rarity:'LEGENDARY',drop_rate:25,image_url:''},{id:'box5-item3',name:'รางวัลใหญ่',rarity:'LEGENDARY',drop_rate:25,image_url:''},{id:'box5-item4',name:'สินค้า Rare',rarity:'LEGENDARY',drop_rate:25,image_url:''}]}
];
let boxes = defaultBoxes.map(b => ({...b, rewards:b.rewards.map(r=>({...r}))}));

let points = 0;
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


// =========================================================
// World Tree — isolated from the existing Mystery Box systems
// =========================================================
const WORLD_TREE_STORAGE_PREFIX = 'mystery_box_world_tree_';
const WORLD_TREE_MAX_GROWTH = 1000;
const WORLD_TREE_GROWTH = Object.freeze({
  normalWater: 10,
  specialWater: 30,
  normalFertilizer: 10,
  specialFertilizer: 30
});

// One source of truth for all World Tree UI growth values.
let worldTreeGrowth = 0;
const WORLD_TREE_REWARDS = [
  { id: 'tree-reward-1000', milestone: 1000, title: 'รางวัลที่ 1', name: 'ยังไม่ได้ตั้งรางวัล', icon: '👑', tone: 'gold' },
  { id: 'tree-reward-800', milestone: 800, title: 'รางวัลที่ 2', name: 'ยังไม่ได้ตั้งรางวัล', icon: '💎', tone: 'purple' },
  { id: 'tree-reward-500', milestone: 500, title: 'รางวัลที่ 3', name: 'ยังไม่ได้ตั้งรางวัล', icon: '🎁', tone: 'blue' }
];
const DEFAULT_WORLD_TREE_STATE = {
  planted: false,
  plantedAt: null,
  items: { normalWater: 25, specialWater: 15, normalFertilizer: 20, specialFertilizer: 10 },
  claimedRewards: []
};
let worldTreeState = JSON.parse(JSON.stringify(DEFAULT_WORLD_TREE_STATE));
let worldTreeScene = null;

function clampWorldTreeGrowth(value) {
  return Math.min(WORLD_TREE_MAX_GROWTH, Math.max(0, Math.round(Number(value) || 0)));
}
function cloneWorldTreeState(state) {
  worldTreeGrowth = clampWorldTreeGrowth(state?.growth ?? 0);
  return {
    planted: Boolean(state?.planted), plantedAt: state?.plantedAt || null,
    growth: worldTreeGrowth,
    items: {
      normalWater: Math.max(0, Number(state?.items?.normalWater ?? 25)),
      specialWater: Math.max(0, Number(state?.items?.specialWater ?? 15)),
      normalFertilizer: Math.max(0, Number(state?.items?.normalFertilizer ?? 20)),
      specialFertilizer: Math.max(0, Number(state?.items?.specialFertilizer ?? 10))
    },
    claimedRewards: Array.isArray(state?.claimedRewards) ? state.claimedRewards.map(String) : []
  };
}
function getWorldTreeStorageKey() {
  const userId = online?.user?.id;
  return userId ? `${WORLD_TREE_STORAGE_PREFIX}${userId}` : null;
}
function saveWorldTreeLocal() {
  const key = getWorldTreeStorageKey(); if (!key) return;
  try { localStorage.setItem(key, JSON.stringify({ ...worldTreeState, growth: worldTreeGrowth })); } catch (_) {}
}
function loadWorldTreeLocal() {
  const key = getWorldTreeStorageKey(); if (!key) return null;
  try { const raw = localStorage.getItem(key); return raw ? cloneWorldTreeState(JSON.parse(raw)) : null; } catch (_) { return null; }
}
function rewardState(reward) {
  if (worldTreeState.claimedRewards.includes(reward.id)) return 'claimed';
  if (worldTreeGrowth >= reward.milestone) return 'ready';
  return 'locked';
}
function rewardCardMarkup(reward) {
  const state = rewardState(reward);
  const stateText = state === 'claimed' ? '✓ รับแล้ว' : state === 'ready' ? 'พร้อมรับ' : `ล็อก • ต้องถึง ${reward.milestone}%`;
  const buttonText = state === 'claimed' ? 'รับแล้ว' : state === 'ready' ? 'รับรางวัล' : `ล็อกอยู่`;
  return `<article class="tree-reward-card ${state} tone-${reward.tone}">
    <div class="tree-reward-icon reward-3d-icon" data-reward-tone="${reward.tone}" aria-hidden="true"></div>
    <div class="tree-reward-info">
      <div class="tree-reward-title"><b>${reward.title}</b><span>${reward.milestone}%</span></div>
      <strong>${reward.name}</strong>
      <small>${stateText}</small>
    </div>
    <button type="button" class="tree-reward-claim" data-tree-reward="${reward.id}" ${state !== 'ready' ? 'disabled' : ''}>${buttonText}</button>
  </article>`;
}
function renderWorldTreeRewards() {
  const markup = WORLD_TREE_REWARDS.map(rewardCardMarkup).join('');
  const compact = $('#treeRewardList'); if (compact) compact.innerHTML = markup;
  const full = $('#treeRewardListFull'); if (full) full.innerHTML = markup;
}
function updateWorldTreeUI() {
  worldTreeGrowth = clampWorldTreeGrowth(worldTreeGrowth);
  worldTreeState.growth = worldTreeGrowth;
  const fill = $('#treeProgressFill');
  if (fill) fill.style.height = `${(worldTreeGrowth / WORLD_TREE_MAX_GROWTH) * 100}%`;
  const growthValue = $('#treeGrowthValue');
  if (growthValue) growthValue.textContent = `${worldTreeGrowth.toLocaleString('en-US')}%`;
  if (growthValue) growthValue.style.bottom = `calc(${(worldTreeGrowth / WORLD_TREE_MAX_GROWTH) * 100}% - 13px)`;

  const stage = $('#treeStageLabel');
  if (stage) stage.textContent = !worldTreeState.planted ? 'ยังไม่ได้ปลูกต้นไม้' : worldTreeGrowth >= WORLD_TREE_MAX_GROWTH ? '🌳 ต้นไม้โลกสมบูรณ์เต็มที่' : `🌱 ต้นไม้กำลังเติบโต • ${worldTreeGrowth}%`;
  const status = $('#treeStatusMessage');
  if (status) status.textContent = !worldTreeState.planted ? 'กด “ปลูกต้นไม้” เพื่อเริ่มต้น' : worldTreeGrowth >= WORLD_TREE_MAX_GROWTH ? '🎉 ต้นไม้โตเต็มที่แล้ว • ตรวจสอบรางวัลทางด้านขวา' : 'ต้นไม้จะไม่โตเอง ต้องใช้น้ำหรือปุ๋ยเพื่อเพิ่ม Growth';

  const plantBtn = $('#plantTreeBtn'); if (plantBtn) plantBtn.disabled = worldTreeState.planted;
  const ids = { normalWater:'normalWaterBtn', specialWater:'specialWaterBtn', normalFertilizer:'normalFertilizerBtn', specialFertilizer:'specialFertilizerBtn' };
  Object.keys(ids).forEach(type => {
    const btn = $(`#${ids[type]}`), count = $(`#${type}Count`);
    if (count) count.textContent = worldTreeState.items[type];
    if (btn) btn.disabled = !worldTreeState.planted || worldTreeGrowth >= WORLD_TREE_MAX_GROWTH || worldTreeState.items[type] <= 0;
  });
  const level = Math.max(1, Math.min(10, Math.floor(worldTreeGrowth / 100) + 1));
  const levelEl = $('#treeLevelText'); if (levelEl) levelEl.textContent = String(level);
  const plantedAtEl = $('#treePlantedAt');
  if (plantedAtEl) plantedAtEl.textContent = worldTreeState.plantedAt ? new Date(worldTreeState.plantedAt).toLocaleString('th-TH', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : 'ยังไม่ได้ปลูก';
  renderWorldTreeRewards();
  mountRewardIconScenes();
  worldTreeScene?.updateGrowth?.(worldTreeState.planted, worldTreeGrowth);
}
async function saveWorldTreeCloud() {
  saveWorldTreeLocal();
  try { const ok = await online.saveWorldTree({ ...worldTreeState, growth: worldTreeGrowth }); if (!ok) throw new Error('บันทึกต้นไม้ไม่สำเร็จ'); return true; }
  catch (err) { console.warn('World Tree cloud save unavailable:', err); return false; }
}
async function loadWorldTree() {
  const cached = loadWorldTreeLocal();
  if (cached) { worldTreeState = cached; updateWorldTreeUI(); }
  try {
    const cloud = await online.getWorldTree();
    if (cloud) { worldTreeState = cloneWorldTreeState(cloud); saveWorldTreeLocal(); updateWorldTreeUI(); }
    else if (cached) await saveWorldTreeCloud();
  } catch (err) { console.warn('World Tree cloud load unavailable:', err); }
}
async function changeWorldTree(action) {
  if (!online?.user) { toast('กรุณาเข้าสู่ระบบก่อนใช้ต้นไม้โลก'); return; }
  if (!worldTreeState.planted && action !== 'plant') { toast('กรุณาปลูกต้นไม้ก่อน'); return; }
  if (action === 'plant') {
    if (worldTreeState.planted) return;
    worldTreeState.planted = true; worldTreeState.plantedAt = new Date().toISOString();
  } else {
    const amount = WORLD_TREE_GROWTH[action];
    if (!amount || worldTreeState.items[action] <= 0 || worldTreeGrowth >= WORLD_TREE_MAX_GROWTH) return;
    worldTreeState.items[action] -= 1;
    worldTreeGrowth = clampWorldTreeGrowth(worldTreeGrowth + amount);
  }
  updateWorldTreeUI();
  const saved = await saveWorldTreeCloud();
  if (!saved) toast('บันทึกต้นไม้ขึ้นคลาวด์ไม่สำเร็จ แต่ข้อมูลถูกเก็บไว้ในเครื่องนี้');
}
async function claimWorldTreeReward(rewardId) {
  const reward = WORLD_TREE_REWARDS.find(r => r.id === rewardId); if (!reward) return;
  if (worldTreeGrowth < reward.milestone || worldTreeState.claimedRewards.includes(reward.id)) return;
  worldTreeState.claimedRewards.push(reward.id);
  updateWorldTreeUI();
  const saved = await saveWorldTreeCloud();
  if (!saved) toast('รับรางวัลแล้ว แต่ซิงก์ขึ้นคลาวด์ไม่สำเร็จ');
  else toast(`รับ ${reward.title} แล้ว`);
}
function createBarkTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0,0,256,0);
  g.addColorStop(0,'#24130c'); g.addColorStop(.24,'#6b3b1e'); g.addColorStop(.5,'#32180d'); g.addColorStop(.72,'#7b4725'); g.addColorStop(1,'#2a160d');
  ctx.fillStyle=g; ctx.fillRect(0,0,256,256);
  for(let i=0;i<90;i++){
    const x=Math.random()*256, y=Math.random()*256, len=20+Math.random()*90;
    ctx.strokeStyle=`rgba(${55+Math.random()*55},${25+Math.random()*35},${12+Math.random()*18},${.18+Math.random()*.35})`;
    ctx.lineWidth=1+Math.random()*2; ctx.beginPath(); ctx.moveTo(x,y); ctx.bezierCurveTo(x+8,y+len*.25,x-7,y+len*.65,x+Math.random()*12,y+len); ctx.stroke();
  }
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(1.2,2.5); tex.colorSpace=THREE.SRGBColorSpace; return tex;
}
function createLeafGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.42); shape.bezierCurveTo(0.34,-0.28,0.46,0.04,0,0.52); shape.bezierCurveTo(-0.46,0.04,-0.34,-0.28,0,-0.42);
  const geo = new THREE.ExtrudeGeometry(shape,{depth:0.055,bevelEnabled:true,bevelSegments:2,bevelSize:0.018,bevelThickness:0.018,curveSegments:5});
  geo.translate(0,0,-0.027); geo.computeVertexNormals(); return geo;
}
function makeBranchCurve(points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, radius, 7, false), material);
  mesh.castShadow=true; mesh.receiveShadow=true; return mesh;
}
function createWorldTreeModel() {
  // One detailed procedural 3D asset. It is intentionally built from curved/custom
  // geometry rather than balls/cones/cylinders, and is ready to swap for a GLB later.
  const root = new THREE.Group(); root.name='WorldTree3D';
  const barkTex=createBarkTexture();
  const barkMat=new THREE.MeshStandardMaterial({map:barkTex,color:0x8a4d27,roughness:.92,metalness:.02});
  const barkDark=new THREE.MeshStandardMaterial({map:barkTex,color:0x4a2715,roughness:.96,metalness:.01});
  const leafColors=[0x1c7135,0x278b40,0x3cad4c,0x5ed15e,0x8be56c];
  const leafMats=leafColors.map((c,i)=>new THREE.MeshStandardMaterial({color:c,roughness:.68,metalness:.01,side:THREE.DoubleSide,emissive:i>2?0x164f21:0x071e0d,emissiveIntensity:i>2?.18:.08}));
  const leafGeo=createLeafGeometry();
  const soilMat=new THREE.MeshStandardMaterial({color:0x352316,roughness:1});
  const grassMat=new THREE.MeshStandardMaterial({color:0x326b2e,roughness:.95});
  const stoneMat=new THREE.MeshStandardMaterial({color:0x4c5b5c,roughness:.9});

  const island=new THREE.Group();
  const grass=new THREE.Mesh(new THREE.CylinderGeometry(2.0,1.78,.28,56),grassMat); grass.position.y=-1.54; grass.castShadow=grass.receiveShadow=true; island.add(grass);
  const soil=new THREE.Mesh(new THREE.CylinderGeometry(1.78,1.46,.46,56),soilMat); soil.position.y=-1.79; soil.castShadow=soil.receiveShadow=true; island.add(soil);
  const soilTop=new THREE.Mesh(new THREE.CircleGeometry(1.77,56),grassMat); soilTop.rotation.x=-Math.PI/2; soilTop.position.y=-1.39; soilTop.receiveShadow=true; island.add(soilTop);
  root.add(island);

  // Main trunk and roots follow curved paths for a more natural silhouette.
  root.add(makeBranchCurve([new THREE.Vector3(0,-1.42,0),new THREE.Vector3(-.08,-.75,.02),new THREE.Vector3(.08,.0,0),new THREE.Vector3(-.02,.72,0)],.31,barkMat));
  root.add(makeBranchCurve([new THREE.Vector3(-.02,-1.2,.03),new THREE.Vector3(-.55,-1.05,.08),new THREE.Vector3(-1.05,-1.28,.12),new THREE.Vector3(-1.35,-1.38,.08)],.105,barkDark));
  root.add(makeBranchCurve([new THREE.Vector3(.04,-1.2,-.03),new THREE.Vector3(.52,-1.0,.02),new THREE.Vector3(1.12,-1.3,-.08),new THREE.Vector3(1.38,-1.38,-.02)],.11,barkDark));
  [[-.28,.1,0,-.92,.05],[.25,.2,.03,.9,-.04],[-.18,.5,.04,-.72,.02],[.18,.68,-.02,.78,.02],[0,.92,0,.55,0]].forEach(([x,y,z,dx,dz])=>{
    root.add(makeBranchCurve([new THREE.Vector3(x,y,z),new THREE.Vector3(x+dx*.34,y+.18,z+dz*.4),new THREE.Vector3(x+dx*.72,y+.5,z+dz*.7),new THREE.Vector3(x+dx,y+.62,z+dz)],.085,barkMat));
  });

  // Many custom 3D leaves arranged in layered natural canopy groups.
  const canopy=[];
  const layers=[
    {y:.72,rx:1.25,rz:1.0,count:44,threshold:0},
    {y:1.05,rx:1.48,rz:1.12,count:48,threshold:.12},
    {y:1.38,rx:1.32,rz:1.05,count:44,threshold:.25},
    {y:1.72,rx:1.05,rz:.86,count:36,threshold:.50},
    {y:2.02,rx:.72,rz:.62,count:28,threshold:.80}
  ];
  layers.forEach((layer,li)=>{
    const g=new THREE.Group(); g.userData={threshold:layer.threshold,phase:li*.8,baseRot:(Math.random()-.5)*.08};
    for(let i=0;i<layer.count;i++){
      const a=(i/layer.count)*Math.PI*2 + (li*.61); const radial=Math.sqrt(Math.random())*.95;
      const leaf=new THREE.Mesh(leafGeo,leafMats[(i+li)%leafMats.length]);
      leaf.position.set(Math.cos(a)*layer.rx*radial, (Math.random()-.5)*.34, Math.sin(a)*layer.rz*radial);
      leaf.rotation.set((Math.random()-.5)*.7,a+Math.PI/2+(Math.random()-.5)*.4,(Math.random()-.5)*.55);
      const s=.24+Math.random()*.18; leaf.scale.set(s,s*1.12,s*.9); leaf.castShadow=true;
      g.add(leaf);
    }
    g.position.y=layer.y; canopy.push(g); root.add(g);
  });

  // A few vines, roots, stones and sprouts add depth without flat imagery.
  const vineMat=new THREE.MeshStandardMaterial({color:0x2b7b38,roughness:.75});
  [[-.22,-.8,.18,.72],[.26,-.5,-.04,.9]].forEach(([x,y,z,h])=>{
    const pts=[]; for(let i=0;i<12;i++){const t=i/11; pts.push(new THREE.Vector3(x+Math.sin(t*7)*.08,y+t*h,z+Math.cos(t*6)*.08));}
    root.add(makeBranchCurve(pts,.026,vineMat));
  });
  [[-1.18,-1.31,.25,.2],[1.14,-1.3,.2,.18],[.88,-1.33,-.6,.14],[-.72,-1.34,-.55,.12]].forEach(([x,y,z,s])=>{
    const st=new THREE.Mesh(new THREE.DodecahedronGeometry(s,1),stoneMat); st.position.set(x,y,z); st.scale.y=.55; st.rotation.set(.2,.6,.1); st.castShadow=true; root.add(st);
  });

  const crystalMat=new THREE.MeshPhysicalMaterial({color:0xb6ff8b,emissive:0x2fbb55,emissiveIntensity:2,roughness:.12,metalness:.18,transmission:.1});
  const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.14,1),crystalMat); crystal.position.set(0,2.55,0); crystal.castShadow=true; root.add(crystal);
  const aura=new THREE.PointLight(0x63ff91,1.8,5.8,2); aura.position.set(0,.8,1.1); root.add(aura);

  let currentScale=.42,targetScale=.42,targetGrowth=0,planted=false;
  root.userData.updateGrowth=(isPlanted,growth)=>{ planted=!!isPlanted; targetGrowth=clampWorldTreeGrowth(growth); const n=targetGrowth/1000; targetScale=planted?.42+n*.58:.32; crystal.visible=planted&&targetGrowth>0; aura.intensity=planted?1.7+n*3:.55; };
  root.userData.animate=(time=performance.now())=>{
    currentScale+=(targetScale-currentScale)*.065; root.scale.setScalar(currentScale); const n=targetGrowth/1000,t=time*.001;
    canopy.forEach((g,i)=>{const unlocked=planted&&n>=g.userData.threshold; g.visible=unlocked||(!planted&&i===0); if(!g.visible)return; g.rotation.z=g.userData.baseRot+Math.sin(t*1.05+g.userData.phase)*(.012+n*.018); g.rotation.x=Math.sin(t*.72+g.userData.phase)*(.01+n*.012);});
    crystal.rotation.y+=.007; crystal.position.y=2.55+Math.sin(t*1.2)*.025; aura.intensity=(planted?1.7+n*3:.55)+Math.sin(t*1.7)*.1;
  };
  return root;
}
function createTreeItemModel(type){
  const group=new THREE.Group();
  const colors={normalWater:0x48bfff,specialWater:0x315dff,normalFertilizer:0x8a6034,specialFertilizer:0xd9a51f};
  const accent={normalWater:0x9ee8ff,specialWater:0x6b8cff,normalFertilizer:0x5aa83e,specialFertilizer:0xffd85a};
  const c=colors[type], a=accent[type];
  if(type.includes('Water')){
    const glass=new THREE.MeshPhysicalMaterial({color:0xbfefff,transparent:true,opacity:.28,roughness:.06,metalness:.05,transmission:.72,thickness:.35,ior:1.45});
    const profile=[new THREE.Vector2(.02,-.62),new THREE.Vector2(.25,-.58),new THREE.Vector2(.32,-.40),new THREE.Vector2(.29,.18),new THREE.Vector2(.22,.36),new THREE.Vector2(.13,.46),new THREE.Vector2(.13,.68),new THREE.Vector2(.08,.73),new THREE.Vector2(.08,.78),new THREE.Vector2(.02,.78)];
    const bottle=new THREE.Mesh(new THREE.LatheGeometry(profile,24),glass); bottle.scale.set(.9,1.05,.9); bottle.castShadow=true; group.add(bottle);
    const liquid=new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(.025,-.56),new THREE.Vector2(.22,-.52),new THREE.Vector2(.27,-.34),new THREE.Vector2(.25,.06),new THREE.Vector2(.18,.18),new THREE.Vector2(.02,.18)],24),new THREE.MeshPhysicalMaterial({color:c,emissive:type==='specialWater'?a:0x0b4f76,emissiveIntensity:type==='specialWater'?1.0:.15,roughness:.08,metalness:.08,transmission:.12,transparent:true,opacity:.88})); liquid.position.y=-.05; group.add(liquid);
    const cap=new THREE.Mesh(new RoundedBoxGeometry(.2,.16,.2,3,.04),new THREE.MeshStandardMaterial({color:type==='specialWater'?0x182c78:0x1b6d8e,metalness:.65,roughness:.22})); cap.position.y=.78; group.add(cap);
    const glow=new THREE.PointLight(a,type==='specialWater'?1.7:.55,2.2,2); glow.position.set(0,.05,.35); group.add(glow);
  }else{
    const sackShape=new THREE.Shape(); sackShape.moveTo(-.28,-.55); sackShape.quadraticCurveTo(-.4,-.15,-.3,.32); sackShape.quadraticCurveTo(-.2,.48,0,.52); sackShape.quadraticCurveTo(.2,.48,.3,.32); sackShape.quadraticCurveTo(.4,-.15,.28,-.55); sackShape.quadraticCurveTo(0,-.68,-.28,-.55);
    const sackMat=new THREE.MeshStandardMaterial({color:c,roughness:.92,metalness:.02});
    const sack=new THREE.Mesh(new THREE.ExtrudeGeometry(sackShape,{depth:.28,bevelEnabled:true,bevelSegments:3,bevelSize:.035,bevelThickness:.035}),sackMat); sack.position.z=-.14; sack.scale.set(1,.95,.9); sack.castShadow=true; group.add(sack);
    const tie=new THREE.Mesh(new THREE.TorusGeometry(.17,.028,8,28),new THREE.MeshStandardMaterial({color:type==='specialFertilizer'?0xffd45a:0x6d4928,metalness:.5,roughness:.3})); tie.rotation.x=Math.PI/2; tie.position.y=.5; group.add(tie);
    const leaf=new THREE.Mesh(leafGeo,new THREE.MeshStandardMaterial({color:a,roughness:.7,side:THREE.DoubleSide})); leaf.scale.set(.23,.32,.9); leaf.rotation.set(0,.2,.1); leaf.position.set(0,.05,.19); group.add(leaf);
    if(type==='specialFertilizer'){const glow=new THREE.PointLight(a,1.4,2.4,2); glow.position.set(0,.1,.5); group.add(glow);}
  }
  group.rotation.y=.35; return group;
}
function mountRewardIconScenes(){
  const nodes=[...document.querySelectorAll('.reward-3d-icon')].filter(n=>!n.dataset.mounted);
  nodes.forEach(node=>{
    node.dataset.mounted='1';
    const canvas=document.createElement('canvas'); canvas.width=96; canvas.height=96; node.appendChild(canvas);
    const tone=node.dataset.rewardTone; const palette={gold:[0xf0b62f,0xffe06b],purple:[0x8e3cff,0xd78cff],blue:[0x5aa8ff,0xcde9ff]}; const [base,accent]=palette[tone]||palette.blue;
    try{
      const scene=new THREE.Scene(); const camera=new THREE.PerspectiveCamera(30,1,.1,20); camera.position.set(0,.15,3.1); camera.lookAt(0,.05,0);
      const renderer=makeRenderer(canvas); renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.15));
      scene.add(new THREE.HemisphereLight(0xeaffff,0x07101b,2)); const key=new THREE.DirectionalLight(0xffffff,2.5); key.position.set(2,3,3); scene.add(key);
      const mat=new THREE.MeshStandardMaterial({color:base,metalness:.86,roughness:.18}); const trim=new THREE.MeshStandardMaterial({color:0xd9a83a,metalness:.94,roughness:.14});
      const g=new THREE.Group();
      const body=new THREE.Mesh(new RoundedBoxGeometry(1.45,.82,.9,4,.13),mat); body.castShadow=true; g.add(body);
      const lid=new THREE.Mesh(new RoundedBoxGeometry(1.5,.24,.94,4,.08),mat); lid.position.y=.52; lid.castShadow=true; g.add(lid);
      const band=new THREE.Mesh(new RoundedBoxGeometry(.13,.95,.98,3,.035),trim); band.position.y=.12; band.position.z=.02; g.add(band);
      const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.2,1),new THREE.MeshPhysicalMaterial({color:accent,emissive:accent,emissiveIntensity:1.2,roughness:.12,metalness:.25,transmission:.08})); gem.position.set(0,.05,.5); g.add(gem);
      g.rotation.set(-.08,.45,0); scene.add(g);
      const glow=new THREE.PointLight(accent,tone==='gold'?1.7:1.2,2.8,2); glow.position.set(0,.2,.7); scene.add(glow);
      const tick=(now)=>{if(!node.isConnected){renderer.dispose();return;} g.rotation.y=.45+Math.sin(now*.0007)*.08; gem.rotation.y+=.012; resize(renderer,canvas); renderer.setSize(Math.max(1,node.clientWidth),Math.max(1,node.clientHeight),false); camera.aspect=Math.max(1,node.clientWidth)/Math.max(1,node.clientHeight); camera.updateProjectionMatrix(); renderer.render(scene,camera); requestAnimationFrame(tick);}; requestAnimationFrame(tick);
    }catch(err){node.classList.add('reward-3d-fallback'); console.warn('Reward 3D icon unavailable:',err);}
  });
}
function mountTreeItemScenes(){
  const types=['normalWater','specialWater','normalFertilizer','specialFertilizer'];
  const mounted=[];
  types.forEach(type=>{const canvas=$(`#${type}Canvas`); if(!canvas)return; try{const scene=new THREE.Scene(); const camera=new THREE.PerspectiveCamera(28,1,.1,20); camera.position.set(0,.05,3.3); camera.lookAt(0,0,0); const renderer=makeRenderer(canvas); renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25)); const hemi=new THREE.HemisphereLight(0xeaffff,0x09121e,1.9); scene.add(hemi); const key=new THREE.DirectionalLight(0xffffff,2.2); key.position.set(2,3,3); key.castShadow=true; scene.add(key); const model=createTreeItemModel(type); scene.add(model); const floor=new THREE.Mesh(new THREE.CircleGeometry(.72,32),new THREE.MeshBasicMaterial({color:0x07111b,transparent:true,opacity:.48})); floor.rotation.x=-Math.PI/2; floor.position.y=-.67; scene.add(floor); mounted.push({renderer,canvas,scene,camera,model});}catch(err){console.warn('Tree item 3D unavailable:',type,err); canvas.classList.add('webgl-fallback');}});
  const tick=(now)=>{mounted.forEach((x,i)=>{x.model.rotation.y=.35+Math.sin(now*.0007+i)*.08; x.model.rotation.x=Math.sin(now*.0009+i)*.025; resize(x.renderer,x.canvas); x.camera.aspect=x.canvas.clientWidth/Math.max(1,x.canvas.clientHeight); x.camera.updateProjectionMatrix(); x.renderer.render(x.scene,x.camera);}); requestAnimationFrame(tick);}; requestAnimationFrame(tick);
}

function mountWorldTreeScene(){
  const canvas = $('#worldTreeCanvas');
  if (!canvas) return;
  try {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.55, 6.25);
    camera.lookAt(0, 0.35, 0);
    const renderer = makeRenderer(canvas);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.45));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.enablePan = false;
    controls.rotateSpeed = 0.42;
    controls.minDistance = 4.8;
    controls.maxDistance = 7.4;
    controls.minPolarAngle = Math.PI * 0.36;
    controls.maxPolarAngle = Math.PI * 0.60;
    controls.target.set(0, 0.30, 0);

    scene.add(new THREE.HemisphereLight(0xdfffe8, 0x07101b, 1.65));
    const key = new THREE.DirectionalLight(0xffffff, 2.7);
    key.position.set(4.5, 7, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 16;
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -4;
    scene.add(key);
    const green = new THREE.PointLight(0x52f58b, 2.8, 7, 2);
    green.position.set(-2.2, 2.2, 2.0);
    scene.add(green);
    const rim = new THREE.PointLight(0x4c9dff, 1.0, 7, 2);
    rim.position.set(2.4, 0.2, -2.8);
    scene.add(rim);

    const tree = createWorldTreeModel();
    scene.add(tree);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.65, 48),
      new THREE.MeshBasicMaterial({ color: 0x06100a, transparent: true, opacity: 0.32 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.28;
    scene.add(shadow);

    const particleGroup = new THREE.Group();
    const mobile = window.matchMedia?.('(max-width: 700px)').matches;
    const particleCount = mobile ? 12 : 24;
    const particleMat = new THREE.MeshBasicMaterial({ color: 0x74f59a, transparent: true, opacity: 0.58 });
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.018 + Math.random() * 0.018, 0), particleMat);
      p.position.set((Math.random() - 0.5) * 3.4, -0.8 + Math.random() * 3.6, (Math.random() - 0.5) * 1.9);
      p.userData = { phase: Math.random() * Math.PI * 2, speed: 0.25 + Math.random() * 0.35, baseY: p.position.y };
      particleGroup.add(p); particles.push(p);
    }
    scene.add(particleGroup);

    worldTreeScene = {
      updateGrowth: (isPlanted, growth) => tree.userData.updateGrowth(isPlanted, growth),
      dispose: () => {
        controls.dispose();
        renderer.dispose();
        tree.traverse(o => {
          if (!o.isMesh) return;
          o.geometry?.dispose?.();
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
          else o.material?.dispose?.();
        });
      }
    };
    tree.userData.updateGrowth(worldTreeState.planted, worldTreeGrowth);

    const tick = (now) => {
      controls.update();
      tree.userData.animate(now);
      particles.forEach(p => {
        p.position.y = p.userData.baseY + Math.sin(now * 0.00045 * p.userData.speed + p.userData.phase) * 0.12;
        p.position.x += Math.sin(now * 0.00018 + p.userData.phase) * 0.00035;
      });
      resize(renderer, canvas);
      camera.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } catch (err) {
    console.warn('World Tree WebGL unavailable; using visual fallback:', err);
    canvas.classList.add('webgl-fallback');
  }
}

$$('.world-tree-tab').forEach(btn => btn.addEventListener('click', () => {
  $$('.world-tree-tab').forEach(x => x.classList.remove('active')); $$('.world-tree-tab-panel').forEach(x => x.classList.remove('active')); btn.classList.add('active');
  const panel = btn.dataset.treeTab === 'rewards' ? $('#treeRewardsTabPanel') : $('#treeTabPanel'); panel?.classList.add('active');
}));
$$('[data-tree-tab="rewards"]').filter(btn => !btn.classList.contains('world-tree-tab')).forEach(btn => btn.addEventListener('click', () => {
  $$('.world-tree-tab').forEach(x => x.classList.toggle('active', x.dataset.treeTab === 'rewards')); $('#treeTabPanel')?.classList.remove('active'); $('#treeRewardsTabPanel')?.classList.add('active');
}));
$('#plantTreeBtn')?.addEventListener('click', () => changeWorldTree('plant'));
$('#normalWaterBtn')?.addEventListener('click', () => changeWorldTree('normalWater'));
$('#specialWaterBtn')?.addEventListener('click', () => changeWorldTree('specialWater'));
$('#normalFertilizerBtn')?.addEventListener('click', () => changeWorldTree('normalFertilizer'));
$('#specialFertilizerBtn')?.addEventListener('click', () => changeWorldTree('specialFertilizer'));
document.addEventListener('click', e => { const btn=e.target.closest?.('[data-tree-reward]'); if(btn) claimWorldTreeReward(btn.dataset.treeReward); });
mountWorldTreeScene();
mountTreeItemScenes();
updateWorldTreeUI();

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
      <div class="history-icon">${item.image_url ? rewardVisualHtml(item) : item.icon}</div>
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
      image_url: item.image_url || '',
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
    <div class="rarity ${String(b.rarity||'COMMON').toLowerCase()}">${b.rarity||'COMMON'}</div>
  </article>`;
}

const boxGrid = $('#boxGrid');
if(boxGrid) boxGrid.innerHTML = boxes.map(boxMarkup).join('');

function makeRenderer(canvas) {
  const r = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true, powerPreference: 'high-performance'});
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.08;
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
  // Procedural 3D luxury box. Kept API-compatible with the existing opening logic:
  // children[0] owns lidPivot/rewardGroup/rewardMesh.
  const group = new THREE.Group();
  group.name = 'MysteryBox3D';
  const rarity = b.rarity;
  const isLegendary = rarity === 'LEGENDARY';
  const isEpic = rarity === 'EPIC';

  const baseMat = new THREE.MeshStandardMaterial({
    color: b.color,
    metalness: isLegendary ? 0.92 : isEpic ? 0.78 : 0.55,
    roughness: isLegendary ? 0.14 : isEpic ? 0.20 : 0.30,
    envMapIntensity: 1.25
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: isLegendary || isEpic ? 0xf6c94b : 0x9ba7b5,
    metalness: 0.95, roughness: 0.16, envMapIntensity: 1.6
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x080d15, metalness: 0.72, roughness: 0.23, envMapIntensity: 1.1
  });
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0x05070b, metalness: 0.25, roughness: 0.58
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: b.accent, emissive: b.accent,
    emissiveIntensity: isLegendary ? 3.1 : isEpic ? 2.25 : 1.25,
    metalness: 0.28, roughness: 0.14
  });

  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'BoxBody';
  const rounded = (w,h,d,mat,radius=0.08,segments=3) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w,h,d,segments,radius), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  const bottom = rounded(2.30, 0.16, 2.30, darkMat, 0.07);
  bottom.position.y = -0.84;
  bodyGroup.add(bottom);

  const wallFront = rounded(2.26, 1.62, 0.14, baseMat, 0.055);
  wallFront.position.set(0, 0, 1.05);
  bodyGroup.add(wallFront);
  const wallBack = rounded(2.26, 1.62, 0.14, baseMat, 0.055);
  wallBack.position.set(0, 0, -1.05);
  bodyGroup.add(wallBack);
  const wallLeft = rounded(0.14, 1.62, 2.06, baseMat, 0.055);
  wallLeft.position.set(-1.05, 0, 0);
  bodyGroup.add(wallLeft);
  const wallRight = rounded(0.14, 1.62, 2.06, baseMat, 0.055);
  wallRight.position.set(1.05, 0, 0);
  bodyGroup.add(wallRight);

  // Dark recessed interior makes the opening read as a real cavity.
  const cavity = rounded(1.94, 1.34, 1.94, innerMat, 0.06);
  cavity.position.y = 0.03;
  cavity.scale.y = 0.96;
  bodyGroup.add(cavity);

  // Metallic corner guards and horizontal bands.
  const edgeGeo = new RoundedBoxGeometry(0.13, 1.76, 0.13, 3, 0.025);
  [[-1.05,0,-1.05],[1.05,0,-1.05],[-1.05,0,1.05],[1.05,0,1.05]].forEach(([x,y,z]) => {
    const edge = new THREE.Mesh(edgeGeo, trimMat);
    edge.position.set(x,y,z); edge.castShadow = true; bodyGroup.add(edge);
  });
  const bandFront = rounded(2.34, 0.11, 0.10, trimMat, 0.02);
  bandFront.position.set(0, -0.05, 1.12); bodyGroup.add(bandFront);
  const bandBack = rounded(2.34, 0.11, 0.10, trimMat, 0.02);
  bandBack.position.set(0, -0.05, -1.12); bodyGroup.add(bandBack);

  const neonBar = rounded(0.055, 1.42, 0.055, glowMat, 0.018);
  [[-1.115,0,-1.115],[1.115,0,-1.115],[-1.115,0,1.115],[1.115,0,1.115]].forEach(([x,y,z]) => {
    const bar = neonBar.clone(); bar.position.set(x,y,z); bodyGroup.add(bar);
  });

  const lock = rounded(0.48, 0.12, 0.16, trimMat, 0.05);
  lock.position.set(0, 0.08, 1.14); bodyGroup.add(lock);
  const lockGlow = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), glowMat);
  lockGlow.position.set(0, 0.08, 1.24); lockGlow.castShadow = true; bodyGroup.add(lockGlow);

  group.add(bodyGroup);

  const lidPivot = new THREE.Group();
  lidPivot.name = 'LidPivot';
  lidPivot.position.set(0, 0.83, -1.10);
  const lid = rounded(2.38, 0.36, 2.38, (isLegendary || isEpic) ? trimMat : baseMat, 0.10);
  lid.position.set(0, 0.18, 1.10);
  lid.castShadow = true;
  lidPivot.add(lid);

  const lidInset = rounded(1.96, 0.12, 1.96, baseMat, 0.05);
  lidInset.position.set(0, -0.02, 1.10);
  lidPivot.add(lidInset);

  const lidGem = new THREE.Mesh(new THREE.OctahedronGeometry(isLegendary ? 0.32 : 0.26, 0), glowMat);
  lidGem.position.set(0, 0.50, 1.10);
  lidGem.castShadow = true;
  lidPivot.add(lidGem);
  group.add(lidPivot);

  // Visible hinge hardware.
  [-0.58, 0.58].forEach(x => {
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.34,12), trimMat);
    hinge.rotation.z = Math.PI / 2;
    hinge.position.set(x, 0.89, -1.09);
    hinge.castShadow = true;
    group.add(hinge);
  });

  if (isEpic || isLegendary) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.025, 10, 64), glowMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.52;
    group.add(ring);
    group.userData.ring = ring;
  }

  const rewardGroup = new THREE.Group();
  rewardGroup.position.set(0, -0.4, 0);
  rewardGroup.scale.set(0,0,0);
  const rewardGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.84, 20, 20),
    new THREE.MeshBasicMaterial({color:b.accent,transparent:true,opacity:0.30,depthWrite:false,blending:THREE.AdditiveBlending})
  );
  rewardGroup.add(rewardGlow);
  const itemMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 1.45),
    new THREE.MeshBasicMaterial({map:createTextTexture(b.icon),transparent:true,side:THREE.DoubleSide,depthWrite:false})
  );
  itemMesh.position.z = 0.12;
  rewardGroup.add(itemMesh);
  group.add(rewardGroup);

  group.userData.lidPivot = lidPivot;
  group.userData.gem = lidGem;
  group.userData.ring = group.userData.ring || null;
  group.userData.rewardGroup = rewardGroup;
  group.userData.rewardMesh = itemMesh;

  const root = new THREE.Group();
  root.add(group);
  const light = new THREE.PointLight(b.accent, isLegendary ? 6.5 : isEpic ? 4.0 : 2.6, 6.5, 2);
  light.position.set(0, 0.2, 0.8);
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
  
  let renderer;
  try {
    renderer = makeRenderer(canvas);
  } catch (err) {
    console.warn('Mystery Box WebGL unavailable; using visual fallback:', err);
    canvas.classList.add('webgl-fallback');
    return null;
  }
  const controls = interactive ? new OrbitControls(camera, renderer.domElement) : null;
  if(controls) {
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 3.5;
    controls.maxDistance = 7.5;
    controls.target.set(0, 0, 0);
  }
  
  scene.add(new THREE.HemisphereLight(0xe7efff, 0x070b12, 1.15));
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.72);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 3.1);
  mainLight.position.set(4.5, 7.5, 4.5);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.set(interactive ? 1024 : 512, interactive ? 1024 : 512);
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 15;
  mainLight.shadow.camera.left = -4;
  mainLight.shadow.camera.right = 4;
  mainLight.shadow.camera.top = 4;
  mainLight.shadow.camera.bottom = -4;
  scene.add(mainLight);

  const fillLight = new THREE.PointLight(b.accent, 1.7, 7, 2);
  fillLight.position.set(-3, 1.0, 3.5);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0x7aa7ff, 0.75, 7, 2);
  rimLight.position.set(2.5, 1.8, -3);
  scene.add(rimLight);

  const boxObj = createLuxuryBox(b);
  boxObj.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
  scene.add(boxObj);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(2.25, 64),
    new THREE.MeshStandardMaterial({color: 0x07101b, metalness: 0.18, roughness: 0.55, transparent: true, opacity: 0.94})
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.20;
  floor.receiveShadow = true;
  scene.add(floor);

  const glowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1.95, 64),
    new THREE.MeshBasicMaterial({color:b.accent,transparent:true,opacity:0.10,depthWrite:false,blending:THREE.AdditiveBlending})
  );
  glowDisc.rotation.x = -Math.PI / 2;
  glowDisc.position.y = -1.18;
  scene.add(glowDisc);

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

let hero = null;
boxes.forEach((b, i) => {
  const c = $(`#cardCanvas${i}`);
  if(c) mountScene(c, b, false);
});

const openCanvas = $('#openCanvas');
let openScene = null;
if(openCanvas) openScene = mountScene(openCanvas, boxes[4], true);

function getInventoryCacheKey() {
  const userId = online?.user?.id;
  return userId ? `mystery_box_pending_inventory_${userId}` : null;
}

function cacheInventoryLocally(items) {
  const key = getInventoryCacheKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(Array.isArray(items) ? items : []));
  } catch (err) {
    console.warn('Local inventory cache unavailable:', err);
  }
}

function readInventoryCache() {
  const key = getInventoryCacheKey();
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

async function saveCloudInventory() {
  // Keep a per-account local copy first. This prevents a refresh from
  // clearing a reward if the network request is interrupted. Supabase is
  // still the source of truth whenever the save succeeds.
  cacheInventoryLocally(rewards);
  try {
    const saved = await online.saveInventory(rewards);
    if (saved !== true) throw new Error('บันทึกคลังรางวัลไม่สำเร็จ');
    // A successful empty save is important after the user requests a reward:
    // clear the matching local cache only after Supabase has accepted it.
    cacheInventoryLocally(rewards);
    return true;
  } catch (err) {
    console.warn('Online inventory save unavailable:', err);
    return false;
  }
}

async function loadCloudInventory() {
  try {
    const cloudInventory = await online.getInventory();
    if (Array.isArray(cloudInventory)) {
      rewards = cloudInventory;
      cacheInventoryLocally(rewards);
      renderInventory();
      return true;
    }

    // No player_inventory row yet. If a previous reward was generated while
    // the first cloud save was interrupted, keep the per-account local copy
    // and retry it instead of treating the missing row as an empty inventory.
  } catch (err) {
    console.warn('Online inventory load unavailable:', err);
  }

  // If Supabase is temporarily unavailable, restore this account's own
  // pending inventory instead of replacing it with an empty array.
  const cached = readInventoryCache();
  if (cached !== null) {
    rewards = cached;
    renderInventory();
    // Retry the cloud write in the background so the inventory becomes
    // persistent again as soon as the connection/RLS issue is resolved.
    if (online?.user) saveCloudInventory().catch(() => {});
    return false;
  }

  return false;
}

// แสดงผลคลังรางวัลที่หน้าแรก
function renderInventory() {
  const el = $('#inventoryGrid');
  if(!el) return;
  el.innerHTML = rewards.slice(0, 10).map(r => 
    `<div class="item">
      <div class="item-visual">${rewardVisualHtml(r)}</div>
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
          <span class="icon">${rewardVisualHtml(r)}</span>
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
      btn.onclick = async () => {
        const id = Number(btn.dataset.id);
        const item = rewards.find(x => Number(x.id) === id);
        if (!item) return;
        btn.disabled = true;
        try {
          await online.createRewardClaim([id]);
          rewards = rewards.filter(x => Number(x.id) !== id);
          cacheInventoryLocally(rewards);
          renderInventory();
          openInventoryModal();
          toast('ส่งคำขอรับรางวัลให้แอดมินแล้ว');
        } catch (err) {
          console.error('Reward claim failed:', err);
          btn.disabled = false;
          toast(err?.message || 'ส่งคำขอรับรางวัลไม่สำเร็จ กรุณาลองใหม่');
        }
      };
    });
  }

  modal.classList.remove('hidden');
}

// ขอรับรางวัลทั้งหมดในคลัง
const claimAllBtn = $('#claimAllBtn');
if(claimAllBtn) {
  claimAllBtn.onclick = async () => {
    if(rewards.length === 0) {
      toast('ไม่มีรางวัลในคลังให้ขอรับ');
      return;
    }
    claimAllBtn.disabled = true;
    try {
      await online.createRewardClaim(null);
      rewards = [];
      cacheInventoryLocally(rewards);
      renderInventory();
      openInventoryModal();
      toast('ส่งคำขอรับรางวัลทั้งหมดให้แอดมินแล้ว');
    } catch (err) {
      console.error('Reward claim all failed:', err);
      toast(err?.message || 'ส่งคำขอรับรางวัลไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      claimAllBtn.disabled = false;
    }
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
  worldTreeState = JSON.parse(JSON.stringify(DEFAULT_WORLD_TREE_STATE));
  worldTreeGrowth = 0;
  updateWorldTreeUI();
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
    await loadCloudInventory();
    await loadWorldTree();
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
    // Restart live balance polling after a manual login. Logout stops it.
    startLiveBalanceSync();
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
    await loadCloudInventory();
    // A newly registered account must also start the live balance sync.
    // Without this, top-up approval would only appear after F5 because
    // logout had stopped the previous account's polling timer.
    startLiveBalanceSync();
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
    stopLiveBalanceSync();
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

let liveBalanceTimer = null;

function startLiveBalanceSync() {
  if (liveBalanceTimer) clearInterval(liveBalanceTimer);
  liveBalanceTimer = setInterval(async () => {
    try {
      if (!online.user) return;
      const currentUser = await online.refreshAuthenticatedUser();
      if (!currentUser) return;
      const profile = await online.getCurrentProfile();
      if (!profile || currentUser.id !== profile.id) return;
      const nextCoins = Number(profile.coins);
      if (Number.isFinite(nextCoins) && nextCoins !== points) {
        points = nextCoins;
        syncPoints();
      }
    } catch (err) {
      console.warn('Live balance sync unavailable:', err);
    }
  }, 2000);
}

function stopLiveBalanceSync() {
  if (liveBalanceTimer) {
    clearInterval(liveBalanceTimer);
    liveBalanceTimer = null;
  }
}

applyRemoteBoxSettings();

online.init().then(async profile => {
  await applyRemoteBoxSettings();
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
  await loadCloudInventory();
  await loadWorldTree();
  startLiveBalanceSync();
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
        <span class="prize-icon">${w.image_url ? rewardVisualHtml(w) : w.icon}</span>
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

function addWinnerRecord(prizeName, rarity, icon, boxName, image_url='') {
  const newRecord = {
    id: Date.now() + Math.random(),
    username: 'Player_' + Math.floor(1000 + Math.random() * 9000),
    prizeName,
    rarity,
    icon,
    image_url,
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

// Opening-box sound effects only: short "ฟุ๊ง" pulses during spin + bright "ฟิ๊ง" when the lid opens.
let boxSoundCtx = null;
let boxSpinSoundTimer = null;

function getBoxSoundContext() {
  try {
    if (!boxSoundCtx) boxSoundCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (boxSoundCtx.state === 'suspended') boxSoundCtx.resume();
    return boxSoundCtx;
  } catch (_) {
    return null;
  }
}

function playSpinWhoosh() {
  const ctx = getBoxSoundContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.16);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1800, now);
  filter.frequency.exponentialRampToValueAtTime(700, now + 0.16);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.055, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.18);
}

function startBoxSpinSound() {
  stopBoxSpinSound();
  playSpinWhoosh();
  boxSpinSoundTimer = setInterval(playSpinWhoosh, 320);
}

function stopBoxSpinSound() {
  if (boxSpinSoundTimer) {
    clearInterval(boxSpinSoundTimer);
    boxSpinSoundTimer = null;
  }
}

function playBoxOpenChime() {
  const ctx = getBoxSoundContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  [880, 1320, 1760].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + i * 0.035);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.08, now + i * 0.035 + 0.45);
    gain.gain.setValueAtTime(0.0001, now + i * 0.035);
    gain.gain.exponentialRampToValueAtTime(0.13 - i * 0.02, now + i * 0.035 + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.035 + 0.65);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.035);
    osc.stop(now + i * 0.035 + 0.68);
  });
}

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

function pickWeightedReward(b) {
  const rewards = Array.isArray(b.rewards) ? b.rewards.filter(r => Number(r.drop_rate) > 0 && String(r.name||'').trim()) : [];
  if (!rewards.length) return null;
  const total = rewards.reduce((sum,r) => sum + Number(r.drop_rate || 0), 0);
  let roll = Math.random() * total;
  for (const reward of rewards) {
    roll -= Number(reward.drop_rate || 0);
    if (roll < 0) return reward;
  }
  return rewards[rewards.length - 1];
}

function rewardVisualHtml(item, cls='') {
  const image = item?.image_url || '';
  return image
    ? `<img class="reward-image ${cls}" src="${String(image).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" alt="${String(item?.name||'รางวัล').replace(/[&<>]/g,'')}" loading="lazy">`
    : `<span class="reward-icon-fallback ${cls}">${item?.icon || '🎁'}</span>`;
}

async function applyRemoteBoxSettings() {
  try {
    const remote = await online.getBoxSettings();
    if (!Array.isArray(remote) || remote.length !== 5) return;
    const byId = new Map(remote.map(b => [String(b.id), b]));
    boxes = defaultBoxes.map(def => {
      const b = byId.get(def.id);
      if (!b) return {...def, rewards:def.rewards.map(r=>({...r}))};
      const rewards = Array.isArray(b.rewards) ? b.rewards.map((r,i)=>({
        id:String(r.id || `${def.id}-item-${i+1}`),
        name:String(r.name || `รางวัล ${i+1}`),
        rarity:String(r.rarity || b.rarity || def.rarity),
        drop_rate:Number(r.drop_rate || 0),
        image_url:String(r.image_url || '')
      })) : [];
      return {...def,...b,price:Number(b.price||0),color:Number(b.color||def.color),accent:Number(b.accent||def.accent),rewards};
    });
    // Update only the five box cards and their 3D scenes. All other systems stay untouched.
    if (boxGrid) {
      boxes.forEach((b,i)=>{
        const card=boxGrid.querySelector(`.box-card[data-i="${i}"]`);
        if(!card) return;
        const price=card.querySelector('.price'); if(price) price.textContent=`🪙 ${b.price}`;
        const title=card.querySelector('h3'); if(title) title.textContent=b.name;
        const en=card.querySelector('p'); if(en) en.textContent=b.en || '';
        const rarity=card.querySelector('.rarity');
        if(rarity){ rarity.textContent=b.rarity; rarity.className=`rarity ${String(b.rarity||'COMMON').toLowerCase()}`; }
      });
    }
    // Refresh the already-mounted card scenes so Admin changes are visible without a page refresh.
    if (Array.isArray(scenes)) {
      scenes.forEach((sceneObj,i)=>{
        if (!sceneObj || !boxes[i]) return;
        sceneObj.scene.remove(sceneObj.box);
        sceneObj.box=createLuxuryBox(boxes[i]);
        sceneObj.data=boxes[i];
        sceneObj.scene.add(sceneObj.box);
      });
    }
    if (openScene && boxes[selected]) {
      const b=boxes[selected];
      openScene.scene.remove(openScene.box);
      openScene.box=createLuxuryBox(b);
      openScene.data=b;
      openScene.scene.add(openScene.box);
    }
  } catch (err) {
    console.warn('Box settings unavailable; using defaults:', err);
  }
}

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
              <div class="result-item-icon">${rewardVisualHtml(item)}</div>
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
      const reward = pickWeightedReward(b);
      if (!reward) {
        rolling = false;
        hasClaimed = true;
        rollBtn.disabled = false;
        toast('กล่องนี้ยังไม่มีอัตราดรอปที่ใช้งานได้');
        return;
      }
      lastRolledItems.push({
        id: Date.now() + Math.random(),
        reward_id: reward.id,
        name: reward.name,
        rarity: reward.rarity || b.rarity,
        icon: b.icon,
        image_url: reward.image_url || ''
      });
    }

    const mainReward = lastRolledItems[0];
    
    if(rewardMesh) {
      rewardMesh.material.map = createTextTexture(mainReward.icon);
      rewardMesh.material.needsUpdate = true;
      if (mainReward.image_url) {
        try {
          const texture = await new THREE.TextureLoader().loadAsync(mainReward.image_url);
          texture.colorSpace = THREE.SRGBColorSpace;
          rewardMesh.material.map = texture;
          rewardMesh.material.needsUpdate = true;
        } catch (imageErr) {
          console.warn('Reward image unavailable, using icon:', imageErr);
        }
      }
    }

    lidPivot.rotation.x = 0;
    rewardGroup.scale.set(0, 0, 0);
    rewardGroup.position.set(0, -0.4, 0);

    const startTime = performance.now();
    const spinDuration = 2000; 
    const totalRounds = 6;     
    startBoxSpinSound();

    function animateSpinAndOpen(now) {
      const elapsed = now - startTime;

      if (elapsed < spinDuration) {
        const spinProgress = elapsed / spinDuration;
        const easeOut = 1 - Math.pow(1 - spinProgress, 3);
        openScene.box.rotation.y = easeOut * (Math.PI * 2 * totalRounds);
        requestAnimationFrame(animateSpinAndOpen);
      } else {
        stopBoxSpinSound();
        openScene.box.rotation.y = 0;
        playBoxOpenChime();

        const openStartTime = performance.now();
        const openDuration = 1200;

        async function animatePopup(popupNow) {
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
            // บันทึกรางวัลทั้งหมดลงคลังทันที และต้องรอให้การบันทึกเสร็จ
            // ก่อนถือว่ารางวัลถูกบันทึกเรียบร้อย เพื่อให้กดรีเฟรชเมื่อไรก็ยังอยู่
            // จนกว่าจะมีการขอรับรางวัล
            addRollHistory(lastRolledItems, b.name);
            lastRolledItems.forEach(item => {
              rewards.unshift(item);
              addWinnerRecord(item.name, item.rarity || b.rarity, item.icon, b.name, item.image_url || '');
            });
            const inventorySaved = await saveCloudInventory();
            renderInventory();
            if (!inventorySaved) {
              toast('รางวัลถูกเก็บไว้แล้ว แต่กำลังรอบันทึกออนไลน์');
            }
            
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
  ['.world-tree-panel', '.content', '.bottom-grid'].forEach(sel => document.querySelector(sel)?.classList.add('hidden'));
  $('#accountPage')?.classList.remove('hidden');
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function showHomePage() {
  ['.world-tree-panel', '.content', '.bottom-grid'].forEach(sel => document.querySelector(sel)?.classList.remove('hidden'));
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
  else if(p === 'home') { showHomePage(); document.querySelector('.world-tree-panel')?.scrollIntoView({behavior: 'smooth'}); }
});

$('#accountPageLogout')?.addEventListener('click', async () => {
  const btn = $('#accountPageLogout');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังออกจากระบบ...'; }
  try {
    await online.signOut();
    stopLiveBalanceSync();
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