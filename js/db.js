// db.js — IndexedDB layer via Dexie
// ============================================================

const db = new Dexie('aRAFAT_DB');

db.version(1).stores({
  members:        '++id, memberId, fullName, mobile, nid, joinDate',
  monthlyPayments:'++id, memberId, month, year, status',
  yearlyPayments: '++id, memberId, year, status',
  settings:       'key'
});

db.version(2).stores({
  members:        '++id, memberId, fullName, mobile, nid, joinDate',
  monthlyPayments:'++id, memberId, month, year, status',
  yearlyPayments: '++id, memberId, year, status',
  settings:       'key',
  expenses:       '++id, date, category'
});

// ============================================================
// SETTINGS HELPERS
// ============================================================
async function getSetting(key, fallback) {
  const row = await db.settings.get(key);
  return row ? row.value : fallback;
}
async function setSetting(key, value) {
  await db.settings.put({ key, value });
}
async function getAllSettings() {
  const rows = await db.settings.toArray();
  const out = {};
  rows.forEach(r => out[r.key] = r.value);
  return out;
}

// Default settings initializer
async function initSettings() {
  const defaults = {
    monthlyAmount:   2500,
    theme:           'dark',
    adminHash:       await sha256('admin123'),   // default password
    appName:         'aRAFAT Association'
  };
  for (const [k, v] of Object.entries(defaults)) {
    const existing = await db.settings.get(k);
    if (!existing) await db.settings.put({ key: k, value: v });
  }
}

// ============================================================
// MEMBER HELPERS
// ============================================================
function generateMemberId(index) {
  return 'M-' + String(index).padStart(3, '0');
}

async function getNextMemberId() {
  const all = await db.members.toArray();
  if (all.length === 0) return 'M-001';
  const nums = all.map(m => parseInt(m.memberId.replace('M-', '')) || 0);
  return 'M-' + String(Math.max(...nums) + 1).padStart(3, '0');
}

async function addMember(data) {
  const memberId = await getNextMemberId();
  const now = new Date().toISOString();
  const id = await db.members.add({ 
    ...data, 
    memberId, 
    joinDate: data.joinDate || now.split('T')[0],
    createdAt: now,
    updatedAt: now
  });
  return { id, memberId };
}
async function updateMember(id, data) { 
  await db.members.update(id, { ...data, updatedAt: new Date().toISOString() }); 
}
async function deleteMember(id) {
  const member = await db.members.get(id);
  await db.members.delete(id);
  if (member?.memberId) {
    const mpIds = await db.monthlyPayments.toArray()
      .then(arr => arr.filter(p => p.memberId === member.memberId).map(p => p.id));
    if (mpIds.length) await db.monthlyPayments.bulkDelete(mpIds);
  }
}
async function getMembers(search = '') {
  const all = await db.members.toArray();
  if (!search) return all.sort((a,b) => a.memberId.localeCompare(b.memberId));
  const q = search.toLowerCase();
  return all.filter(m =>
    m.fullName.toLowerCase().includes(q) ||
    m.memberId.toLowerCase().includes(q) ||
    (m.mobile && m.mobile.includes(q))
  ).sort((a,b) => a.memberId.localeCompare(b.memberId));
}

// ============================================================
// PAYMENT HELPERS — MONTHLY
// ============================================================
async function getMonthlyPayments(filters = {}) {
  let q = db.monthlyPayments.toCollection();
  const all = await q.toArray();
  return all.filter(p => {
    if (filters.memberId && p.memberId !== filters.memberId) return false;
    if (filters.month !== undefined && filters.month !== '' && p.month != filters.month) return false;
    if (filters.year !== undefined && filters.year !== '' && p.year != filters.year) return false;
    if (filters.status && p.status !== filters.status) return false;
    return true;
  }).sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return b.month - a.month;
  });
}

async function ensureMonthlyPayments(year, month) {
  const members = await db.members.toArray();
  const amount  = await getSetting('monthlyAmount', 2500);
  const existing = await db.monthlyPayments.toArray();
  const now = new Date().toISOString();
  for (const m of members) {
    const found = existing.some(
      p => p.memberId === m.memberId && p.month === month && p.year === year
    );
    if (!found) {
      await db.monthlyPayments.add({
        memberId: m.memberId,
        memberName: m.fullName,
        month, year, amount,
        status: 'Unpaid',
        paymentDate: null,
        notes: '',
        createdAt: now,
        updatedAt: now
      });
    }
  }
}

async function markMonthlyPaid(id, paymentDate, notes = '') {
  await db.monthlyPayments.update(id, { 
    status: 'Paid', 
    paymentDate, 
    notes,
    updatedAt: new Date().toISOString()
  });
}
async function markMonthlyUnpaid(id) {
  await db.monthlyPayments.update(id, { 
    status: 'Unpaid', 
    paymentDate: null,
    updatedAt: new Date().toISOString()
  });
}
async function updateMonthlyPayment(id, data) { 
  await db.monthlyPayments.update(id, { 
    ...data, 
    updatedAt: new Date().toISOString() 
  }); 
}

