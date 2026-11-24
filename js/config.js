/* ═══ MYOKINETICS OS v4 — CONFIG for hosted builds ═══
   Fill these in when Myo is deployed at its own web address, so members never see the setup form.
   supabaseKey must be the PUBLISHABLE key (sb_publishable_…) or the legacy anon key. It is designed to be
   public; Row Level Security (supabase/schema.sql) is what protects member data.
   Never put a secret or service_role key here. Those belong only in the wearables proxy. */
window.MYO_CONFIG = window.MYO_CONFIG || {
  supabaseUrl: 'https://bnunlrbinlssvbycrvps.supabase.co',  // e.g. https://your-project.supabase.co
  supabaseKey: 'sb_publishable_2EIezrzPGKsJvwPTHQiIcQ_SMOxUZCi',  // e.g. sb_publishable_…
  wearablesProxy: 'https://bnunlrbinlssvbycrvps.supabase.co/functions/v1/wearables', // e.g. https://your-project.supabase.co/functions/v1/wearables (supabase/WEARABLES_PROXY.md)
  ingestApi: 'https://bnunlrbinlssvbycrvps.supabase.co/functions/v1/ingest'       // e.g. https://your-project.supabase.co/functions/v1/ingest (supabase/INGEST_API.md); defaults to the project's
};
