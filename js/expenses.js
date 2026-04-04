// expenses.js — Expense Tracking Module
// ============================================================

App.registerPage('expenses', initExpensesPage);

let expData     = [];
let expFilters  = { search: '', dateFrom: '', dateTo: '' };
let expPage     = 1;
const EXP_PAGE  = 20;
let expEventsReady = false; // guard: attach listeners only once

async function initExpensesPage() {
  await renderExpensesSummary();
  await renderExpensesTable();
  setupExpensesEvents();
}

function setupExpensesEvents() {
  if (expEventsReady) return;  // already wired up — skip
  expEventsReady = true;
  const $ = id => document.getElementById(id);

  $('exp-add-btn')?.addEventListener('click', () => openExpenseModal());

  $('exp-search')?.addEventListener('input', e => {
    expFilters.search = e.target.value; expPage = 1; renderExpensesTable();
  });
  $('exp-date-from')?.addEventListener('change', e => {
    expFilters.dateFrom = e.target.value; expPage = 1; renderExpensesTable();
  });
  $('exp-date-to')?.addEventListener('change', e => {
    expFilters.dateTo = e.target.value; expPage = 1; renderExpensesTable();
  });
  $('exp-reset-filter')?.addEventListener('click', () => {
    expFilters = { search: '', dateFrom: '', dateTo: '' };
    $('exp-search').value    = '';
    $('exp-date-from').value = '';
    $('exp-date-to').value   = '';
    expPage = 1;
    renderExpensesTable();
  });

  // Expense form submit
  $('exp-form')?.addEventListener('submit', saveExpense);

  // CSV download
  $('exp-csv-btn')?.addEventListener('click', () => {
    if (!expData.length) { App.toast('No data to export', 'warning'); return; }
    const headers = ['Date', 'Category', 'Description', 'Amount (৳)'];
    const rows    = expData.map(e => [e.date || '', e.category || '', e.description || '', e.amount || 0]);
    downloadCSV('expenses.csv', headers, rows);
    App.toast('CSV downloaded ✅', 'success');
  });
}

// ---- SUMMARY CARDS ----
async function renderExpensesSummary() {
  const allPaid    = await DB.db.monthlyPayments.where('status').equals('Paid').toArray();
  const totalColl  = allPaid.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  const allExp     = await DB.getExpenses();
  const totalExp   = allExp.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const balance    = totalColl - totalExp;

  const setCard = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = App.formatCurrency(val);
  };
  setCard('exp-stat-collection', totalColl);
  setCard('exp-stat-expenses',   totalExp);

  const balEl    = document.getElementById('exp-stat-balance');
  const balCard  = document.getElementById('exp-balance-card');
  if (balEl)   balEl.textContent = App.formatCurrency(balance);
  if (balCard) {
    balCard.style.setProperty('--stat-color', balance >= 0 ? 'var(--success)' : 'var(--danger)');
    balCard.style.setProperty('--stat-bg',    balance >= 0 ? 'var(--success-bg)' : 'rgba(239,68,68,.1)');
  }
}

// ---- TABLE ----
async function renderExpensesTable() {
  expData = await DB.getExpenses(expFilters);

  const total  = expData.length;
  const pages  = Math.max(1, Math.ceil(total / EXP_PAGE));
  expPage      = Math.min(expPage, pages);
  const slice  = expData.slice((expPage - 1) * EXP_PAGE, expPage * EXP_PAGE);

  // Per-page total
  const pageTotal = expData.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const el = document.getElementById('exp-total-badge');
  if (el) el.innerHTML = `<span class="badge badge-danger">💸 Total Spent (filtered): ${App.formatCurrency(pageTotal)}</span>`;

  const tbody = document.getElementById('exp-tbody');
  if (!tbody) return;

  if (slice.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">💸</div><h3>No expenses yet</h3><p>Click "Add Expense" to record a new expense.</p></div></td></tr>`;
  } else {
    tbody.innerHTML = slice.map(e => `
      <tr>
        <td data-label="Date">${App.formatDate(e.date)}</td>
        <td data-label="Category"><span class="badge badge-info" style="font-size:.75rem">${escHtml(e.category || 'General')}</span></td>
        <td data-label="Description">${escHtml(e.description || '—')}</td>
        <td class="td-amount" data-label="Amount" style="color:var(--danger);font-weight:700">${App.formatCurrency(e.amount)}</td>
        <td class="td-actions">
          <button class="action-btn edit" onclick="openExpenseModal(${e.id})">✏️ Edit</button>
          <button class="action-btn delete" onclick="deleteExpenseConfirm(${e.id})">🗑</button>
        </td>
      </tr>`).join('');
  }

  renderPagination('exp-pagination', expPage, pages, p => { expPage = p; renderExpensesTable(); });
}

// ---- MODAL ----
async function openExpenseModal(id = null) {
  const form  = document.getElementById('exp-form');
  const title = document.getElementById('exp-modal-title');
  form.reset();
  document.getElementById('exp-id-hidden').value = '';

  if (id) {
    const e = await DB.db.expenses.get(id);
    if (!e) return;
    title.textContent = '✏️ Edit Expense';
    document.getElementById('exp-id-hidden').value    = id;
    document.getElementById('exp-f-date').value       = e.date        || '';
    document.getElementById('exp-f-category').value   = e.category    || 'General';
    document.getElementById('exp-f-description').value= e.description || '';
    document.getElementById('exp-f-amount').value     = e.amount      || '';
  } else {
    title.textContent = '➕ Add Expense';
    document.getElementById('exp-f-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('exp-f-category').value = 'General';
  }
  App.openModal('expense-modal');
}

async function saveExpense(e) {
  e.preventDefault();
  const id     = parseInt(document.getElementById('exp-id-hidden').value) || null;
  const date   = document.getElementById('exp-f-date').value;
  const cat    = document.getElementById('exp-f-category').value.trim();
  const desc   = document.getElementById('exp-f-description').value.trim();
  const amount = parseFloat(document.getElementById('exp-f-amount').value) || 0;

  if (!date)   { App.toast('Date is required', 'error'); return; }
  if (amount <= 0) { App.toast('Amount must be greater than 0', 'error'); return; }

  const data = { date, category: cat || 'General', description: desc, amount };

  if (id) {
    await DB.updateExpense(id, data);
    App.toast('Expense updated ✅', 'success');
  } else {
    await DB.addExpense(data);
    App.toast('Expense added ✅', 'success');
  }

  App.closeAllModals();
  await renderExpensesSummary();
  await renderExpensesTable();
}

function deleteExpenseConfirm(id) {
  App.confirm('Delete Expense', 'Are you sure you want to delete this expense record?', async () => {
    await DB.deleteExpense(id);
    App.toast('Expense deleted', 'warning');
    await renderExpensesSummary();
    await renderExpensesTable();
  }, true);
}

// expose
window.openExpenseModal     = openExpenseModal;
window.deleteExpenseConfirm = deleteExpenseConfirm;
