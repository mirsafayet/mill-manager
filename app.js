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

let currentUser = null;
let membersCache = [];
let balancesCache = {};

const $ = (id) => document.getElementById(id);

function formatMoney(n) {
  const num = Number(n) || 0;
  return '৳' + num.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(String(d).length === 10 ? `${d}T00:00:00` : d);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}

function todayStr() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

function showToast(msg, duration = 2500) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), duration);
}

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function friendlyError(error, fallback = 'কাজটি সম্পন্ন করা যায়নি') {
  if (!error) return fallback;
  if (error.code === 'PGRST116') return 'তথ্য পাওয়া যায়নি।';
  if (error.code === '42501') return 'এই কাজ করার অনুমতি নেই। Supabase RLS policy পরীক্ষা করুন।';
  return error.message || fallback;
}

// ---------- Modal ----------
function openModal(title, bodyHtml) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = bodyHtml;
  $('modal').classList.remove('hidden');
  $('modal').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $('modal').classList.add('hidden');
  $('modal').setAttribute('aria-hidden', 'true');
  $('modal-body').innerHTML = '';
  document.body.style.overflow = '';
}

// ---------- Auth ----------
async function checkSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    currentUser = data.session?.user || null;
    currentUser ? showApp() : showLogin();
  } catch (error) {
    console.error(error);
    showLogin();
    showToast('সেশন যাচাই করা যায়নি।');
  }
}

function showLogin() {
  $('login-screen').classList.remove('hidden');
  $('app-screen').classList.add('hidden');
}

async function showApp() {
  $('login-screen').classList.add('hidden');
  $('app-screen').classList.remove('hidden');
  await navigate('dashboard');
}

async function handleLogin(e) {
  e.preventDefault();
  const email = $('login-email').value.trim();
  const password = $('login-password').value;
  const errEl = $('login-error');
  const btn = $('login-btn');
  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'লগইন হচ্ছে...';
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    await showApp();
  } catch (error) {
    showError(errEl, friendlyError(error, 'লগইন ব্যর্থ হয়েছে'));
  } finally {
    btn.disabled = false;
    btn.textContent = 'লগইন';
  }
}

async function logout() {
  try { await supabase.auth.signOut(); } catch (error) { console.error(error); }
  currentUser = null;
  membersCache = [];
  balancesCache = {};
  showLogin();
}

// ---------- Navigation ----------
const pageTitles = {
  dashboard: 'ড্যাশবোর্ড',
  members: 'মেম্বার',
  transactions: 'লেনদেন',
  expenses: 'খরচ',
  monthly: 'মাসিক হিসাব',
  reports: 'রিপোর্ট'
};

async function navigate(page) {
  if (!pageTitles[page]) page = 'dashboard';
  document.querySelectorAll('.page').forEach((p) => p.classList.add('hidden'));
  const target = $('page-' + page);
  if (target) target.classList.remove('hidden');
  $('page-title').textContent = pageTitles[page];
  document.querySelectorAll('.nav-item[data-page]').forEach((item) => item.classList.toggle('active', item.dataset.page === page));
  $('sidebar')?.classList.remove('open');
  $('sidebar-overlay')?.classList.remove('show');

  try {
    if (page === 'dashboard') await loadDashboard();
    if (page === 'members') await loadMembers();
    if (page === 'transactions') await loadTransactions();
    if (page === 'expenses') await loadExpenses();
    if (page === 'monthly') await loadMonthly();
  } catch (error) {
    console.error(error);
    showToast(friendlyError(error));
  }
}

// ---------- Data helpers ----------
async function fetchMembers() {
  const { data, error } = await supabase.from('members').select('*').order('name', { ascending: true });
  if (error) throw error;
  membersCache = data || [];
  return membersCache;
}

