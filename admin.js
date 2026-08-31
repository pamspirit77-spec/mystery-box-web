import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ENABLED } from './supabase-config.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const loginPanel=$('#loginPanel'), adminPanel=$('#adminPanel'), loginForm=$('#loginForm');
const loginMessage=$('#loginMessage'), statusEl=$('#adminStatus'), listEl=$('#topupList'), claimList=$('#claimList'), userList=$('#userList');
let client=null, topups=[], claims=[], users=[];
let userPage=1, userPageSize=20, userTotal=0;

function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function getClient(){if(!SUPABASE_ENABLED)throw new Error('ยังไม่ได้ตั้งค่า Supabase');if(!client)client=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'mystery-box-admin-auth'}});return client;}

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
function filteredClaims(){
 const f=$('#claimFilter').value, q=$('#claimSearch').value.trim().toLowerCase();
 return claims.filter(r=>(f==='all'||r.status===f)&&(!q||`${r.username||''} ${r.email||''} ${r.user_id||''} ${r.id||''}`.toLowerCase().includes(q)));
}
function renderClaims(){
 const rows=filteredClaims();
 if(!claimList) return;
 if(!rows.length){claimList.innerHTML='<div class="empty">ไม่พบคำขอรับรางวัล</div>';return;}
 claimList.innerHTML=rows.map(r=>{
   const items=Array.isArray(r.items)?r.items:[];
   const itemsHtml=items.length?items.map(item=>`<div class="claim-item"><span class="icon">${escapeHtml(item.icon||'🎁')}</span><div><b>${escapeHtml(item.name||'-')}</b><div class="meta">${escapeHtml(item.rarity||'')}</div></div></div>`).join(''):'<div class="meta">ไม่มีข้อมูลรางวัล</div>';
   const action=r.status==='pending'?`<div class="actions"><button class="approve-btn" data-claim-action="approve" data-claim-id="${r.id}">✓ อนุมัติรับรางวัล</button><button class="reject-btn" data-claim-action="reject" data-claim-id="${r.id}">✕ ปฏิเสธ</button></div>`:`<span class="status ${escapeHtml(r.status)}">${r.status==='approved'?'อนุมัติแล้ว':'ปฏิเสธแล้ว'}</span>`;
   return `<article class="request-card"><div class="request-head"><div><h3>${escapeHtml(r.username||'ไม่ทราบชื่อ')}</h3><div class="meta">Email: ${escapeHtml(r.email||'-')}<br>UUID: ${escapeHtml(r.user_id||'-')} • ${r.created_at?new Date(r.created_at).toLocaleString('th-TH'):'-'}</div></div><span class="status ${escapeHtml(r.status)}">${escapeHtml(r.status)}</span></div><div class="detail" style="margin-top:15px"><small>รางวัลที่ขอรับ (${items.length} ชิ้น)</small><div class="claim-items">${itemsHtml}</div></div>${r.reviewed_at?`<div class="meta" style="margin-top:10px">ตรวจสอบเมื่อ ${new Date(r.reviewed_at).toLocaleString('th-TH')}</div>`:''}${action}</article>`;
 }).join('');
 bindClaimEvents();
}
function bindClaimEvents(){
 $$('[data-claim-action]').forEach(btn=>btn.onclick=async()=>{
   const approve=btn.dataset.claimAction==='approve';
   if(!confirm(approve?'ยืนยันอนุมัติคำขอรับรางวัลนี้?':'ยืนยันปฏิเสธคำขอรับรางวัลนี้?'))return;
   btn.disabled=true;
   const {error}=await getClient().rpc('admin_review_reward_claim',{p_claim_id:Number(btn.dataset.claimId),p_approve:approve});
   if(error){alert(error.message);btn.disabled=false;return;}
   await loadAll();
 });
}
function renderUsers(){
 const q=$('#userSearch').value.trim().toLowerCase();
 const rows=users.filter(u=>!q||`${u.username||''} ${u.id||''} ${u.email||''}`.toLowerCase().includes(q));
 if(!rows.length){userList.innerHTML='<div class="empty">ไม่พบผู้เล่น</div>'; renderUserPagination(); return;}
 userList.innerHTML=rows.map((u,i)=>`<article class="user-card"><div class="user-main"><div><div class="user-number">#${((userPage-1)*userPageSize)+i+1}</div><b>${escapeHtml(u.username||'ไม่มีชื่อ')}</b><div class="meta">${escapeHtml(u.email||'')}<br>${escapeHtml(u.id)}<br>สมัครเมื่อ ${u.created_at?new Date(u.created_at).toLocaleString('th-TH'):'-'}</div></div><div><div class="coin">🪙 ${Number(u.coins||0).toLocaleString()}</div><div class="user-actions"><input type="number" min="1" max="1000000" value="1" data-coin-amount="${u.id}"><button class="add-coin-btn" data-coin-action="add" data-user-id="${u.id}">+ เพิ่มเหรียญ</button><button class="remove-coin-btn" data-coin-action="remove" data-user-id="${u.id}">− ลบเหรียญ</button></div></div></div></article>`).join('');
 bindUserCoinEvents();
 renderUserPagination();
}
function bindUserCoinEvents(){
 $$('[data-coin-action]').forEach(btn=>btn.onclick=async()=>{
   const input=$(`[data-coin-amount="${btn.dataset.userId}"]`);
   const amount=Math.floor(Number(input?.value||0));
   if(!Number.isInteger(amount)||amount<1||amount>1000000){alert('จำนวนเหรียญต้องอยู่ระหว่าง 1 ถึง 1,000,000');return;}
   const add=btn.dataset.coinAction==='add';
   if(!confirm(`${add?'เพิ่ม':'ลบ'} ${amount.toLocaleString()} เหรียญให้ผู้เล่นนี้?`))return;
   btn.disabled=true;
   const {data,error}=await getClient().rpc('admin_adjust_coins',{p_user_id:btn.dataset.userId,p_delta:add?amount:-amount});
   if(error){alert(error.message);btn.disabled=false;return;}
   alert(`ยอดเหรียญใหม่: ${Number(data||0).toLocaleString()}`);
   await loadUsers();
 });
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
 const cr=await getClient().rpc('admin_list_reward_claims');
 if(cr.error)throw cr.error;
 claims=cr.data||[];
 renderTopups();
 renderClaims();
 await loadUsers();
 await loadSite();
 statusEl.textContent=`พร้อมใช้งาน • ${topups.length} รายการเติมเงิน • ผู้เล่น ${userTotal.toLocaleString()} คน`;
}
loginForm.onsubmit=async e=>{e.preventDefault();loginMessage.textContent='';try{const {error}=await getClient().auth.signInWithPassword({email:$('#adminEmail').value.trim(),password:$('#adminPassword').value});if(error)throw error;await loadAll();}catch(err){loginMessage.textContent=err.message||'เข้าสู่ระบบไม่สำเร็จ';}};
$('#logoutBtn').onclick=async()=>{await getClient().auth.signOut();loginPanel.classList.remove('hidden');adminPanel.classList.add('hidden');};
$('#refreshBtn').onclick=()=>loadAll();$('#topupFilter').onchange=renderTopups;$('#topupSearch').oninput=renderTopups;$('#claimFilter').onchange=renderClaims;$('#claimSearch').oninput=renderClaims;$('#userSearch').oninput=()=>{userPage=1;loadUsers().catch(err=>{statusEl.textContent=err.message||'โหลดผู้เล่นไม่สำเร็จ';});};
$$('.tab').forEach(t=>t.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.tab-panel').forEach(x=>x.classList.remove('active'));t.classList.add('active');$(`[data-panel="${t.dataset.tab}"]`).classList.add('active');});
$('#saveSiteBtn').onclick=async()=>{const {error}=await getClient().from('site_settings').update({maintenance_mode:$('#maintenanceToggle').checked,announcement:$('#announcement').value.trim().slice(0,500),updated_at:new Date().toISOString()}).eq('id',1);$('#siteMessage').textContent=error?error.message:'บันทึกการตั้งค่าแล้ว';if(!error)setTimeout(()=>$('#siteMessage').textContent='',2000);};
loadAll().catch(err=>{console.error(err);statusEl.textContent=err.message||'โหลดข้อมูลไม่สำเร็จ';});
