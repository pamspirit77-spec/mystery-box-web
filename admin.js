import { online } from './online.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ENABLED } from './supabase-config.js';

const $ = s => document.querySelector(s);
const statusEl = $('#adminStatus');
const listEl = $('#topupList');

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

async function getClient() {
  if (!SUPABASE_ENABLED) throw new Error('ยังไม่ได้ตั้งค่า Supabase');
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data:{session}} = await client.auth.getSession();
  if (!session) throw new Error('กรุณาเข้าสู่ระบบด้วยบัญชีแอดมิน');
  return client;
}

async function refresh() {
  try {
    const client = await getClient();
    statusEl.textContent = 'กำลังโหลดคำขอ...';
    const {data,error} = await client.rpc('admin_list_topups');
    if (error) throw error;
    const rows = data || [];
    if (!rows.length) { listEl.innerHTML = '<div class="muted">ยังไม่มีคำขอเติมเงิน</div>'; statusEl.textContent='พร้อมใช้งาน'; return; }
    listEl.innerHTML = rows.map(r => {
      const method = r.method === 'wallet' ? '🔗 Wallet' : '🎫 บัตร';
      const details = r.method === 'wallet'
        ? `<div><b>${escapeHtml(r.amount)} บาท</b><div class="muted" style="word-break:break-all">${escapeHtml(r.wallet_link || '')}</div></div>`
        : `<div><b>${escapeHtml(r.amount)} บาท</b><div class="muted">รหัส: ${escapeHtml(r.card_code || '')}</div>${r.proof_path ? `<a class="proof" data-proof="${escapeHtml(r.proof_path)}" href="#">เปิดรูปหลักฐาน</a>`:''}</div>`;
      const actions = r.status === 'pending' ? `<div class="admin-actions"><button class="admin-btn approve" data-action="approve" data-id="${r.id}">อนุมัติ</button><button class="admin-btn reject" data-action="reject" data-id="${r.id}">ปฏิเสธ</button>${r.method==='wallet'&&r.wallet_link?`<button class="admin-btn copy" data-copy="${escapeHtml(r.wallet_link)}">คัดลอกลิงก์</button>`:''}</div>` : `<span class="status ${r.status}">${r.status==='approved'?'อนุมัติแล้ว':'ปฏิเสธแล้ว'}</span>`;
      return `<div class="admin-row"><div>${method}</div><div><b>${escapeHtml(r.username || r.user_id)}</b><div class="muted">${new Date(r.created_at).toLocaleString('th-TH')}</div></div><div>${details}</div><div>${actions}</div><div class="muted">${escapeHtml(r.status)}</div></div>`;
    }).join('');
    statusEl.textContent = `คำขอทั้งหมด ${rows.length} รายการ`;

    listEl.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', async () => {
      const approve = btn.dataset.action === 'approve';
      if (!confirm(approve ? 'ยืนยันว่าเติมเงินจริงแล้วและอนุมัติ?' : 'ยืนยันปฏิเสธคำขอนี้?')) return;
      btn.disabled = true;
      const {error} = await client.rpc('admin_review_topup',{p_topup_id:btn.dataset.id,p_approve:approve});
      if (error) { alert(error.message); btn.disabled=false; return; }
      await refresh();
    }));
    listEl.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent='คัดลอกแล้ว';
    }));
    listEl.querySelectorAll('[data-proof]').forEach(async link => {
      link.addEventListener('click', async e => {
        e.preventDefault();
        const {data,error} = await client.storage.from('topup-proofs').createSignedUrl(link.dataset.proof, 600);
        if(error) { alert(error.message); return; }
        window.open(data.signedUrl,'_blank','noopener');
      });
    });
  } catch (err) {
    console.error(err); statusEl.textContent = err.message || 'โหลดข้อมูลไม่สำเร็จ'; listEl.innerHTML='';
  }
}

$('#refreshBtn').addEventListener('click', refresh);
refresh();
