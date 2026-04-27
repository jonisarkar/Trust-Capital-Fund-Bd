// extras.js — Extra Income / Special Collection Module
// ============================================================

App.registerPage('extras', initExtrasPage);

let extraData    = [];
let extraFilters = { search: '', dateFrom: '', dateTo: '' };
let extraPage    = 1;
const EXTRA_PER_PAGE = 20;
let extraEventsReady = false;

const EXTRA_CATEGORIES = [
  'বিশেষ চাঁদা',
  'দান / অনুদান',
  'ব্যাংক সুদ',
  'জরিমানা',
  'ইভেন্ট আয়',
  'সদস্যতা ফি',
  'অন্যান্য'
];

async function initExtrasPage() {
  await renderExtrasSummary();
  await renderExtrasTable();
  setupExtrasEvents();
}

function setupExtrasEvents() {
  if (extraEventsReady) return;
  extraEventsReady = true;
  const $ = id => document.getElementById(id);

  $('extra-add-btn')?.addEventListener('click', () => openExtraModal());

  $('extra-search')?.addEventListener('input', e => {
    extraFilters.search = e.target.value; extraPage = 1; renderExtrasTable();
  });
  $('extra-date-from')?.addEventListener('change', e => {
    extraFilters.dateFrom = e.target.value; extraPage = 1; renderExtrasTable();
  });
  $('extra-date-to')?.addEventListener('change', e => {
    extraFilters.dateTo = e.target.value; extraPage = 1; renderExtrasTable();
  });
  $('extra-reset-filter')?.addEventListener('click', () => {
    extraFilters = { search: '', dateFrom: '', dateTo: '' };
    $('extra-search').value    = '';
    $('extra-date-from').value = '';
    $('extra-date-to').value   = '';
    extraPage = 1;
    renderExtrasTable();
  });

  $('extra-form')?.addEventListener('submit', saveExtra);

  $('extra-csv-btn')?.addEventListener('click', () => {
    if (!extraData.length) { App.toast('No data to export', 'warning'); return; }
    const headers = ['Date', 'Category', 'Source / Description', 'Amount (৳)'];
    const rows    = extraData.map(e => [e.date||'', e.category||'', e.description||'', e.amount||0]);
    downloadCSV('extra-collections.csv', headers, rows);
    App.toast('CSV downloaded ✅', 'success');
  });
}

// ---- SUMMARY CARDS ----
async function renderExtrasSummary() {
  const all   = await DB.getExtraIncomes();
  const total = all.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const count = all.length;

  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setEl('extra-stat-total',  App.formatCurrency(total));
  setEl('extra-stat-count',  count + ' টি রেকর্ড');
}

// ---- TABLE ----
async function renderExtrasTable() {
  extraData = await DB.getExtraIncomes(extraFilters);

  const total = extraData.length;
  const pages = Math.max(1, Math.ceil(total / EXTRA_PER_PAGE));
  extraPage   = Math.min(extraPage, pages);
  const slice = extraData.slice((extraPage - 1) * EXTRA_PER_PAGE, extraPage * EXTRA_PER_PAGE);

  // Filtered total badge
  const filteredTotal = extraData.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const badge = document.getElementById('extra-total-badge');
  if (badge) {
    badge.innerHTML = `<span class="badge badge-success">💰 মোট আয় (filtered): ${App.formatCurrency(filteredTotal)}</span>`;
  }

  const tbody = document.getElementById('extra-tbody');
  if (!tbody) return;

  if (slice.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">
      <span class="empty-icon">💰</span>
      <h3>কোনো রেকর্ড নেই</h3>
      <p>\"এক্সটা টাকা যোগ করুন\" বাটনে ক্লিক করুন।</p>
    </div></td></tr>`;
  } else {
    tbody.innerHTML = slice.map(e => `
      <tr>
        <td data-label="তারিখ">${App.formatDate(e.date)}</td>
        <td data-label="ক্যাটাগরি"><span class="badge badge-success" style="font-size:.75rem">${escHtml(e.category||'অন্যান্য')}</span></td>
        <td data-label="বিবরণ">${escHtml(e.description||'—')}</td>
        <td class="td-amount" data-label="পরিমাণ" style="color:var(--success);font-weight:700">${App.formatCurrency(e.amount)}</td>
        <td class="td-actions print-hide">
          <button class="action-btn edit"   onclick="openExtraModal(${e.id})">✏️ Edit</button>
          <button class="action-btn delete" onclick="deleteExtraConfirm(${e.id})">🗑</button>
        </td>
      </tr>`).join('');
  }

  renderPagination('extra-pagination', extraPage, pages, p => { extraPage = p; renderExtrasTable(); });
}

// ---- MODAL ----
async function openExtraModal(id = null) {
  const form  = document.getElementById('extra-form');
  const title = document.getElementById('extra-modal-title');
  form.reset();
  document.getElementById('extra-id-hidden').value = '';

  if (id) {
    const e = await DB.db.extraIncome.get(id);
    if (!e) return;
    title.textContent = '✏️ রেকর্ড সম্পাদনা';
    document.getElementById('extra-id-hidden').value      = id;
    document.getElementById('extra-f-date').value         = e.date        || '';
    document.getElementById('extra-f-category').value     = e.category    || EXTRA_CATEGORIES[0];
    document.getElementById('extra-f-description').value  = e.description || '';
    document.getElementById('extra-f-amount').value       = e.amount      || '';
  } else {
    title.textContent = '➕ এক্সটা টাকা যোগ করুন';
    document.getElementById('extra-f-date').value     = new Date().toISOString().split('T')[0];
    document.getElementById('extra-f-category').value = EXTRA_CATEGORIES[0];
  }
  App.openModal('extra-income-modal');
}

async function saveExtra(e) {
  e.preventDefault();
  const id     = parseInt(document.getElementById('extra-id-hidden').value) || null;
  const date   = document.getElementById('extra-f-date').value;
  const cat    = document.getElementById('extra-f-category').value.trim();
  const desc   = document.getElementById('extra-f-description').value.trim();
  const amount = parseFloat(document.getElementById('extra-f-amount').value) || 0;

  if (!date)      { App.toast('তারিখ দিন', 'error'); return; }
  if (amount <= 0){ App.toast('পরিমাণ শূন্যের বেশি হতে হবে', 'error'); return; }
  if (!desc)      { App.toast('বিবরণ দিন', 'error'); return; }

  const data = { date, category: cat || EXTRA_CATEGORIES[0], description: desc, amount };

  if (id) {
    await DB.updateExtraIncome(id, data);
    App.toast('রেকর্ড আপডেট হয়েছে ✅', 'success');
  } else {
    await DB.addExtraIncome(data);
    App.toast('এক্সটা টাকা যোগ হয়েছে ✅', 'success');
  }

  App.closeAllModals();
  await renderExtrasSummary();
  await renderExtrasTable();
}

function deleteExtraConfirm(id) {
  App.confirm('রেকর্ড মুছুন', 'এই রেকর্ডটি স্থায়ীভাবে মুছে ফেলবেন?', async () => {
    await DB.deleteExtraIncome(id);
    App.toast('রেকর্ড মুছে গেছে', 'warning');
    await renderExtrasSummary();
    await renderExtrasTable();
  }, true);
}

// expose
window.openExtraModal    = openExtraModal;
window.deleteExtraConfirm = deleteExtraConfirm;
