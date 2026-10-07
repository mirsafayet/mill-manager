// ============================================
// Mill Manager - Supabase Configuration
// ============================================
// 1. Go to https://supabase.com and create a free project
// 2. Run the SQL from supabase-schema.sql in the SQL Editor
// 3. Go to Authentication > Users and create an admin user
//    (or use Authentication > Providers > Email)
// 4. Replace the values below with your project credentials
//    (Settings > API > Project URL and anon public key)

const SUPABASE_URL = 'https://nxjeehxxjsvmkxsfecxb.supabase.co/rest/v1/';       // e.g. https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54amVlaHh4anN2bWt4c2ZlY3hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNzEzNDcsImV4cCI6MjEwNjk0NzM0N30.wlNMbQ7tc_Is9Ztuj1cGdeff_KiCsR2PU_h5OTjwLTI';  // e.g. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
