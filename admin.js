import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $ = s => document.querySelector(s);
const loginPanel=$('#loginPanel'), dashboard=$('#dashboard');
const loginMessage=$('#loginMessage'), adminMessage=$('#adminMessage'), list=$('#requestList');

function msg(el,text){el.textContent=text||'';}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function money(v){return Number(v).toLocaleString('th-TH');}
function statusLabel(v){return ({pending:'รอตรวจสอบ',approved:'อนุมัติแล้ว',rejected:'ปฏิเสธ'})[v]||v;}

async function checkAdmin(){
  const {data:{user}}=await db.auth.getUser();
  if(!user) return false;
  const {data,isError,error}=await db.rpc('is_admin');
  if(error){console.error(error);msg(loginMessage,'ตรวจสอบสิทธิ์แอดมินไม่สำเร็จ');return false;}
  if(!data){msg(loginMessage,'บัญชีนี้ยังไม่ได้รับสิทธิ์แอดมิน');await db.auth.signOut();return false;}
  $('#adminIdentity').textContent=`${user.email} • Admin`;
  return true;
}

async function openDashboard(){
  if(await checkAdmin()){loginPanel.classList.add('hidden');dashboard.classList.remove('hidden');await loadRequests();}
}

async function login(e){
  e.preventDefault();msg(loginMessage,'กำลังเข้าสู่ระบบ...');
  const {error}=await db.auth.signInWithPassword({email:$('#adminEmail').value.trim(),password:$('#adminPassword').value});
  if(error){msg(loginMessage,error.message);return;}
  await openDashboard();
}

async function loadRequests(){
  msg(adminMessage,'กำลังโหลด...');
  const {data,error}=await db.from('topup_requests').select('id,guest_key,player_name,method,amount,wallet_link,card_code,image_path,status,admin_note,created_at,approved_at').order('created_at',{ascending:false}).limit(100);
  if(error){console.error(error);msg(adminMessage,error.message);return;}
  msg(adminMessage,'');
  if(!data?.length){list.innerHTML='<div class="panel empty">ยังไม่มีคำขอเติมเงิน</div>';return;}
  const cards=[];
  for(const r of data){
    let proof='';
    if(r.image_path){
      const {data:sv}=await db.storage.from('topup-proofs').createSignedUrl(r.image_path,3600);
      if(sv?.signedUrl) proof=`<img class="proof" src="${esc(sv.signedUrl)}" alt="หลักฐานการเติมเงิน">`;
    }
    const wallet=r.wallet_link?`<div class="detail"><small>ลิงก์ Wallet</small><div class="wallet-link">${esc(r.wallet_link)}</div><button class="copy-btn" data-copy="${esc(r.wallet_link)}">คัดลอกลิงก์</button></div>`:'';
    const card=r.card_code?`<div class="detail"><small>รหัสบัตร 14 หลัก</small><b>${esc(r.card_code)}</b></div>`:'';
    cards.push(`<article class="request-card" data-id="${esc(r.id)}">
      <div class="request-head"><div><h3>${r.method==='wallet'?'🔗 ซองของขวัญ / Wallet':'🎫 บัตร TrueMoney'}</h3><div class="meta">${esc(r.player_name)} • ${new Date(r.created_at).toLocaleString('th-TH')}</div></div><span class="status ${esc(r.status)}">${statusLabel(r.status)}</span></div>
      <div class="details-grid"><div class="detail"><small>จำนวน</small><b>${money(r.amount)} บาท</b></div><div class="detail"><small>Request ID</small><span>${esc(r.id)}</span></div>${wallet}${card}</div>
      ${proof}
      ${r.admin_note?`<div class="meta" style="margin-top:10px">หมายเหตุ: ${esc(r.admin_note)}</div>`:''}
      ${r.status==='pending'?`<label class="note-label">หมายเหตุแอดมิน<textarea class="admin-note" rows="2" placeholder="เช่น ตรวจสอบยอดแล้ว"></textarea></label><div class="actions"><button class="approve-btn" data-action="approve">✓ อนุมัติและเพิ่มเหรียญ</button><button class="reject-btn" data-action="reject">✕ ปฏิเสธ</button></div>`:''}
    </article>`);
  }
  list.innerHTML=cards.join('');
  list.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);msg(adminMessage,'คัดลอกลิงก์แล้ว');}catch{msg(adminMessage,'คัดลอกไม่ได้ ให้ลากคัดลอกเอง');}});
  list.querySelectorAll('[data-action="approve"]').forEach(b=>b.onclick=()=>processRequest(b.closest('.request-card').dataset.id,'approve',b.closest('.request-card').querySelector('.admin-note')?.value||''));
  list.querySelectorAll('[data-action="reject"]').forEach(b=>b.onclick=()=>processRequest(b.closest('.request-card').dataset.id,'reject',b.closest('.request-card').querySelector('.admin-note')?.value||''));
}

async function processRequest(id,action,note){
  if(action==='approve' && !confirm('ยืนยันว่าได้ตรวจสอบยอดเงินจริงแล้ว และต้องการเพิ่มเหรียญให้ผู้เล่น?')) return;
  if(action==='reject' && !confirm('ยืนยันปฏิเสธคำขอนี้?')) return;
  msg(adminMessage,'กำลังบันทึก...');
  const fn=action==='approve'?'approve_topup':'reject_topup';
  const {error}=await db.rpc(fn,{p_request_id:id,p_note:note||''});
  if(error){console.error(error);msg(adminMessage,error.message);return;}
  msg(adminMessage,action==='approve'?'อนุมัติแล้ว เหรียญถูกเพิ่มให้ผู้เล่น':'ปฏิเสธคำขอแล้ว');
  await loadRequests();
}

$('#loginForm').addEventListener('submit',login);
$('#refreshBtn').addEventListener('click',loadRequests);
$('#logoutBtn').addEventListener('click',async()=>{await db.auth.signOut();dashboard.classList.add('hidden');loginPanel.classList.remove('hidden');});
db.auth.onAuthStateChange(()=>openDashboard());
openDashboard();