async function fetchTransactions(limit = null) {
  let query = supabase.from('transactions').select('*, members(name)').order('date', { ascending: false }).order('created_at', { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function fetchExpenses(limit = null) {
  let query = supabase.from('expenses').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

function calculateBalances(members, transactions) {
  const result = {};
  members.forEach((m) => { result[m.id] = 0; });
  transactions.forEach((t) => {
    if (!result[t.member_id] && result[t.member_id] !== 0) result[t.member_id] = 0;
    const amount = Number(t.amount) || 0;
    if (t.type === 'deposit') result[t.member_id] += amount;
    else if (t.type === 'withdrawal') result[t.member_id] -= amount;
  });
  return result;
}

// ---------- Dashboard ----------
async function loadDashboard() {
  const [members, transactions, expenses] = await Promise.all([fetchMembers(), fetchTransactions(), fetchExpenses()]);
  balancesCache = calculateBalances(members, transactions);

  const deposits = transactions.filter((t) => t.type === 'deposit').reduce((s, t) => s + Number(t.amount || 0), 0);
  const withdrawals = transactions.filter((t) => t.type === 'withdrawal').reduce((s, t) => s + Number(t.amount || 0), 0);
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  $('stat-members').textContent = members.length.toLocaleString('bn-BD');
  $('stat-deposit').textContent = formatMoney(deposits);
  $('stat-withdrawal').textContent = formatMoney(withdrawals);
  $('stat-expenses').textContent = formatMoney(expenseTotal);

  renderRecentTransactions(transactions.slice(0, 8), 'recent-transactions');
  renderMemberBalances(members, balancesCache, 'member-balances');
}

function renderRecentTransactions(rows, targetId) {
  const target = $(targetId);
  if (!rows.length) {
    target.innerHTML = '<p class="empty-state">কোনো লেনদেন নেই</p>';
    return;
  }
  target.innerHTML = `<table><thead><tr><th>তারিখ</th><th>মেম্বার</th><th>ধরন</th><th>পরিমাণ</th></tr></thead><tbody>${rows.map((t) => `<tr><td>${formatDate(t.date)}</td><td>${escapeHtml(t.members?.name || t.member_name || '—')}</td><td><span class="badge ${TYPE_BADGE[t.type] || ''}">${TYPE_LABELS[t.type] || escapeHtml(t.type)}</span></td><td>${formatMoney(t.amount)}</td></tr>`).join('')}</tbody></table>`;
}

function renderMemberBalances(members, balances, targetId) {
  const target = $(targetId);
  if (!members.length) {
    target.innerHTML = '<p class="empty-state">কোনো মেম্বার নেই</p>';
    return;
  }
  const rows = members.map((m) => ({ member: m, balance: Number(balances[m.id] || 0) })).sort((a, b) => a.balance - b.balance).slice(0, 10);
  target.innerHTML = `<table><thead><tr><th>মেম্বার</th><th>মোবাইল</th><th>ব্যালেন্স</th></tr></thead><tbody>${rows.map(({ member, balance }) => `<tr><td>${escapeHtml(member.name)}</td><td>${escapeHtml(member.phone || '—')}</td><td class="${balance < 0 ? 'negative' : ''}">${formatMoney(balance)}</td></tr>`).join('')}</tbody></table>`;
}

// ---------- Members ----------
async function loadMembers() {
  const members = await fetchMembers();
  const target = $('members-list');
  if (!members.length) {
    target.innerHTML = '<p class="empty-state">কোনো মেম্বার নেই</p>';
    return;
  }
  const transactions = await fetchTransactions();
  balancesCache = calculateBalances(members, transactions);
  target.innerHTML = `<table><thead><tr><th>নাম</th><th>মোবাইল</th><th>ঠিকানা</th><th>স্ট্যাটাস</th><th>ব্যালেন্স</th><th>অ্যাকশন</th></tr></thead><tbody>${members.map((m) => {
    const balance = Number(balancesCache[m.id] || 0);
    return `<tr><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.phone || '—')}</td><td>${escapeHtml(m.address || '—')}</td><td>${m.active === false ? 'নিষ্ক্রিয়' : 'সক্রিয়'}</td><td class="${balance < 0 ? 'negative' : ''}">${formatMoney(balance)}</td><td><button class="btn btn-secondary btn-sm" data-edit-member="${m.id}">এডিট</button> <button class="btn btn-danger btn-sm" data-delete-member="${m.id}">মুছুন</button></td></tr>`;
  }).join('')}</tbody></table>`;
}

function memberForm(member = {}) {
  return `<form id="member-form">
    <div class="form-group"><label>নাম *</label><input id="member-name" required value="${escapeHtml(member.name || '')}" /></div>
    <div class="form-row"><div class="form-group"><label>মোবাইল</label><input id="member-phone" value="${escapeHtml(member.phone || '')}" /></div><div class="form-group"><label>স্ট্যাটাস</label><select id="member-active"><option value="true" ${member.active !== false ? 'selected' : ''}>সক্রিয়</option><option value="false" ${member.active === false ? 'selected' : ''}>নিষ্ক্রিয়</option></select></div></div>
    <div class="form-group"><label>ঠিকানা</label><textarea id="member-address">${escapeHtml(member.address || '')}</textarea></div>
    <button class="btn btn-primary btn-block" type="submit">${member.id ? 'আপডেট করুন' : 'যোগ করুন'}</button>
  </form>`;
}

function openMemberModal(member = null) {
  openModal(member ? 'মেম্বার সম্পাদনা' : 'নতুন মেম্বার', memberForm(member || {}));
  $('member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = { name: $('member-name').value.trim(), phone: $('member-phone').value.trim() || null, address: $('member-address').value.trim() || null, active: $('member-active').value === 'true' };
    if (!payload.name) return;
    try {
      const result = member?.id ? await supabase.from('members').update(payload).eq('id', member.id) : await supabase.from('members').insert(payload);
      if (result.error) throw result.error;
      closeModal(); showToast(member ? 'মেম্বার আপডেট হয়েছে' : 'মেম্বার যোগ হয়েছে'); await loadMembers();
    } catch (error) { showToast(friendlyError(error)); }
  });
}

async function deleteMember(id) {
  if (!confirm('এই মেম্বার মুছে ফেলবেন?')) return;
  try {
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) throw error;
    showToast('মেম্বার মুছে ফেলা হয়েছে'); await loadMembers();
  } catch (error) { showToast(friendlyError(error)); }
}

