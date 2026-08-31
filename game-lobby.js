import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ENABLED } from './supabase-config.js';

const AUTH_STORAGE_KEY = 'mystery-box-player-auth';
const backButton = document.getElementById('backMysteryBox');
const usernameEl = document.getElementById('username');
const guard = document.getElementById('authGuard');

function goBackToMysteryBox() {
  window.location.href = 'index.html';
}

backButton?.addEventListener('click', goBackToMysteryBox);

async function initLobby() {
  if (!SUPABASE_ENABLED) {
    goBackToMysteryBox();
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: AUTH_STORAGE_KEY
    }
  });

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      guard?.classList.remove('hidden');
      setTimeout(goBackToMysteryBox, 500);
      return;
    }

    const user = session.user;
    let username = user.user_metadata?.username || 'ผู้ใช้';

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.username) username = profile.username;
    if (usernameEl) usernameEl.textContent = username;
  } catch (error) {
    console.warn('Game Lobby auth check failed:', error);
    guard?.classList.remove('hidden');
    setTimeout(goBackToMysteryBox, 500);
  }
}

initLobby();
