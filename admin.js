import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ENABLED } from './supabase-config.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const loginPanel=$('#loginPanel'), adminPanel=$('#adminPanel'), loginForm=$('#loginForm');
const loginMessage=$('#loginMessage'), statusEl=$('#adminStatus'), listEl=$('#topupList'), userList=$('#userList');
let client=null, topups=[], users=[], rewardClaims=[], boxSettings=[];
let userPage=1, userPageSize=20, userTotal=0;

function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function getClient(){if(!SUPABASE_ENABLED)throw new Error('ยังไม่ได้ตั้งค่า Supabase');if(!client)client=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'mystery-box-admin-auth'}});return client;}

async function ensureAdmin(){
 const c=getClient(),{data:{session}}=await c.auth.getSession();
 if(!session){loginPanel.classList.remove('hidden');adminPanel.classList.add('hidden');return false;}
 let isAdmin=false, adminCheckError=null;
 try{
   const {data,error}=await c.rpc('is_admin');
   adminCheckError=error||null;
   isAdmin=data===true;
 }catch(e){ adminCheckError=e; }

 // Compatibility fallback for projects where the is_admin RPC was not
 // reloaded correctly. This only reads the current user's admin_users row.
 if(!isAdmin){
   try{
     const {data,error}=await c.from('admin_users').select('user_id').eq('user_id',session.user.id).maybeSingle();
     if(!error && data && data.user_id===session.user.id) isAdmin=true;
   }catch(e){}
 }

 if(!isAdmin){
   await c.auth.signOut();
   loginPanel.classList.remove('hidden');adminPanel.classList.add('hidden');
   loginMessage.textContent=adminCheckError?.message || 'บัญชีนี้ไม่มีสิทธิ์แอดมิน';
   return false;
 }
 loginPanel.classList.add('hidden');adminPanel.classList.remove('hidden');return true;
}

const DEFAULT_BOX_COLORS = [9080486,2277376,2443487,9641722,14251010];
const DEFAULT_BOX_ACCENTS = [7119497,4849904,3716095,12617724,16638297];
const BOX_RARITIES = ['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY'];
const DEFAULT_BOX_SETTINGS = [
 {id:'box1',name:'กล่องธรรมดา',en:'Food Box',price:1,rarity:'COMMON',color:9080486,accent:7119497,icon:'🍔',rewards:[
  {id:'box1-item1',name:'ชุดอาหารพรีเมียม',rarity:'COMMON',drop_rate:25,image_url:''},{id:'box1-item2',name:'ขนมนำเข้า',rarity:'COMMON',drop_rate:25,image_url:''},{id:'box1-item3',name:'เครื่องดื่ม',rarity:'COMMON',drop_rate:25,image_url:''},{id:'box1-item4',name:'บะหมี่พิเศษ',rarity:'COMMON',drop_rate:25,image_url:''}]},
 {id:'box2',name:'กล่องหายาก',en:'Fashion Box',price:2,rarity:'UNCOMMON',color:2277376,accent:4849904,icon:'👕',rewards:[
  {id:'box2-item1',name:'เสื้อยืดแฟชั่น',rarity:'UNCOMMON',drop_rate:25,image_url:''},{id:'box2-item2',name:'หมวก',rarity:'UNCOMMON',drop_rate:25,image_url:''},{id:'box2-item3',name:'กระเป๋า',rarity:'UNCOMMON',drop_rate:25,image_url:''},{id:'box2-item4',name:'รองเท้า',rarity:'UNCOMMON',drop_rate:25,image_url:''}]},
 {id:'box3',name:'กล่องแรร์',en:'Utility Box',price:3,rarity:'RARE',color:2443487,accent:3716095,icon:'◉',rewards:[
  {id:'box3-item1',name:'หูฟัง',rarity:'RARE',drop_rate:25,image_url:''},{id:'box3-item2',name:'แก้วเก็บอุณหภูมิ',rarity:'RARE',drop_rate:25,image_url:''},{id:'box3-item3',name:'อุปกรณ์โต๊ะ',rarity:'RARE',drop_rate:25,image_url:''},{id:'box3-item4',name:'ของใช้พรีเมียม',rarity:'RARE',drop_rate:25,image_url:''}]},
 {id:'box4',name:'กล่องอีพิค',en:'Big Prize',price:4,rarity:'EPIC',color:9641722,accent:12617724,icon:'🎁',rewards:[
  {id:'box4-item1',name:'บัตรของขวัญ',rarity:'EPIC',drop_rate:25,image_url:''},{id:'box4-item2',name:'สินค้า Limited',rarity:'EPIC',drop_rate:25,image_url:''},{id:'box4-item3',name:'ของสะสม',rarity:'EPIC',drop_rate:25,image_url:''},{id:'box4-item4',name:'รางวัลพิเศษ',rarity:'EPIC',drop_rate:25,image_url:''}]},
 {id:'box5',name:'กล่องเลเจนด์',en:'Legend Box',price:5,rarity:'LEGENDARY',color:14251010,accent:16638297,icon:'♛',rewards:[
  {id:'box5-item1',name:'iPhone 15 Pro Max',rarity:'LEGENDARY',drop_rate:25,image_url:''},{id:'box5-item2',name:'AirPods Pro 2',rarity:'LEGENDARY',drop_rate:25,image_url:''},{id:'box5-item3',name:'รางวัลใหญ่',rarity:'LEGENDARY',drop_rate:25,image_url:''},{id:'box5-item4',name:'สินค้า Rare',rarity:'LEGENDARY',drop_rate:25,image_url:''}]}
].map(b=>({...b,rewards:b.rewards.map(r=>({...r}))}));

