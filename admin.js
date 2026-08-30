import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ENABLED } from './supabase-config.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const loginPanel=$('#loginPanel'), adminPanel=$('#adminPanel'), loginForm=$('#loginForm');
const loginMessage=$('#loginMessage'), statusEl=$('#adminStatus'), listEl=$('#topupList'), userList=$('#userList');
let client=null, topups=[], users=[];

function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function getClient(){if(!SUPABASE_ENABLED)throw new Error('ยังไม่ได้ตั้งค่า Supabase');if(!client)client=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});return client;}

async function ensureAdmin(){
 const c=getClient(),{data:{session}}=await c.auth.getSession();
 if(!session){loginPanel.classList.remove('hidden');adminPanel.classList.add('hidden');return false;}
 const {data,error}=await c.rpc('is_admin');
 if(error||data!==true){await c.auth.signOut();loginPanel.classList.remove('hidden');adminPanel.classList.add('hidden');loginMessage.textContent='บัญชีนี้ไม่มีสิทธิ์แอดมิน';return false;}
 loginPanel.classList.add('hidden');adminPanel.classList.remove('hidden');return true;
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
function renderTopups(){
 const rows=filteredTopups();
 if(!rows.length){listEl.innerHTML='<div class="empty">ไม่พบรายการ</div>';return;}
 listEl.innerHTML=rows.map(r=>{
  const method=r.method==='wallet'?'🔗 Wallet':'🎫 TrueMoney';
  const details=r.method==='wallet'
   ?`<div class="detail"><small>จำนวน</small><b>${escapeHtml(r.amount)} บาท</b></div><div class="detail"><small>Wallet Link</small><div class="wallet-link">${escapeHtml(r.wallet_link||'-')}</div></div>`
   :`<div class="detail"><small>จำนวน</small><b>${escapeHtml(r.amount)} บาท</b></div><div class="detail"><small>บัตร / หลักฐาน</small><div>รหัส: ${escapeHtml(r.card_code||'-')}</div>${r.proof_path?`<a class="proof-link" href="#" data-proof="${escapeHtml(r.proof_path)}">เปิดรูปหลักฐาน</a>`:''}</div>`;
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
  const {error}=await getClient().rpc(fn,{p_topup_id:btn.dataset.id,p_approve:approve});
  if(error){alert(error.message);btn.disabled=false;return;} await loadAll();
 });
 $$('[data-copy]').forEach(btn=>btn.onclick=async()=>{try{await navigator.clipboard.writeText(btn.dataset.copy);btn.textContent='คัดลอกแล้ว';}catch{alert('คัดลอกไม่สำเร็จ');}});
 $$('[data-proof]').forEach(a=>a.onclick=async e=>{e.preventDefault();const {data,error}=await getClient().storage.from('topup-proofs').createSignedUrl(a.dataset.proof,600);if(error){alert(error.message);return;}window.open(data.signedUrl,'_blank','noopener');});
}
function renderUsers(){
 const q=$('#userSearch').value.trim().toLowerCase();
 const rows=users.filter(u=>!q||`${u.username||''} ${u.id||''} ${u.email||''}`.toLowerCase().includes(q));
 if(!rows.length){userList.innerHTML='<div class="empty">ไม่พบผู้เล่น</div>';return;}
 userList.innerHTML=rows.map(u=>`<article class="user-card"><div class="user-main"><div><b>${escapeHtml(u.username||'ไม่มีชื่อ')}</b><div class="meta">${escapeHtml(u.email||'')}<br>${escapeHtml(u.id)}</div></div><div class="coin">🪙 ${Number(u.coins||0).toLocaleString()}</div></div><div class="user-actions"><input type="number" min="-1000000" max="1000000" step="1" placeholder="+/- เหรียญ" data-delta="${u.id}"><button class="adjust-btn" data-user="${u.id}">ปรับเหรียญ</button></div></article>`).join('');
 $$('.adjust-btn').forEach(btn=>btn.onclick=async()=>{const input=document.querySelector(`[data-delta="${btn.dataset.user}"]`),delta=Number(input?.value);if(!Number.isInteger(delta)||delta===0){alert('ใส่จำนวนเหรียญเป็นจำนวนเต็มที่ไม่ใช่ 0');return;}if(!confirm(`ยืนยันปรับเหรียญ ${delta>0?'+':''}${delta} เหรียญ?`))return;btn.disabled=true;const {error}=await getClient().rpc('admin_adjust_coins',{p_user_id:btn.dataset.user,p_delta:delta});if(error){alert(error.message);btn.disabled=false;return;}await loadAll();});
}
async function loadSite(){
 const {data,error}=await getClient().from('site_settings').select('maintenance_mode,announcement').eq('id',1).maybeSingle();
 if(error)throw error; const s=data||{maintenance_mode:false,announcement:''}; $('#maintenanceToggle').checked=!!s.maintenance_mode;$('#announcement').value=s.announcement||'';
}
async function loadAll(){
 if(!(await ensureAdmin()))return; statusEl.textContent='กำลังโหลด...'; const c=getClient();
 const [a,b]=await Promise.all([c.rpc('admin_list_topups'),c.rpc('admin_list_users')]);
 if(a.error)throw a.error;if(b.error)throw b.error;topups=a.data||[];users=b.data||[];
 renderStats();renderTopups();renderUsers();await loadSite();statusEl.textContent=`พร้อมใช้งาน • ${topups.length} รายการเติมเงิน`;
}
loginForm.onsubmit=async e=>{e.preventDefault();loginMessage.textContent='';try{const {error}=await getClient().auth.signInWithPassword({email:$('#adminEmail').value.trim(),password:$('#adminPassword').value});if(error)throw error;await loadAll();}catch(err){loginMessage.textContent=err.message||'เข้าสู่ระบบไม่สำเร็จ';}};
$('#logoutBtn').onclick=async()=>{await getClient().auth.signOut();loginPanel.classList.remove('hidden');adminPanel.classList.add('hidden');};
$('#refreshBtn').onclick=()=>loadAll();$('#topupFilter').onchange=renderTopups;$('#topupSearch').oninput=renderTopups;$('#userSearch').oninput=renderUsers;
$$('.tab').forEach(t=>t.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.tab-panel').forEach(x=>x.classList.remove('active'));t.classList.add('active');$(`[data-panel="${t.dataset.tab}"]`).classList.add('active');});
$('#saveSiteBtn').onclick=async()=>{const {error}=await getClient().from('site_settings').update({maintenance_mode:$('#maintenanceToggle').checked,announcement:$('#announcement').value.trim().slice(0,500),updated_at:new Date().toISOString()}).eq('id',1);$('#siteMessage').textContent=error?error.message:'บันทึกการตั้งค่าแล้ว';if(!error)setTimeout(()=>$('#siteMessage').textContent='',2000);};
loadAll().catch(err=>{console.error(err);statusEl.textContent=err.message||'โหลดข้อมูลไม่สำเร็จ';});
