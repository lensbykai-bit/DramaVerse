window.DRAMAVERSE_SUPABASE = {
  url: 'https://wkewfmvhmraopcecbbze.supabase.co',
  publishableKey: 'sb_publishable_PyHTq_nzj3tFJAiMJQuQvg_JMFDh8lS'
};

if (window.supabase && window.DRAMAVERSE_SUPABASE) {
  const { url, publishableKey } = window.DRAMAVERSE_SUPABASE;
  window.dvSupabase = window.supabase.createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}