function makeRewardId(boxId){ return `${boxId}-item-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
function rewardImageHtml(url, label='รูป'){ return url ? `<img class="reward-image-preview" src="${escapeHtml(url)}" alt="${escapeHtml(label)}">` : '<div class="reward-image-empty">🖼️</div>'; }

function renderBoxAdmin(){
 const el=$('#boxAdminList'); if(!el) return;
 if(!boxSettings.length){el.innerHTML='<div class="empty">ไม่พบการตั้งค่ากล่อง กรุณารัน BOX_SETTINGS_SETUP.sql ก่อน</div>';return;}
 el.innerHTML=boxSettings.map((b,bi)=>{
   const rewards=Array.isArray(b.rewards)?b.rewards:[];
   const total=rewards.reduce((sum,r)=>sum+Number(r.drop_rate||0),0);
   return `<article class="box-admin-card" data-box-id="${escapeHtml(b.id)}">
     <div class="box-admin-title"><div><h3>${bi+1}. ${escapeHtml(b.name||b.id)}</h3><span class="meta">${escapeHtml(b.id)} • ${escapeHtml(b.rarity||'COMMON')}</span></div><span class="drop-total ${Math.abs(total-100)<0.001?'ok':'warn'}">รวมดรอป ${total.toFixed(2)}%</span></div>
     <div class="box-fields">
       <label>ชื่อกล่อง<input data-box-field="name" value="${escapeHtml(b.name||'')}"></label>
       <label>ชื่ออังกฤษ<input data-box-field="en" value="${escapeHtml(b.en||'')}"></label>
       <label>ราคา (เหรียญ)<input data-box-field="price" type="number" min="0" step="1" value="${Number(b.price||0)}"></label>
       <label>ระดับกล่อง<select data-box-field="rarity">${BOX_RARITIES.map(r=>`<option value="${r}" ${r===b.rarity?'selected':''}>${r}</option>`).join('')}</select></label>
     </div>
     <div class="reward-admin-head"><h4>🎁 ของรางวัลในกล่อง</h4><button class="copy-btn add-reward-btn" data-box-add="${escapeHtml(b.id)}">＋ เพิ่มรางวัล</button></div>
     <div class="reward-admin-list">${rewards.map((r,ri)=>renderRewardRow(b,r,ri)).join('')}</div>
   </article>`;
 }).join('');
 bindBoxAdminEvents();
}

function renderRewardRow(b,r,ri){
 return `<div class="reward-admin-row" data-reward-index="${ri}" data-reward-id="${escapeHtml(r.id||makeRewardId(b.id))}">
   <div class="reward-admin-image">${rewardImageHtml(r.image_url,r.name)}</div>
   <div class="reward-admin-main">
     <label>ชื่อรางวัล<input data-reward-field="name" value="${escapeHtml(r.name||'')}"></label>
     <label>ระดับ<select data-reward-field="rarity">${BOX_RARITIES.map(x=>`<option value="${x}" ${x===(r.rarity||b.rarity)?'selected':''}>${x}</option>`).join('')}</select></label>
     <label>อัตราดรอป (%)<input data-reward-field="drop_rate" type="number" min="0" step="0.01" value="${Number(r.drop_rate||0)}"></label>
     <label>รูปภาพ<input data-reward-upload="1" type="file" accept="image/*"><input data-reward-image-url="1" type="hidden" value="${escapeHtml(r.image_url||'')}"></label>
     <div class="reward-file-note">${r.image_url?'แนบรูปแล้ว • เปลี่ยนรูปได้':'ยังไม่มีรูป • แนบรูปเพื่อให้แสดงตอนเปิดกล่อง'}</div>
   </div>
   <button class="reject-btn remove-reward-btn" data-box-remove="${escapeHtml(b.id)}" data-reward-index="${ri}">ลบ</button>
 </div>`;
}

function collectBoxAdmin(){
 return boxSettings.map((b,bi)=>{
   const card=$(`.box-admin-card[data-box-id="${CSS.escape(b.id)}"]`);
   if(!card) return b;
   const getField=n=>card.querySelector(`[data-box-field="${n}"]`)?.value ?? '';
   const rewards=[...card.querySelectorAll('.reward-admin-row')].map((row,ri)=>{
     const rawRate=row.querySelector('[data-reward-field="drop_rate"]')?.value ?? '0';
     const rate=Number(rawRate);
     return {
       id: row.dataset.rewardId || (b.rewards?.[ri]?.id || makeRewardId(b.id)),
       name: row.querySelector('[data-reward-field="name"]')?.value.trim() || '',
       rarity: row.querySelector('[data-reward-field="rarity"]')?.value || b.rarity || 'COMMON',
       drop_rate: Number.isFinite(rate) && rate >= 0 ? rate : 0,
       image_url: row.querySelector('[data-reward-image-url]')?.value || ''
     };
   });
   const rawPrice=Number(getField('price'));
   return {...b,name:getField('name').trim(),en:getField('en').trim(),price:Number.isFinite(rawPrice)?Math.max(0,Math.floor(rawPrice)):0,rarity:getField('rarity')||b.rarity,rewards};
 });
}

function bindBoxAdminEvents(){
 $$('.add-reward-btn').forEach(btn=>btn.onclick=()=>{
   boxSettings=collectBoxAdmin();
   const b=boxSettings.find(x=>x.id===btn.dataset.boxAdd); if(!b) return;
   if(!Array.isArray(b.rewards)) b.rewards=[];
   b.rewards.push({id:makeRewardId(b.id),name:'รางวัลใหม่',rarity:b.rarity||'COMMON',drop_rate:0,image_url:''});
   renderBoxAdmin();
 });
 $$('.remove-reward-btn').forEach(btn=>btn.onclick=()=>{
   boxSettings=collectBoxAdmin();
   const b=boxSettings.find(x=>x.id===btn.dataset.boxRemove); if(!b) return;
   const i=Number(btn.dataset.rewardIndex); if(!Array.isArray(b.rewards)) return;
   if(b.rewards.length<=1){alert('แต่ละกล่องต้องมีรางวัลอย่างน้อย 1 ชิ้น');return;}
   b.rewards.splice(i,1); renderBoxAdmin();
 });
 $$('[data-reward-upload]').forEach(input=>input.onchange=async()=>{
   const file=input.files?.[0]; if(!file) return;
   if(!file.type.startsWith('image/')){alert('กรุณาเลือกไฟล์รูปภาพ');input.value='';return;}
   if(file.size>8*1024*1024){alert('รูปใหญ่เกิน 8MB');input.value='';return;}
   const row=input.closest('.reward-admin-row');
   const old=input.closest('.reward-admin-main')?.querySelector('[data-reward-image-url]')?.value||'';
   input.disabled=true;
   try{
     const safe=String(file.name||'reward').replace(/[^a-zA-Z0-9._-]/g,'_');
     const path=`${Date.now()}_${crypto.randomUUID()}_${safe}`;
     const {error}=await getClient().storage.from('box-reward-images').upload(path,file,{cacheControl:'31536000',upsert:false,contentType:file.type});
     if(error) throw error;
     const {data}=getClient().storage.from('box-reward-images').getPublicUrl(path);
     const hidden=row.querySelector('[data-reward-image-url]'); if(hidden) hidden.value=data.publicUrl;
     const preview=row.querySelector('.reward-admin-image'); if(preview) preview.innerHTML=rewardImageHtml(data.publicUrl,'รางวัล');
     const note=row.querySelector('.reward-file-note'); if(note) note.textContent='แนบรูปแล้ว • เปลี่ยนรูปได้';
     if(old && old!==data.publicUrl) { /* old public object is intentionally left untouched */ }
   }catch(err){alert(err?.message||'อัปโหลดรูปไม่สำเร็จ');input.value='';}
   finally{input.disabled=false;}
 });
}

async function loadBoxSettings(){
 const c=getClient();
 let data=null, error=null;
 // Preferred path: admin RPC.
 ({data,error}=await c.rpc('admin_list_box_settings'));
 // Fallback to direct SELECT so the page still renders if the RPC was not reloaded yet.
 if(error){
   const direct=await c.from('box_settings').select('*').order('id');
   data=direct.data; error=direct.error;
 }
 if(error) throw error;
 boxSettings=(data||[]).map(b=>({...b,rewards:Array.isArray(b.rewards)?b.rewards:[]}));
 renderBoxAdmin();
}

async function saveOneBox(b){
 const total=b.rewards.reduce((s,r)=>s+Number(r.drop_rate||0),0);
 if(!b.name) throw new Error(`กล่อง ${b.id}: กรุณาใส่ชื่อกล่อง`);
 if(!b.rewards.length) throw new Error(`กล่อง ${b.name}: ต้องมีรางวัลอย่างน้อย 1 ชิ้น`);
 if(b.rewards.some(r=>!r.name)) throw new Error(`กล่อง ${b.name}: ชื่อรางวัลห้ามว่าง`);
 if(b.rewards.some(r=>!Number.isFinite(Number(r.drop_rate)) || Number(r.drop_rate)<0)) throw new Error(`กล่อง ${b.name}: อัตราดรอปไม่ถูกต้อง`);
 if(Math.abs(total-100)>0.001) throw new Error(`กล่อง ${b.name}: อัตราดรอปรวมต้องเท่ากับ 100% (ตอนนี้ ${total.toFixed(2)}%)`);

 const row={
   id:String(b.id),
   name:String(b.name).trim(),
   en:String(b.en||'').trim(),
   price:Math.max(0,Math.floor(Number(b.price)||0)),
   rarity:b.rarity||'COMMON',
   color:Number(b.color)||9080486,
   accent:Number(b.accent)||7119497,
   icon:b.icon||'🎁',
   rewards:Array.isArray(b.rewards)?b.rewards.map(r=>({
     id:String(r.id),
     name:String(r.name||'').trim(),
     rarity:r.rarity||b.rarity||'COMMON',
     drop_rate:Number(r.drop_rate)||0,
     image_url:String(r.image_url||'')
   })):[],
   updated_at:new Date().toISOString(),
   updated_by:null
 };

 const c=getClient();
 // Direct database write. RLS below is restricted to admin_users, so this
 // does not depend on any RPC name/version being installed.
 const {data,error}=await c.from('box_settings').upsert(row,{onConflict:'id'}).select('*').single();
 if(error) throw new Error(`กล่อง ${b.id}: ${error.message||'บันทึกไม่สำเร็จ'}`);
 if(!data || data.id!==b.id) throw new Error(`กล่อง ${b.id}: ไม่ได้รับข้อมูลยืนยันจากฐานข้อมูล`);
 return data;
}

async function saveBoxSettings(){
 const btn=$('#saveBoxesBtn'); const msg=$('#boxMessage');
 const ok=window.confirm('คุณต้องการบันทึกการตั้งค่ากล่องและของรางวัลทั้งหมดใช่ไหม?\n\nเมื่อกดยืนยัน ระบบจะบันทึกลงฐานข้อมูลจริง แล้วรีเฟรชหน้าแอดมิน');
 if(!ok) return;
 if(btn) btn.disabled=true;
 if(msg) msg.textContent='กำลังบันทึก...';
 try{
   const rows=collectBoxAdmin();
   // Validate everything before writing anything.
   for(const b of rows){
     const total=b.rewards.reduce((sum,r)=>sum+Number(r.drop_rate||0),0);
     if(!b.name) throw new Error(`กล่อง ${b.id}: กรุณาใส่ชื่อกล่อง`);
     if(!b.rewards.length) throw new Error(`กล่อง ${b.name}: ต้องมีรางวัลอย่างน้อย 1 ชิ้น`);
     if(b.rewards.some(r=>!r.name)) throw new Error(`กล่อง ${b.name}: ชื่อรางวัลห้ามว่าง`);
     if(b.rewards.some(r=>!Number.isFinite(Number(r.drop_rate)) || Number(r.drop_rate)<0)) throw new Error(`กล่อง ${b.name}: อัตราดรอปไม่ถูกต้อง`);
     if(Math.abs(total-100)>0.001) throw new Error(`กล่อง ${b.name}: อัตราดรอปรวมต้องเท่ากับ 100% (ตอนนี้ ${total.toFixed(2)}%)`);
   }

   const c=getClient();
   for(let i=0;i<rows.length;i++){
     if(msg) msg.textContent=`กำลังบันทึกกล่อง ${i+1}/${rows.length}...`;
     await saveOneBox(rows[i]);
   }

   // Read the rows back from the real database before allowing the refresh.
   if(msg) msg.textContent='กำลังตรวจสอบข้อมูลที่บันทึก...';
   const verify=await c.from('box_settings').select('id,name,en,price,rarity,color,accent,icon,rewards').order('id');
   if(verify.error) throw verify.error;
   const saved=verify.data||[];
   for(const wanted of rows){
     const actual=saved.find(x=>x.id===wanted.id);
     if(!actual) throw new Error(`ไม่พบ ${wanted.id} ในฐานข้อมูลหลังบันทึก`);
     if(String(actual.name)!==String(wanted.name) ||
        String(actual.en||'')!==String(wanted.en||'') ||
        Number(actual.price)!==Number(wanted.price) ||
        String(actual.rarity)!==String(wanted.rarity) ||
        JSON.stringify(actual.rewards||[])!==JSON.stringify(wanted.rewards||[])){
       throw new Error(`ตรวจสอบหลังบันทึกไม่ผ่านสำหรับ ${wanted.id}`);
     }
   }

   // The requested behavior: once the database write and verification both
   // succeed, reset the Admin page. Supabase auth persists across reloads.
   window.location.reload();
 }catch(err){
   console.error('saveBoxSettings:',err);
   if(msg) msg.textContent=`บันทึกไม่สำเร็จ: ${err?.message||'เกิดข้อผิดพลาด'}`;
   if(btn) btn.disabled=false;
 }
}

function renderStats(){
 const pending=topups.filter(x=>x.status==='pending').length, approved=topups.filter(x=>x.status==='approved').length;
 const total=topups.filter(x=>x.status==='approved').reduce((s,x)=>s+Number(x.amount||0),0);
 $('#stats').innerHTML=`<div class="stat"><b>${pending}</b><span>รอตรวจสอบ</span></div><div class="stat"><b>${approved}</b><span>อนุมัติแล้ว</span></div><div class="stat"><b>${total.toLocaleString()}</b><span>ยอดอนุมัติ (บาท)</span></div><div class="stat"><b>${users.length}</b><span>ผู้เล่น</span></div>`;
}
function filteredTopups(){
 const f=$('#topupFilter').value, q=$('#topupSearch').value.trim().toLowerCase();
 return topups.filter(r=>(f==='all'||r.status===f)&&(!q||`${r.username||''} ${r.user_id||''} ${r.id||''}`.toLowerCase().includes(q)));
}
function filteredClaims(){
 const f=$('#claimFilter')?.value || 'all', q=$('#claimSearch')?.value.trim().toLowerCase() || '';
 return rewardClaims.filter(r=>
   (f==='all'||r.status===f) &&
   (!q||`${r.username||''} ${r.user_id||''} ${r.email||''} ${r.id||''}`.toLowerCase().includes(q))
 );
}
function renderClaims(){
 const el=$('#claimList'); if(!el) return;
 const rows=filteredClaims();
 if(!rows.length){el.innerHTML='<div class="empty">ไม่พบคำขอรับรางวัล</div>';return;}
 el.innerHTML=rows.map(r=>{
   const items=Array.isArray(r.items)?r.items:[];
   const itemsHtml=items.map(item=>`<div class="claim-item">
      <span class="claim-icon">${escapeHtml(item.icon||'🎁')}</span>
      <span class="claim-name">${escapeHtml(item.name||'-')}</span>
      <span class="claim-rarity">${escapeHtml(item.rarity||'-')}</span>
   </div>`).join('');
   const statusText=r.status==='pending'?'รอตรวจสอบ':r.status==='approved'?'อนุมัติแล้ว':'ปฏิเสธแล้ว';
   const actions=r.status==='pending'
     ? `<div class="actions">
          <button class="approve-btn" data-claim-action="approve" data-claim-id="${escapeHtml(r.id)}">✓ อนุมัติ</button>
          <button class="reject-btn" data-claim-action="reject" data-claim-id="${escapeHtml(r.id)}">✕ ปฏิเสธ</button>
        </div>`
     : `<span class="status ${escapeHtml(r.status)}">${statusText}</span>`;
   return `<article class="request-card">
      <div class="request-head">
        <div>
          <h3>${escapeHtml(r.username||'ไม่มีชื่อ')}</h3>
          <div class="meta">Email: ${escapeHtml(r.email||'-')}<br>UUID: ${escapeHtml(r.user_id||'-')}<br>${r.created_at?new Date(r.created_at).toLocaleString('th-TH'):'-'}</div>
        </div>
        <span class="status ${escapeHtml(r.status)}">${statusText}</span>
      </div>
      <div class="details-grid">
        <div class="detail"><small>จำนวนรางวัล</small><b>${items.length}</b> ชิ้น</div>
        <div class="detail" style="grid-column:span 2"><small>รางวัลที่ขอรับ</small><div class="claim-items">${itemsHtml||'<span>-</span>'}</div></div>
      </div>
      ${actions}
   </article>`;
 }).join('');
 bindClaimEvents();
}
function bindClaimEvents(){
 $$('[data-claim-action]').forEach(btn=>btn.onclick=async()=>{
   const approve=btn.dataset.claimAction==='approve';
   if(!confirm(approve?'ยืนยันอนุมัติการขอรับรางวัลนี้?':'ยืนยันปฏิเสธการขอรับรางวัลนี้?')) return;
   btn.disabled=true;
   const {error}=await getClient().rpc('admin_review_reward_claim',{
     p_claim_id:btn.dataset.claimId,
     p_approve:approve
   });
   if(error){alert(error.message);btn.disabled=false;return;}
   await loadRewardClaims();
 });
}
async function loadRewardClaims(){
 const {data,error}=await getClient().rpc('admin_list_reward_claims');
 if(error) throw error;
 rewardClaims=data||[];
 renderClaims();
 renderStats();
}

function renderTopups(){
 const rows=filteredTopups();
 if(!rows.length){listEl.innerHTML='<div class="empty">ไม่พบรายการ</div>';return;}
 listEl.innerHTML=rows.map(r=>{
  const method=r.method==='wallet'?'🔗 Wallet':'🎫 TrueMoney';
  const details=r.method==='wallet'
   ?`<div class="detail"><small>จำนวน</small><b>${escapeHtml(r.amount)} บาท</b></div><div class="detail"><small>Wallet Link</small><div class="wallet-link">${escapeHtml(r.wallet_link||'-')}</div></div>`
   :`<div class="detail"><small>จำนวน</small><b>${escapeHtml(r.amount)} บาท</b></div><div class="detail"><small>บัตร / หลักฐาน</small><div>รหัส: ${escapeHtml(r.card_code||'-')}</div>${r.proof_image?`<a class="proof-link" href="#" data-proof="${escapeHtml(r.proof_image)}">เปิดรูปหลักฐาน</a>`:''}</div>`;
  const action=r.status==='pending'?`<div class="actions">${r.method==='wallet'&&r.wallet_link?`<button class="copy-btn" data-copy="${escapeHtml(r.wallet_link)}">คัดลอกลิงก์</button>`:''}<button class="approve-btn" data-action="approve" data-id="${r.id}">✓ อนุมัติและเพิ่มเหรียญ</button><button class="reject-btn" data-action="reject" data-id="${r.id}">✕ ปฏิเสธ</button></div>`:`<span class="status ${escapeHtml(r.status)}">${r.status==='approved'?'อนุมัติแล้ว':'ปฏิเสธแล้ว'}</span>`;
  return `<article class="request-card"><div class="request-head"><div><h3>${escapeHtml(r.username||'ไม่ทราบชื่อ')}</h3><div class="meta">UUID: ${escapeHtml(r.user_id)} • ${new Date(r.created_at).toLocaleString('th-TH')}</div></div><span class="status ${escapeHtml(r.status)}">${escapeHtml(r.status)}</span></div><div class="details-grid"><div class="detail"><small>ช่องทาง</small>${method}</div>${details}</div>${action}</article>`;
 }).join('');
 bindTopupEvents();
}
function bindTopupEvents(){
 $$('[data-action]').forEach(btn=>btn.onclick=async()=>{
  const approve=btn.dataset.action==='approve'; if(!confirm(approve?'ยืนยันว่าได้ตรวจสอบการชำระเงินจริงแล้ว?':'ยืนยันปฏิเสธรายการนี้?'))return;
  btn.disabled=true;
  const fn=approve?'admin_review_topup':'admin_review_topup';
  const {error}=await getClient().rpc(fn,{p_topup_id:Number(btn.dataset.id),p_approve:approve});
  if(error){alert(error.message);btn.disabled=false;return;} await loadAll();
 });
 $$('[data-copy]').forEach(btn=>btn.onclick=async()=>{try{await navigator.clipboard.writeText(btn.dataset.copy);btn.textContent='คัดลอกแล้ว';}catch{alert('คัดลอกไม่สำเร็จ');}});
 $$('[data-proof]').forEach(a=>a.onclick=async e=>{e.preventDefault();const {data,error}=await getClient().storage.from('topup-proofs').createSignedUrl(a.dataset.proof,600);if(error){alert(error.message);return;}window.open(data.signedUrl,'_blank','noopener');});
}
function renderUsers(){
 const q=$('#userSearch').value.trim().toLowerCase();
 const rows=users.filter(u=>!q||`${u.username||''} ${u.id||''} ${u.email||''}`.toLowerCase().includes(q));
 if(!rows.length){userList.innerHTML='<div class="empty">ไม่พบผู้เล่น</div>'; renderUserPagination(); return;}
 userList.innerHTML=rows.map((u,i)=>`<article class="user-card"><div class="user-main"><div><div class="user-number">#${((userPage-1)*userPageSize)+i+1}</div><b>${escapeHtml(u.username||'ไม่มีชื่อ')}</b><div class="meta">${escapeHtml(u.email||'')}<br>${escapeHtml(u.id)}<br>สมัครเมื่อ ${u.created_at?new Date(u.created_at).toLocaleString('th-TH'):'-'}</div></div><div class="coin">🪙 ${Number(u.coins||0).toLocaleString()}</div></div></article>`).join('');
 renderUserPagination();
}
function renderUserPagination(){
 const el=$('#userPagination'); if(!el) return;
 const totalPages=Math.max(1,Math.ceil(userTotal/userPageSize));
 const pages=[];
 const start=Math.max(1,userPage-2), end=Math.min(totalPages,start+4);
 for(let n=start;n<=end;n++) pages.push(`<button class="page-btn ${n===userPage?'active':''}" data-page="${n}">${n}</button>`);
 el.innerHTML=`<div class="page-info">ผู้เล่นทั้งหมด ${userTotal.toLocaleString()} คน • หน้า ${userPage} / ${totalPages}</div><div class="page-buttons"><button class="page-btn" data-page="${userPage-1}" ${userPage<=1?'disabled':''}>‹</button>${pages.join('')}<button class="page-btn" data-page="${userPage+1}" ${userPage>=totalPages?'disabled':''}>›</button></div>`;
 $$('#userPagination [data-page]').forEach(btn=>btn.onclick=()=>{const n=Number(btn.dataset.page);if(n>=1&&n<=totalPages&&n!==userPage){userPage=n;loadUsers();}});
}
async function loadUsers(){
 const c=getClient(), q=$('#userSearch').value.trim();
 const {data,error}=await c.rpc('admin_list_users',{p_page:userPage,p_page_size:userPageSize,p_search:q});
 if(error) throw error;
 users=data||[]; userTotal=users.length?Number(users[0].total_count||0):userTotal;
 renderStats(); renderUsers();
}
async function loadSite(){
 const {data,error}=await getClient().from('site_settings').select('maintenance_mode,announcement').eq('id',1).maybeSingle();
 if(error)throw error; const s=data||{maintenance_mode:false,announcement:''}; $('#maintenanceToggle').checked=!!s.maintenance_mode;$('#announcement').value=s.announcement||'';
}
async function loadAll(){
 if(!(await ensureAdmin()))return; statusEl.textContent='กำลังโหลด...';
 const a=await getClient().rpc('admin_list_topups');
 if(a.error)throw a.error;
 topups=a.data||[];
 renderTopups();
 await loadRewardClaims();
 await loadUsers();
 await loadSite();
 try {
   await loadBoxSettings();
 } catch (boxErr) {
   console.warn('Box settings table/RPC unavailable:', boxErr);
   boxSettings=DEFAULT_BOX_SETTINGS.map(b=>({...b,rewards:b.rewards.map(r=>({...r}))}));
   renderBoxAdmin();
   const boxMsg=$('#boxMessage');
   if(boxMsg) boxMsg.textContent='ยังไม่ได้สร้างตาราง box_settings ใน Supabase — ให้รัน BOX_SETTINGS_SETUP.sql 1 ครั้ง';
 }
 statusEl.textContent=`พร้อมใช้งาน • ${topups.length} รายการเติมเงิน • ผู้เล่น ${userTotal.toLocaleString()} คน`;
}
loginForm.onsubmit=async e=>{e.preventDefault();loginMessage.textContent='';try{const {error}=await getClient().auth.signInWithPassword({email:$('#adminEmail').value.trim(),password:$('#adminPassword').value});if(error)throw error;await loadAll();}catch(err){loginMessage.textContent=err.message||'เข้าสู่ระบบไม่สำเร็จ';}};
$('#logoutBtn').onclick=async()=>{await getClient().auth.signOut();loginPanel.classList.remove('hidden');adminPanel.classList.add('hidden');};
$('#refreshBtn').onclick=()=>loadAll();$('#topupFilter').onchange=renderTopups;$('#topupSearch').oninput=renderTopups;$('#claimFilter').onchange=renderClaims;$('#claimSearch').oninput=renderClaims;$('#userSearch').oninput=()=>{userPage=1;loadUsers().catch(err=>{statusEl.textContent=err.message||'โหลดผู้เล่นไม่สำเร็จ';});};
$$('.tab').forEach(t=>t.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.tab-panel').forEach(x=>x.classList.remove('active'));t.classList.add('active');$(`[data-panel="${t.dataset.tab}"]`).classList.add('active');});
$('#saveBoxesBtn').onclick=saveBoxSettings;
$('#saveSiteBtn').onclick=async()=>{const {error}=await getClient().from('site_settings').update({maintenance_mode:$('#maintenanceToggle').checked,announcement:$('#announcement').value.trim().slice(0,500),updated_at:new Date().toISOString()}).eq('id',1);$('#siteMessage').textContent=error?error.message:'บันทึกการตั้งค่าแล้ว';if(!error)setTimeout(()=>$('#siteMessage').textContent='',2000);};
loadAll().catch(err=>{console.error(err);statusEl.textContent=err.message||'โหลดข้อมูลไม่สำเร็จ';});