// ============================================================
// EXPENSE HELPERS
// ============================================================
async function addExpense(data) {
  const now = new Date().toISOString();
  return await db.expenses.add({ ...data, createdAt: now, updatedAt: now });
}
async function getExpenses(filters = {}) {
  let all = await db.expenses.toArray();
  if (filters.search) {
    const q = filters.search.toLowerCase();
    all = all.filter(e => e.description?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q));
  }
  if (filters.dateFrom) all = all.filter(e => e.date >= filters.dateFrom);
  if (filters.dateTo)   all = all.filter(e => e.date <= filters.dateTo);
  return all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
async function updateExpense(id, data) {
  await db.expenses.update(id, { ...data, updatedAt: new Date().toISOString() });
}
async function deleteExpense(id) {
  await db.expenses.delete(id);
}

// ============================================================
// DASHBOARD STATS
// ============================================================
async function getDashboardStats(year, month) {
  const membersCount = await db.members.count();
  const mpAll        = await db.monthlyPayments.toArray();

  const mpFiltered   = mpAll.filter(p => p.year === year && p.month === month);
  const monthCol     = mpFiltered.filter(p => p.status === 'Paid').reduce((s,p) => s + (p.amount||0), 0);
  const monthUnpaid  = mpFiltered.filter(p => p.status === 'Unpaid').length;
  const monthPaid    = mpFiltered.filter(p => p.status === 'Paid').length;

  const totalCollected = mpAll.filter(p=>p.status==='Paid').reduce((s,p)=>s+(p.amount||0),0);

  // Expense totals for balance calculation
  const allExpenses   = await db.expenses.toArray();
  const totalExpenses = allExpenses.reduce((s,e) => s + (parseFloat(e.amount)||0), 0);
  const availBalance  = totalCollected - totalExpenses;

  return { members: membersCount, monthCol, monthPaid, monthUnpaid, totalCollected, totalExpenses, availBalance };
}

async function getMonthlyChartData(year) {
  const mpAll = await db.monthlyPayments.toArray();
  const months = Array.from({length:12},(_,i)=>i+1);
  const paid   = months.map(m => mpAll.filter(p=>p.year===year&&p.month===m&&p.status==='Paid').reduce((s,p)=>s+(p.amount||0),0));
  const unpaid = months.map(m => mpAll.filter(p=>p.year===year&&p.month===m&&p.status==='Unpaid').reduce((s,p)=>s+(p.amount||0),0));
  return { months, paid, unpaid };
}



// ============================================================
// FULL EXPORT / IMPORT
// ============================================================
async function exportFullBackup() {
  const members         = await db.members.toArray();
  const monthlyPayments = await db.monthlyPayments.toArray();
  const yearlyPayments  = await db.yearlyPayments.toArray();
  const expenses        = await db.expenses.toArray();
  const settings        = await getAllSettings();
  
  return {
    metadata: {
      version: '2.0',
      exportTimestamp: new Date().toISOString(),
      appName: await getSetting('appName', 'aRAFAT')
    },
    tables: {
      members,
      monthlyPayments,
      yearlyPayments,
      expenses,
      settings
    }
  };
}

async function importFullBackup(data, mode = 'replace', onProgress) {
  // Legacy support or new structure check
  const tables = data.tables || data;
  const metadata = data.metadata || { version: '1.0' };

  if (mode === 'replace') {
    if (onProgress) onProgress('Clearing existing data...');
    await db.members.clear();
    await db.monthlyPayments.clear();
    await db.yearlyPayments.clear();
    await db.settings.clear();
    if (db.expenses) await db.expenses.clear();
  }

  const keys = Object.keys(tables);
  for (let i = 0; i < keys.length; i++) {
    const table = keys[i];
    const rows  = tables[table];
    if (!rows) continue;

    if (onProgress) onProgress(`Restoring ${table}... (${rows.length} records)`);
    
    if (table === 'settings' && typeof rows === 'object' && !Array.isArray(rows)) {
      // Handle legacy settings object
      for (const [key, value] of Object.entries(rows)) {
        await db.settings.put({ key, value, updatedAt: new Date().toISOString() });
      }
    } else if (Array.isArray(rows)) {
      // Bulk put handles overwrite or merge based on keys
      // Add updatedAt to all rows if missing
      const rowsWithTime = rows.map(r => ({ ...r, updatedAt: r.updatedAt || new Date().toISOString() }));
      await db[table].bulkPut(rowsWithTime);
    }
  }
}

// ============================================================
// SECURITY
// ============================================================
async function sha256(str) {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function verifyPassword(input) {
  const hash  = await sha256(input);
  const stored= await getSetting('adminHash', null);
  return hash === stored;
}

async function changePassword(newPass) {
  const hash = await sha256(newPass);
  await setSetting('adminHash', hash);
}

// expose globals
window.DB = {
  db,
  getSetting, setSetting, getAllSettings, initSettings,
  addMember, updateMember, deleteMember, getMembers, getNextMemberId,
  ensureMonthlyPayments, getMonthlyPayments, markMonthlyPaid, markMonthlyUnpaid, updateMonthlyPayment,
  addExpense, getExpenses, updateExpense, deleteExpense,
  getDashboardStats, getMonthlyChartData,
  exportFullBackup, importFullBackup,
  sha256, verifyPassword, changePassword
};
