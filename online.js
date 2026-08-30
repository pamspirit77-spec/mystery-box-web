import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ENABLED } from './supabase-config.js';

class OnlineDB {
  constructor() {
    this.client = null;
    this.user = null;
    this.enabled = SUPABASE_ENABLED;
    this.guestKey = localStorage.getItem('mystery_box_guest_key');
    if (!this.guestKey && crypto?.randomUUID) {
      this.guestKey = crypto.randomUUID();
      localStorage.setItem('mystery_box_guest_key', this.guestKey);
    }
    this.guestUsername = localStorage.getItem('mystery_box_guest_name') || `Player_${Math.floor(1000 + Math.random() * 9000)}`;
    localStorage.setItem('mystery_box_guest_name', this.guestUsername);
  }

  async init() {
    if (!this.enabled) return null;

    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const { data: { session } } = await this.client.auth.getSession();
    this.user = session?.user ?? null;

    if (this.user) return await this.loadProfile();

    // Guest wallet: keeps the existing game usable without forcing a login.
    try {
      return await this.loadGuestWallet();
    } catch (err) {
      console.warn('Guest wallet unavailable:', err);
      return null;
    }
  }

  async signUp(email, password, username = '') {
    if (!this.client) throw new Error('Supabase is not configured');
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { data: { username } }
    });
    if (error) throw error;
    return data;
  }

  async signIn(email, password) {
    if (!this.client) throw new Error('Supabase is not configured');
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.user = data.user;
    return await this.loadProfile();
  }

  async signOut() {
    if (!this.client) return;
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
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
        coins: 24
      };
      const { data: created, error: createError } = await this.client
        .from('profiles').insert(profile).select().single();
      if (createError) throw createError;
      return created;
    }
    return data;
  }

  async loadGuestWallet() {
    if (!this.client || !this.guestKey) return null;
    const { data, error } = await this.client.rpc('get_guest_wallet', {
      p_guest_key: this.guestKey,
      p_username: this.guestUsername
    });
    if (error) throw error;
    return data ? { coins: Number(data.coins || 0), username: data.username || this.guestUsername } : null;
  }

  async saveCoins(coins) {
    if (!this.client || !this.user) return;
    const { error } = await this.client
      .from('profiles')
      .update({ coins: Math.max(0, Math.floor(coins)) })
      .eq('id', this.user.id);
    if (error) console.warn('Supabase coins sync failed:', error);
  }

  async spendGuestCoins(amount) {
    if (!this.client || !this.guestKey) return null;
    const { data, error } = await this.client.rpc('spend_guest_coins', {
      p_guest_key: this.guestKey,
      p_amount: Math.max(1, Math.floor(Number(amount)))
    });
    if (error) throw error;
    return Number(data);
  }

  async createTopupRequest({ method, amount, walletLink = '', cardCode = '', imageFile = null }) {
    if (!this.client || !this.guestKey) throw new Error('ระบบออนไลน์ยังไม่พร้อม');
    let imagePath = null;
    if (imageFile) {
      const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      imagePath = `${this.guestKey}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await this.client.storage
        .from('topup-proofs')
        .upload(imagePath, imageFile, { upsert: false, contentType: imageFile.type || 'image/jpeg' });
      if (uploadError) throw uploadError;
    }

    const { data, error } = await this.client
      .from('topup_requests')
      .insert({
        guest_key: this.guestKey,
        player_name: this.guestUsername,
        method,
        amount: Math.floor(Number(amount)),
        wallet_link: walletLink || null,
        card_code: cardCode || null,
        image_path: imagePath
      })
      .select('id, status, amount, method, created_at')
      .single();
    if (error) throw error;
    return data;
  }

  async getMyTopupRequests() {
    if (!this.client || !this.guestKey) return [];
    const { data, error } = await this.client.rpc('get_my_topup_requests', { p_guest_key: this.guestKey });
    if (error) throw error;
    return data || [];
  }

  async getTopupStatus(requestId) {
    if (!this.client || !this.guestKey) return null;
    const { data, error } = await this.client.rpc('get_topup_status', { p_request_id: requestId, p_guest_key: this.guestKey });
    if (error) throw error;
    return data;
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
