import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ENABLED } from './supabase-config.js';

class OnlineDB {
  constructor() {
    this.client = null;
    this.user = null;
    this.enabled = SUPABASE_ENABLED;
  }

  async refreshAuthenticatedUser() {
    if (!this.client) {
      this.user = null;
      return null;
    }

    // Always ask Supabase for the current authenticated user immediately
    // before account-sensitive operations. Do not rely on a stale cached
    // this.user value after logout/login/register.
    const { data, error } = await this.client.auth.getUser();
    if (error) {
      this.user = null;
      throw error;
    }
    this.user = data?.user ?? null;
    return this.user;
  }

  async init() {
    if (!this.enabled) return null;

    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'mystery-box-player-auth' }
    });

    const { data: { session } } = await this.client.auth.getSession();
    this.user = session?.user ?? null;
    if (this.user) {
      try { await this.refreshAuthenticatedUser(); } catch (_) { this.user = null; }
    }

    // No anonymous account: the real account system will use Supabase Auth.
    // This keeps the game usable locally until Login/Register is connected.
    return this.user ? await this.loadProfile() : null;
  }

  async signUp(email, password, username = '') {
    if (!this.client) throw new Error('Supabase is not configured');

    // A new registration must never inherit any previous account session.
    // Read the real Supabase session first instead of trusting cached state.
    const { data: sessionData } = await this.client.auth.getSession();
    if (sessionData?.session) {
      await this.signOut();
    }

    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { data: { username } }
    });
    if (error) throw error;
    this.user = data?.user ?? null;
    if (data?.session) {
      await this.refreshAuthenticatedUser();
    }
    return data;
  }

  async signIn(email, password) {
    if (!this.client) throw new Error('Supabase is not configured');
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await this.refreshAuthenticatedUser();
    return await this.loadProfile();
  }

  async signOut() {
    if (!this.client) {
      this.user = null;
      return;
    }

    // Logout only this browser/device and remove the persisted Supabase session.
    const { error } = await this.client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    this.user = null;

    // Also remove the browser-persisted auth token for this Supabase project.
    // This is deliberately limited to the Supabase auth key; game data/history
    // in localStorage must not be touched.
    try {
      const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
      localStorage.removeItem(`sb-${projectRef}-auth-token`);
      sessionStorage.removeItem(`sb-${projectRef}-auth-token`);
    } catch (_) {}

    this.user = null;
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
        coins: 0
      };
      const { data: created, error: createError } = await this.client
        .from('profiles').insert(profile).select().single();
      if (createError) throw createError;
      return created;
    }
    return data;
  }

  async getCurrentProfile() {
    if (!this.client) return null;
    const currentUser = await this.refreshAuthenticatedUser();
    if (!currentUser) return null;
    const { data, error } = await this.client
      .from('profiles')
      .select('id, username, coins')
      .eq('id', currentUser.id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async getBoxSettings() {
    if (!this.client) return [];
    const { data, error } = await this.client
      .from('box_settings')
      .select('id,name,en,price,rarity,color,accent,icon,rewards,updated_at')
      .order('id', { ascending: true });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async getWorldTree() {
    if (!this.client) return null;
    const currentUser = await this.refreshAuthenticatedUser();
    if (!currentUser) return null;
    const { data, error } = await this.client
      .from('world_tree_states')
      .select('user_id, planted, growth, items, claimed_rewards, updated_at')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      planted: Boolean(data.planted),
      growth: Number(data.growth || 0),
      items: data.items && typeof data.items === 'object' ? data.items : {},
      claimedRewards: Array.isArray(data.claimed_rewards) ? data.claimed_rewards : []
    };
  }

  async saveWorldTree(state) {
    if (!this.client) return false;
    const currentUser = await this.refreshAuthenticatedUser();
    if (!currentUser) return false;
    const payload = {
      user_id: currentUser.id,
      planted: Boolean(state?.planted),
      growth: Math.min(1000, Math.max(0, Math.floor(Number(state?.growth || 0)))),
      items: state?.items && typeof state.items === 'object' ? state.items : {},
      claimed_rewards: Array.isArray(state?.claimedRewards) ? state.claimedRewards.map(String) : [],
      updated_at: new Date().toISOString()
    };
    const { data, error } = await this.client
      .from('world_tree_states')
      .upsert(payload, { onConflict: 'user_id' })
      .select('user_id, planted, growth, items, claimed_rewards')
      .maybeSingle();
    if (error) throw error;
    if (!data || data.user_id !== currentUser.id) throw new Error('บันทึกต้นไม้ไม่สำเร็จ');
    return true;
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
    if (!this.client) return false;

    const currentUser = await this.refreshAuthenticatedUser();
    if (!currentUser) return false;

    const userId = currentUser.id;
    const newCoins = Math.max(0, Math.floor(coins));

    // Update only the coins column. Do not use .single()/.select() here:
    // RLS can allow the UPDATE while PostgREST returns no row, which caused
    // the game to report "Cannot coerce the result to a single JSON object".
    const { data, error } = await this.client
      .from('profiles')
      .update({ coins: newCoins, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id, coins')
      .maybeSingle();

    if (error) {
      console.warn('Supabase coins sync failed:', error);
      throw error;
    }

    // UPDATE can return no row when RLS blocks the target row. Treat that as
    // a failed save instead of allowing the game to continue with a local-only
    // balance that will come back after refresh.
    if (!data || data.id !== userId || Number(data.coins) !== newCoins) {
      throw new Error('บันทึกเหรียญไม่สำเร็จ');
    }

    return true;
  }


  async submitTopup(payload) {
    if (!this.client) throw new Error('กรุณาเข้าสู่ระบบก่อนเติมเงิน');
    const currentUser = await this.refreshAuthenticatedUser();
    if (!currentUser) throw new Error('กรุณาเข้าสู่ระบบก่อนเติมเงิน');
    const { data, error } = await this.client.from('topup_requests').insert({
      user_id: currentUser.id,
      method: payload.method,
      amount: payload.amount,
      wallet_link: payload.walletLink || null,
      card_code: payload.cardCode || null,
      proof_image: payload.proofPath || null
    }).select('id, user_id').single();
    if (error) throw error;
    if (!data || data.user_id !== currentUser.id) {
      throw new Error('คำขอเติมเงินไม่ตรงกับบัญชีปัจจุบัน');
    }
    return data;
  }

  async uploadTopupProof(file) {
    if (!this.client) throw new Error('กรุณาเข้าสู่ระบบก่อนเติมเงิน');
    const currentUser = await this.refreshAuthenticatedUser();
    if (!currentUser) throw new Error('กรุณาเข้าสู่ระบบก่อนเติมเงิน');
    const safeName = String(file.name || 'proof').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${currentUser.id}/${Date.now()}_${crypto.randomUUID()}_${safeName}`;
    const { error } = await this.client.storage.from('topup-proofs').upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg'
    });
    if (error) throw error;
    return path;
  }

  async getMyTopups() {
    if (!this.client) return [];
    const currentUser = await this.refreshAuthenticatedUser();
    if (!currentUser) return [];
    const { data, error } = await this.client.from('topup_requests')
      .select('id, method, amount, status, created_at, reviewed_at')
      .eq('user_id', currentUser.id).order('created_at', { ascending:false }).limit(20);
    if (error) throw error;
    return data || [];
  }

  async addRollHistory(items, boxName, timestamp = Date.now()) {
    if (!this.client || !Array.isArray(items)) return;
    const currentUser = await this.refreshAuthenticatedUser();
    if (!currentUser) return;
    const rows = items.map(item => ({
      user_id: currentUser.id,
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

  async getInventory() {
    if (!this.client) return [];
    const currentUser = await this.refreshAuthenticatedUser();
    if (!currentUser) return [];

    const { data, error } = await this.client
      .from('player_inventory')
      .select('items')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (error) throw error;
    // null means the account has no inventory row yet. Keep that distinct
    // from an existing row whose items array is intentionally empty.
    if (!data) return null;
    return Array.isArray(data.items) ? data.items : [];
  }

  async saveInventory(items) {
    if (!this.client) return false;
    const currentUser = await this.refreshAuthenticatedUser();
    if (!currentUser) return false;

    const payload = {
      user_id: currentUser.id,
      items: Array.isArray(items) ? items : [],
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.client
      .from('player_inventory')
      .upsert(payload, { onConflict: 'user_id' })
      .select('user_id, items')
      .maybeSingle();

    if (error) throw error;
    if (!data || data.user_id !== currentUser.id) {
      throw new Error('บันทึกคลังรางวัลไม่สำเร็จ');
    }
    const savedItems = Array.isArray(data.items) ? data.items : [];
    if (JSON.stringify(savedItems) !== JSON.stringify(payload.items)) {
      throw new Error('ข้อมูลคลังรางวัลที่บันทึกไม่ตรงกับข้อมูลล่าสุด');
    }
    return true;
  }

  async createRewardClaim(itemIds = null) {
    if (!this.client) throw new Error('Supabase is not configured');
    const currentUser = await this.refreshAuthenticatedUser();
    if (!currentUser) throw new Error('กรุณาเข้าสู่ระบบก่อนขอรับรางวัล');

    const payload = itemIds === null
      ? { p_item_ids: null }
      : { p_item_ids: Array.isArray(itemIds) ? itemIds.map(String) : [String(itemIds)] };

    const { data, error } = await this.client.rpc('create_reward_claim', payload);
    if (error) throw error;
    if (!data) throw new Error('สร้างคำขอรับรางวัลไม่สำเร็จ');
    return data;
  }

  async getRollHistory() {
    if (!this.client) return [];
    const currentUser = await this.refreshAuthenticatedUser();
    if (!currentUser) return [];
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.client
      .from('gacha_history')
      .select('id, item_name, rarity, icon, box_name, rolled_at')
      .eq('user_id', currentUser.id)
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
