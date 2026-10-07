// ============================================
// Mill Manager - Main Application Logic
// ============================================

const TYPE_LABELS = {
  deposit: 'জমা',
  withdrawal: 'উত্তোলন',
  meal: 'মিল/খাবার',
  rice: 'চাল'
};

const TYPE_BADGE = {
  deposit: 'badge-deposit',
  withdrawal: 'badge-withdrawal',
  meal: 'badge-meal',
  rice: 'badge-rice'
};

// ---------- State ----------
let currentUser = null;
let membersCache = [];
let balancesCache = {};

// ---------- Helpers ----------
function formatMoney(n) {
  const num = Number(n) || 0;
  return '৳' + num.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), duration);
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ---------- Modal ----------
function openModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  document.body.style.overflow = '';
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-backdrop').addEventListener('click', closeModal);

// ---------- Auth ----------
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    showApp();
  } else {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  navigate('dashboard');
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'লগইন হচ্ছে...';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    showApp();
  } catch (err) {
    showError(errEl, err.message || 'লগইন ব্যর্থ হয়েছে');
  } finally {
    btn.disabled = false;
    btn.textContent = 'লগইন';
  }
});

async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
  membersCache = [];
  balancesCache = {};
  showLogin();
}

document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('sidebar-logout').addEventListener('click', logout);

// ---------- Navigation ----------
const pageTitles = {
  dashboard: 'ড্যাশবোর্ড',
  members: 'মেম্বার',
  transactions: 'লেনদেন',
  expenses: 'খরচ',
  monthly: 'মাসিক হিসাব',
  reports: 'রিপোর্ট'
};

function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById('page-' + page).classList.remove('hidden');
  document.getElementById('page-title').textContent = 
...
