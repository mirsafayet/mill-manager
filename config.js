// ============================================
// Mill Manager - Supabase Configuration
// ============================================
// 1. Go to https://supabase.com and create a free project
// 2. Run the SQL from supabase-schema.sql in the SQL Editor
// 3. Go to Authentication > Users and create an admin user
//    (or use Authentication > Providers > Email)
// 4. Replace the values below with your project credentials
//    (Settings > API > Project URL and anon public key)

const SUPABASE_URL = 'YOUR_SUPABASE_URL';       // e.g. https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';  // e.g. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