// ---------- Transactions ----------
async function loadTransactions() {
  const rows = await fetchTransactions();
  const target = $('transactions-list');
  if (!rows.length) { target.innerHTML = '<p class="empty-state">কোনো লেনদেন নেই</p>'; return; }
  target.innerHTML = `<table><thead><tr><th>তারিখ</th><th>মেম্বার</th><th>ধরন</th><th>পরিমাণ</th><th>নোট</th><th>অ্যাকশন</th></tr></thead><tbody>${rows.map((t) => `<tr><td>${formatDate(t.date)}</td><td>${escapeHtml(t.members?.name || '—')}</td><td><span class="badge ${TYPE_BADGE[t.type] || ''}">${TYPE_LABELS[t.type] || escapeHtml(t.type)}</span></td><td>${formatMoney(t.amount)}</td><td>${escapeHtml(t.note || '—')}</td><td><button class="btn btn-danger btn-sm" data-delete-transaction="${t.id}">মুছুন</button></td></tr>`).join('')}</tbody></table>`;
}

function transactionForm() {
  const options = membersCache.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  return `<form id="transaction-form">
    <div class="form-row"><div class="form-group"><label>মেম্বার *</label><select id="transaction-member" required><option value="">নির্বাচন করুন</option>${options}</select></div><div class="form-group"><label>ধরন *</label><select id="transaction-type" required><option value="deposit">জমা</option><option value="withdrawal">উত্তোলন</option><option value="meal">মিল/খাবার</option><option value="rice">চাল</option></select></div></div>
    <div class="form-row"><div class="form-group"><label>পরিমাণ *</label><input type="number" id="transaction-amount" min="0" step="0.01" required /></div><div class="form-group"><label>তারিখ *</label><input type="date" id="transaction-date" value="${todayStr()}" required /></div></div>
    <div class="form-group"><label>নোট</label><textarea id="transaction-note"></textarea></div>
    <button class="btn btn-primary btn-block" type="submit">লেনদেন সংরক্ষণ</button>
  </form>`;
}

async function openTransactionModal() {
  if (!membersCache.length) await fetchMembers();
  if (!membersCache.length) { showToast('আগে অন্তত একজন মেম্বার যোগ করুন।'); return; }
  openModal('নতুন লেনদেন', transactionForm());
  $('transaction-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = { member_id: $('transaction-member').value, type: $('transaction-type').value, amount: Number($('transaction-amount').value), date: $('transaction-date').value, note: $('transaction-note').value.trim() || null };
    try {
      const { error } = await supabase.from('transactions').insert(payload);
      if (error) throw error;
      closeModal(); showToast('লেনদেন সংরক্ষণ হয়েছে'); await loadTransactions();
    } catch (error) { showToast(friendlyError(error)); }
  });
}

