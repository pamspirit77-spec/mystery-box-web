import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ENABLED } from './supabase-config.js';

const AUTH_MARKER = 'mystery_box_auth_user_id';
const LOGOUT_MARKER = 'mystery_box_logged_out';

class OnlineDB {
  constructor() {
    this.client = null;
    this.user = null;
    this.enabled = SUPABASE_ENABLED;
  }

  clearBrowserAuthStorage() {
    try {
      const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
      const prefixes = [`sb-${projectRef}-auth-token`];
      for (const storage of [localStorage, sessionStorage]) {
        const keys = [];
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && prefixes.some(prefix => key === prefix || key.startsWith(prefix + '-'))) keys.push(key);
        }
        keys.forEach(key => storage.removeItem(key));
      }
    } catch (_) {}
  }

  async init() {
    if (!this.enabled) return null;

    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    // If the user explicitly logged out, never restore a previous browser session.
    if (localStorage.getItem(LOGOUT_MARKER) === '1') {
      try { await this.client.auth.signOut({ scope: 'local' }); } catch (_) {}
      this.clearBrowserAuthStorage();
      this.user = null;
      return null;
    }

    const { data: { session } } = await this.client.auth.getSession();
    this.user = session?.user ?? null;

    if (!this.user) {
      localStorage.removeItem(AUTH_MARKER);
      return null;
    }

    localStorage.setItem(AUTH_MARKER, this.user.id);
    return await this.loadProfile();
  }

  async signUp(email, password, username = '') {
    if (!this.client) throw new Error('Supabase is not configured');

    // Always clear the currently persisted session before creating a different account.
    try { await this.client.auth.signOut({ scope: 'local' }); } catch (_) {}
    this.clearBrowserAuthStorage();
    this.user = null;
    localStorage.removeItem(AUTH_MARKER);
    localStorage.removeItem(LOGOUT_MARKER);

    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { data: { username } }
    });
    if (error) throw error;

    this.user = data?.session?.user || data?.user || null;

    // Supabase can return a user without a session when email confirmation is enabled.
    // Never keep or restore the previous account in that case.
    if (!data?.session) {
      this.user = null;
      localStorage.setItem(LOGOUT_MARKER, '1');
      this.clearBrowserAuthStorage();
    } else {
      localStorage.setItem(AUTH_MARKER, this.user.id);
      localStorage.removeItem(LOGOUT_MARKER);
    }

    return data;
  }

  async signIn(email, password) {
    if (!this.client) throw new Error('Supabase is not configured');
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.user = data.user;
    localStorage.setItem(AUTH_MARKER, this.user.id);
    localStorage.removeItem(LOGOUT_MARKER);
    return await this.loadProfile();
  }

  async signOut() {
    if (this.client) {
      try { await this.client.auth.signOut({ scope: 'local' }); } catch (error) {
        // Even if Supabase's network call fails, remove the local session so refresh cannot restore it.
        this.user = null;
        localStorage.removeItem(AUTH_MARKER);
        localStorage.setItem(LOGOUT_MARKER, '1');
        this.clearBrowserAuthStorage();
        throw error;
      }
    }
    this.user = null;
    localStorage.removeItem(AUTH_MARKER);
    localStorage.setItem(LOGOUT_MARKER, '1');
    this.clearBrowserAuthStorage();
  }

  async loadProfile() {
    if (!this.client || !this.user) return null;
    const { data, error } = await this.client
      .from('profiles')
      .select('id, username, coins')
      .eq('id', this.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      const profile = {
        id: this.user.id,
        username: this.user.user_metadata?.username || `User_${this.user.id.slice(0, 8)}`,
        coins: 24
      };
      const { data: created, error: createError } = await this.client
        .from('profiles').insert(profile).select().single();
      if (createError) throw createError;
      return created;
    }
    return data;
  }

  async getSiteSettings() {
    if (!this.client) return { maintenance_mode: false, announcement: '' };
    const { data, error } = await this.client
      .from('site_settings')
      .select('maintenance_mode, announcement')
      .eq('id', 1)
      .maybeSingle();
    if (error) throw error;
    return data || { maintenance_mode: false, announcement: '' };
  }

  async saveCoins(coins) {
    if (!this.client || !this.user) throw new Error('กรุณาเข้าสู่ระบบก่อนใช้เหรียญ');

    const userId = this.user.id;
    const newCoins = Math.max(0, Math.floor(Number(coins)));
    if (!Number.isFinite(newCoins)) throw new Error('จำนวนเหรียญไม่ถูกต้อง');

    // Update ONLY the coins column. No select(), no single(), and no updated_at.
    // This avoids the PostgREST/RLS response error that previously blocked opening boxes.
    const { error } = await this.client
      .from('profiles')
      .update({ coins: newCoins })
      .eq('id', userId);

    if (error) {
      console.warn('Supabase coins sync failed:', error);
      throw error;
    }

    // Read back the balance using the same authenticated user to make sure the save stuck.
    const { data: saved, error: verifyError } = await this.client
      .from('profiles')
      .select('id, coins')
      .eq('id', userId)
      .maybeSingle();

    if (verifyError) {
      console.warn('Supabase coins verification failed:', verifyError);
      throw verifyError;
    }
    if (!saved || saved.id !== userId || Number(saved.coins) !== newCoins) {
      throw new Error('บันทึกเหรียญไม่สำเร็จ');
    }

    return true;
  }


  async submitTopup(payload) {
    if (!this.client || !this.user) throw new Error('กรุณาเข้าสู่ระบบก่อนเติมเงิน');
    const { data, error } = await this.client.from('topup_requests').insert({
      user_id: this.user.id,
      method: payload.method,
      amount: payload.amount,
      wallet_link: payload.walletLink || null,
      card_code: payload.cardCode || null,
      proof_image: payload.proofPath || null
    }).select('id').single();
    if (error) throw error;
    return data;
  }

  async uploadTopupProof(file) {
    if (!this.client || !this.user) throw new Error('กรุณาเข้าสู่ระบบก่อนเติมเงิน');
    const safeName = String(file.name || 'proof').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${this.user.id}/${Date.now()}_${crypto.randomUUID()}_${safeName}`;
    const { error } = await this.client.storage.from('topup-proofs').upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg'
    });
    if (error) throw error;
    return path;
  }

  async getMyTopups() {
    if (!this.client || !this.user) return [];
    const { data, error } = await this.client.from('topup_requests')
      .select('id, method, amount, status, created_at, reviewed_at')
      .eq('user_id', this.user.id).order('created_at', { ascending:false }).limit(20);
    if (error) throw error;
    return data || [];
  }

  async addRollHistory(items, boxName, timestamp = Date.now()) {
    if (!this.client || !this.user || !Array.isArray(items)) return;
    const rows = items.map(item => ({
      user_id: this.user.id,
      item_name: item.name,
      rarity: item.rarity,
      icon: item.icon,
      box_name: boxName,
      rolled_at: new Date(timestamp).toISOString()
    }));
    if (!rows.length) return;
    const { error } = await this.client.from('gacha_history').insert(rows);
    if (error) console.warn('Supabase history sync failed:', error);
  }

  async getRollHistory() {
    if (!this.client || !this.user) return [];
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.client
      .from('gacha_history')
      .select('id, item_name, rarity, icon, box_name, rolled_at')
      .eq('user_id', this.user.id)
      .gte('rolled_at', cutoff)
      .order('rolled_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      prizeName: row.item_name,
      rarity: row.rarity,
      icon: row.icon,
      boxName: row.box_name,
      timestamp: new Date(row.rolled_at).getTime()
    }));
  }
}

export const online = new OnlineDB();
