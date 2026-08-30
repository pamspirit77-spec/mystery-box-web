import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ENABLED } from './supabase-config.js';

class OnlineDB {
  constructor() {
    this.client = null;
    this.user = null;
    this.enabled = SUPABASE_ENABLED;
  }

  async init() {
    if (!this.enabled) return null;

    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const { data: { session } } = await this.client.auth.getSession();
    this.user = session?.user ?? null;

    // No anonymous account: the real account system will use Supabase Auth.
    // This keeps the game usable locally until Login/Register is connected.
    return this.user ? await this.loadProfile() : null;
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

  async saveCoins(coins) {
    if (!this.client || !this.user) return;
    const { error } = await this.client
      .from('profiles')
      .update({ coins: Math.max(0, Math.floor(coins)) })
      .eq('id', this.user.id);
    if (error) console.warn('Supabase coins sync failed:', error);
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
