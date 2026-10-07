// ============================================
// Mill Manager - Supabase Configuration
// ============================================

const SUPABASE_URL = 'https://nxjeehxxjsvmkxsfecxb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54amVlaHh4anN2bWt4c2ZlY3hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNzEzNDcsImV4cCI6MjEwNjk0NzM0N30.wlNMbQ7tc_Is9Ztuj1cGdeff_KiCsR2PU_h5OTjwLTI';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