async function deleteTransaction(id) {
  if (!confirm('এই লেনদেন মুছে ফেলবেন?')) return;
  try { const { error } = await supabase.from('transactions').delete().eq('id', id); if (error) throw error; showToast('লেনদেন মুছে ফেলা হয়েছে'); await loadTransactions(); }
  catch (error) { showToast(friendlyError(error)); }
}

// ---------- Expenses ----------
async function loadExpenses() {
  const rows = await fetchExpenses();
  const target = $('expenses-list');
  if (!rows.length) { target.innerHTML = '<p class="empty-state">কোনো খরচ নেই</p>'; return; }
  target.innerHTML = `<table><thead><tr><th>তারিখ</th><th>খাত</th><th>পরিমাণ</th><th>নোট</th><th>অ্যাকশন</th></tr></thead><tbody>${rows.map((e) => `<tr><td>${formatDate(e.date)}</td><td>${escapeHtml(e.title || e.category || '—')}</td><td>${formatMoney(e.amount)}</td><td>${escapeHtml(e.note || '—')}</td><td><button class="btn btn-danger btn-sm" data-delete-expense="${e.id}">মুছুন</button></td></tr>`).join('')}</tbody></table>`;
}

function expenseForm() {
  return `<form id="expense-form"><div class="form-group"><label>খরচের খাত *</label><input id="expense-title" required /></div><div class="form-row"><div class="form-group"><label>পরিমাণ *</label><input type="number" id="expense-amount" min="0" step="0.01" required /></div><div class="form-group"><label>তারিখ *</label><input type="date" id="expense-date" value="${todayStr()}" required /></div></div><div class="form-group"><label>নোট</label><textarea id="expense-note"></textarea></div><button class="btn btn-primary btn-block" type="submit">খরচ সংরক্ষণ</button></form>`;
}

function openExpenseModal() {
  openModal('নতুন খরচ', expenseForm());
  $('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = { title: $('expense-title').value.trim(), amount: Number($('expense-amount').value), date: $('expense-date').value, note: $('expense-note').value.trim() || null };
    try { const { error } = await supabase.from('expenses').insert(payload); if (error) throw error; closeModal(); showToast('খরচ সংরক্ষণ হয়েছে'); await loadExpenses(); }
    catch (error) { showToast(friendlyError(error)); }
  });
}

async function deleteExpense(id) {
  if (!confirm('এই খরচ মুছে ফেলবেন?')) return;
  try { const { error } = await supabase.from('expenses').delete().eq('id', id); if (error) throw error; showToast('খরচ মুছে ফেলা হয়েছে'); await loadExpenses(); }
  catch (error) { showToast(friendlyError(error)); }
}

// ---------- Monthly ----------
function currentMonth() { return todayStr().slice(0, 7); }

