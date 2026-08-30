import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ENABLED } from './supabase-config.js';

const $ = (s) => document.querySelector(s);
const loginPanel = $('#loginPanel');
const adminPanel = $('#adminPanel');
const loginForm = $('#loginForm');
const loginMessage = $('#loginMessage');
const statusEl = $('#adminStatus');
const listEl = $('#topupList');

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));
}

let client = null;

function getClient() {
  if (!SUPABASE_ENABLED) throw new Error('ยังไม่ได้ตั้งค่า Supabase');
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
    });
  }
  return client;
}

async function ensureAdmin() {
  const c = getClient();
  const { data: { session } } = await c.auth.getSession();
  if (!session) {
    loginPanel.classList.remove('hidden');
    adminPanel.classList.add('hidden');
    return false;
  }
  const { data, error } = await c.rpc('is_admin');
  if (error || data !== true) {
    await c.auth.signOut();
    loginPanel.classList.remove('hidden');
    adminPanel.classList.add('hidden');
    loginMessage.textContent = 'บัญชีนี้ไม่มีสิทธิ์แอดมิน';
    return false;
  }
  loginPanel.classList.add('hidden');
  adminPanel.classList.remove('hidden');
  return true;
}

async function refresh() {
  try {
    if (!(await ensureAdmin())) return;
    statusEl.textContent = 'กำลังโหลดคำขอ...';

    const { data, error } = await getClient().rpc('admin_list_topups');
    if (error) throw error;

    const rows = data || [];
    if (!rows.length) {
      listEl.innerHTML = '<div class="empty">ยังไม่มีคำขอเติมเงิน</div>';
      statusEl.textContent = 'พร้อมใช้งาน';
      return;
    }

    listEl.innerHTML = rows.map(r => {
      const method = r.method === 'wallet_link' ? '🔗 Wallet' : '🎫 TrueMoney';
      const details = r.method === 'wallet_link'
        ? `<div class="detail"><small>จำนวน</small><b>${escapeHtml(r.amount)} บาท</b>
             <small>Wallet Link</small><div class="wallet-link">${escapeHtml(r.wallet_link || '-')}</div></div>`
        : `<div class="detail"><small>จำนวน</small><b>${escapeHtml(r.amount)} บาท</b>
             <small>รหัสบัตร</small><div>${escapeHtml(r.card_code || '-')}</div>
             ${r.proof_image_url ? `<a class="proof-link" data-proof="${escapeHtml(r.proof_image_url)}" href="#">เปิดรูปหลักฐาน</a>` : ''}</div>`;

      const actions = r.status === 'pending'
        ? `<div class="actions">
             ${r.method === 'wallet_link' && r.wallet_link ? `<button class="copy-btn" data-copy="${escapeHtml(r.wallet_link)}">คัดลอกลิงก์</button>` : ''}
             <button class="approve-btn" data-action="approve" data-id="${r.id}">อนุมัติ</button>
             <button class="reject-btn" data-action="reject" data-id="${r.id}">ปฏิเสธ</button>
           </div>`
        : `<span class="status ${escapeHtml(r.status)}">${r.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว'}</span>`;

      return `<article class="request-card">
        <div class="request-head">
          <div><h3>${escapeHtml(r.user_id)}</h3>
          <div class="meta">${new Date(r.created_at).toLocaleString('th-TH')}</div></div>
          <span class="status ${escapeHtml(r.status)}">${escapeHtml(r.status)}</span>
        </div>
        <div class="details-grid">
          <div class="detail"><small>ช่องทาง</small>${method}</div>
          ${details}
        </div>
        ${actions}
      </article>`;
    }).join('');

    statusEl.textContent = `คำขอทั้งหมด ${rows.length} รายการ`;

    listEl.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const approve = btn.dataset.action === 'approve';
        if (!confirm(approve ? 'ยืนยันว่าได้ตรวจสอบการชำระเงินจริงแล้ว และอนุมัติรายการนี้?' : 'ยืนยันปฏิเสธคำขอนี้?')) return;
        btn.disabled = true;
        const { error } = await getClient().rpc('admin_review_topup', {
          p_topup_id: btn.dataset.id,
          p_approve: approve
        });
        if (error) {
          alert(error.message);
          btn.disabled = false;
          return;
        }
        await refresh();
      });
    });

    listEl.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.copy);
          btn.textContent = 'คัดลอกแล้ว';
        } catch {
          alert('คัดลอกลิงก์ไม่สำเร็จ');
        }
      });
    });

    listEl.querySelectorAll('[data-proof]').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const { data, error } = await getClient().storage
          .from('topup-proofs')
          .createSignedUrl(link.dataset.proof, 600);
        if (error) { alert(error.message); return; }
        window.open(data.signedUrl, '_blank', 'noopener');
      });
    });
  } catch (err) {
    console.error(err);
    statusEl.textContent = err.message || 'โหลดข้อมูลไม่สำเร็จ';
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginMessage.textContent = '';
  try {
    const c = getClient();
    const { error } = await c.auth.signInWithPassword({
      email: $('#adminEmail').value.trim(),
      password: $('#adminPassword').value
    });
    if (error) throw error;
    await refresh();
  } catch (err) {
    loginMessage.textContent = err.message || 'เข้าสู่ระบบไม่สำเร็จ';
  }
});

$('#refreshBtn').addEventListener('click', refresh);
$('#logoutBtn').addEventListener('click', async () => {
  await getClient().auth.signOut();
  loginPanel.classList.remove('hidden');
  adminPanel.classList.add('hidden');
  loginMessage.textContent = '';
  listEl.innerHTML = '';
});

refresh();