async function loadMonthly() {
  const month = $('monthly-filter').value || currentMonth();
  $('monthly-filter').value = month;
  const start = `${month}-01`;
  const endDate = new Date(`${month}-01T00:00:00`);
  endDate.setMonth(endDate.getMonth() + 1);
  const end = endDate.toISOString().slice(0, 10);
  const [{ data: transactions, error: txError }, { data: expenses, error: exError }, members] = await Promise.all([
    supabase.from('transactions').select('*, members(name)').gte('date', start).lt('date', end),
    supabase.from('expenses').select('*').gte('date', start).lt('date', end),
    fetchMembers()
  ]);
  if (txError) throw txError;
  if (exError) throw exError;
  const tx = transactions || [];
  const ex = expenses || [];
  $('monthly-deposit').textContent = formatMoney(tx.filter((t) => t.type === 'deposit').reduce((s, t) => s + Number(t.amount || 0), 0));
  $('monthly-withdrawal').textContent = formatMoney(tx.filter((t) => t.type === 'withdrawal').reduce((s, t) => s + Number(t.amount || 0), 0));
  $('monthly-expenses').textContent = formatMoney(ex.reduce((s, e) => s + Number(e.amount || 0), 0));

  const map = {};
  members.forEach((m) => { map[m.id] = { name: m.name, deposit: 0, withdrawal: 0, other: 0 }; });
  tx.forEach((t) => { if (!map[t.member_id]) map[t.member_id] = { name: t.members?.name || '—', deposit: 0, withdrawal: 0, other: 0 }; const amount = Number(t.amount || 0); if (t.type === 'deposit') map[t.member_id].deposit += amount; else if (t.type === 'withdrawal') map[t.member_id].withdrawal += amount; else map[t.member_id].other += amount; });
  const rows = Object.values(map).filter((r) => r.deposit || r.withdrawal || r.other);
  $('monthly-list').innerHTML = rows.length ? `<table><thead><tr><th>মেম্বার</th><th>জমা</th><th>উত্তোলন</th><th>অন্যান্য</th><th>নেট</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${escapeHtml(r.name)}</td><td>${formatMoney(r.deposit)}</td><td>${formatMoney(r.withdrawal)}</td><td>${formatMoney(r.other)}</td><td>${formatMoney(r.deposit - r.withdrawal)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty-state">এই মাসে কোনো হিসাব নেই</p>';
}

// ---------- Reports ----------
async function generateReport() {
  const [transactions, expenses, members] = await Promise.all([fetchTransactions(), fetchExpenses(), fetchMembers()]);
  const deposits = transactions.filter((t) => t.type === 'deposit').reduce((s, t) => s + Number(t.amount || 0), 0);
  const withdrawals = transactions.filter((t) => t.type === 'withdrawal').reduce((s, t) => s + Number(t.amount || 0), 0);
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const net = deposits - withdrawals - expenseTotal;
  $('reports-content').innerHTML = `<div class="report-summary"><h3>মিল ম্যানেজার রিপোর্ট</h3><p>তৈরির তারিখ: ${formatDate(todayStr())}</p><div class="stats-grid"><div class="stat-card"><div class="stat-info"><span class="stat-label">মোট মেম্বার</span><span class="stat-value">${members.length}</span></div></div><div class="stat-card"><div class="stat-info"><span class="stat-label">মোট জমা</span><span class="stat-value">${formatMoney(deposits)}</span></div></div><div class="stat-card"><div class="stat-info"><span class="stat-label">মোট উত্তোলন</span><span class="stat-value">${formatMoney(withdrawals)}</span></div></div><div class="stat-card"><div class="stat-info"><span class="stat-label">মোট খরচ</span><span class="stat-value">${formatMoney(expenseTotal)}</span></div></div></div><p><strong>নেট হিসাব:</strong> ${formatMoney(net)}</p></div>`;
}

// ---------- Events / Bootstrap ----------
function bindEvents() {
  $('modal-close').addEventListener('click', closeModal);
  $('modal-backdrop').addEventListener('click', closeModal);
  $('login-form').addEventListener('submit', handleLogin);
  $('logout-btn').addEventListener('click', logout);
  $('sidebar-logout').addEventListener('click', logout);
  $('add-member-btn').addEventListener('click', () => openMemberModal());
  $('add-transaction-btn').addEventListener('click', openTransactionModal);
  $('add-expense-btn').addEventListener('click', openExpenseModal);
  $('monthly-filter').addEventListener('change', loadMonthly);
  $('generate-report-btn').addEventListener('click', generateReport);

  $('menu-btn').addEventListener('click', () => {
    $('sidebar').classList.toggle('open');
    $('sidebar-overlay').classList.toggle('show');
  });
  $('sidebar-overlay').addEventListener('click', () => {
    $('sidebar').classList.remove('open');
    $('sidebar-overlay').classList.remove('show');
  });

  document.addEventListener('click', (e) => {
    const pageButton = e.target.closest('[data-page]');
    if (pageButton && pageTitles[pageButton.dataset.page]) { e.preventDefault(); navigate(pageButton.dataset.page); return; }
    const editMember = e.target.closest('[data-edit-member]');
    if (editMember) { const member = membersCache.find((m) => String(m.id) === String(editMember.dataset.editMember)); if (member) openMemberModal(member); return; }
    const deleteMemberButton = e.target.closest('[data-delete-member]');
    if (deleteMemberButton) { deleteMember(deleteMemberButton.dataset.deleteMember); return; }
    const deleteTxButton = e.target.closest('[data-delete-transaction]');
    if (deleteTxButton) { deleteTransaction(deleteTxButton.dataset.deleteTransaction); return; }
    const deleteExpenseButton = e.target.closest('[data-delete-expense]');
    if (deleteExpenseButton) { deleteExpense(deleteExpenseButton.dataset.deleteExpense); }
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('modal').classList.contains('hidden')) closeModal(); });

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    if (!currentUser) showLogin();
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  $('monthly-filter').value = currentMonth();
  await checkSession();
});
