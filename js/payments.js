App.registerPage('monthly', initMonthlyPage);

// ==================== MONTHLY ====================
let mpFilters = { month: new Date().getMonth() + 1, year: new Date().getFullYear(), status: '', search: '' };
let mpData = [];
let mpPage = 1;
const MP_PAGE = 20;

async function initMonthlyPage() {
  // Ensure payments exist for current month
  await DB.ensureMonthlyPayments(mpFilters.year, mpFilters.month);
  populateMonthYearSelects('mp-month', 'mp-year', mpFilters.month, mpFilters.year);
  await renderMonthlyTable();
  setupMonthlyEvents();
}

function setupMonthlyEvents() {
  const $ = id => document.getElementById(id);
  $('mp-month')?.addEventListener('change', async e => {
    mpFilters.month = parseInt(e.target.value); mpPage = 1;
    await DB.ensureMonthlyPayments(mpFilters.year, mpFilters.month);
    renderMonthlyTable();
  });
  $('mp-year')?.addEventListener('change', async e => {
    mpFilters.year = parseInt(e.target.value); mpPage = 1;
    await DB.ensureMonthlyPayments(mpFilters.year, mpFilters.month);
    renderMonthlyTable();
  });
  $('mp-status')?.addEventListener('change', e => { mpFilters.status = e.target.value; mpPage = 1; renderMonthlyTable(); });
  $('mp-search')?.addEventListener('input', e => { mpFilters.search = e.target.value; mpPage = 1; renderMonthlyTable(); });
  $('mp-gen-btn')?.addEventListener('click', async () => {
    await DB.ensureMonthlyPayments(mpFilters.year, mpFilters.month);
    App.toast('Payment records generated', 'success');
    renderMonthlyTable();
  });

  // Pay modal
  $('mp-pay-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const id   = parseInt($('mp-pay-id').value);
    const date = $('mp-pay-date').value;
    const notes= $('mp-pay-notes').value.trim();
    if (!date) { App.toast('Select payment date', 'error'); return; }
    await DB.markMonthlyPaid(id, date, notes);
    App.toast('Marked as Paid ✅', 'success');
    App.closeAllModals();
    renderMonthlyTable();
  });
}

async function renderMonthlyTable() {
  mpData = await DB.getMonthlyPayments({ month: mpFilters.month, year: mpFilters.year, status: mpFilters.status || undefined });
  if (mpFilters.search) {
    const q = mpFilters.search.toLowerCase();
    mpData = mpData.filter(p => p.memberName?.toLowerCase().includes(q) || p.memberId?.toLowerCase().includes(q));
  }

  const total = mpData.length;
  const pages = Math.max(1, Math.ceil(total / MP_PAGE));
  mpPage = Math.min(mpPage, pages);
  const slice = mpData.slice((mpPage-1)*MP_PAGE, mpPage*MP_PAGE);

  const paidCount   = mpData.filter(p=>p.status==='Paid').length;
  const unpaidCount = mpData.filter(p=>p.status==='Unpaid').length;
  const totalAmt    = mpData.filter(p=>p.status==='Paid').reduce((s,p)=>s+(p.amount||0),0);

  // summary
  document.getElementById('mp-summary').innerHTML = `
    <span class="badge badge-success">✅ Paid: ${paidCount}</span>
    <span class="badge badge-danger">❌ Unpaid: ${unpaidCount}</span>
    <span class="badge badge-info">💰 Collected: ${App.formatCurrency(totalAmt)}</span>
  `;

  for (const m of allMembers) totalPaidMap[m.memberId] = 0;
  for (const p of allPaidMp) totalPaidMap[p.memberId] += parseFloat(p.amount) || 0;

  const tbody = document.getElementById('mp-tbody');
  if (!tbody) return;
  if (slice.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📅</div><h3>No records</h3><p>Click "Generate" to create payment records for this month.</p></div></td></tr>`;
  } else {
    tbody.innerHTML = slice.map(p => `
      <tr>
        <td class="td-id" data-label="ID">${p.memberId}</td>
        <td class="td-name" data-label="Name">${escHtml(p.memberName)}</td>
        <td data-label="Total Paid" style="font-weight:600; font-family:monospace; color:var(--success)">${App.formatCurrency(totalPaidMap[p.memberId] || 0)}</td>
        <td data-label="Period">${App.monthName(p.month)} ${p.year}</td>
        <td class="td-amount" data-label="Amount">${App.formatCurrency(p.amount)}</td>
        <td data-label="Status"><span class="badge badge-${p.status==='Paid'?'success':'danger'}">${p.status}</span></td>
        <td data-label="Paid On">${App.formatDate(p.paymentDate)}</td>
        <td class="td-actions print-hide">
          ${p.status === 'Unpaid'
            ? `<button class="action-btn pay" onclick="openMpPayModal(${p.id},'${escHtml(p.memberName)}',${p.amount})">💳 Pay</button>`
            : `<button class="action-btn" onclick="unmarkMonthlyPaid(${p.id})">↩ Unpay</button>`}
          <button class="action-btn edit" onclick="openMpEditModal(${p.id})">✏️</button>
        </td>
      </tr>`).join('');
  }
  renderPagination('mp-pagination', mpPage, pages, p => { mpPage = p; renderMonthlyTable(); });
}

function openMpPayModal(id, name, amount) {
  document.getElementById('mp-pay-id').value     = id;
  document.getElementById('mp-pay-member').textContent = name;
  document.getElementById('mp-pay-amount').textContent = App.formatCurrency(amount);
  document.getElementById('mp-pay-date').value   = new Date().toISOString().split('T')[0];
  document.getElementById('mp-pay-notes').value  = '';
  App.openModal('mp-pay-modal');
}

async function unmarkMonthlyPaid(id) {
  await DB.markMonthlyUnpaid(id);
  App.toast('Marked as Unpaid', 'warning');
  renderMonthlyTable();
}

async function openMpEditModal(id) {
  const p = await DB.db.monthlyPayments.get(id);
  if (!p) return;
  document.getElementById('mp-edit-id').value     = id;
  document.getElementById('mp-edit-amount').value = p.amount;
  document.getElementById('mp-edit-notes').value  = p.notes || '';
  App.openModal('mp-edit-modal');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('mp-edit-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const id     = parseInt(document.getElementById('mp-edit-id').value);
    const amount = parseFloat(document.getElementById('mp-edit-amount').value);
    const notes  = document.getElementById('mp-edit-notes').value.trim();
    await DB.updateMonthlyPayment(id, { amount, notes });
    App.toast('Updated ✅', 'success');
    App.closeAllModals();
    renderMonthlyTable();
  });
});

// ---- SHARED HELPERS ----
function populateMonthYearSelects(monthId, yearId, selMonth, selYear) {
  const mEl = document.getElementById(monthId);
  const yEl = document.getElementById(yearId);
  if (mEl && mEl.options.length === 0) {
    App.MONTH_NAMES.forEach((name, i) => {
      mEl.add(new Option(name, i + 1, false, i + 1 === selMonth));
    });
    mEl.value = selMonth;
  }
  populateYearSelect(yearId, selYear);
}

function populateYearSelect(yearId, selYear) {
  const yEl = document.getElementById(yearId);
  if (!yEl || yEl.options.length > 0) return;
  const cur = new Date().getFullYear();
  for (let y = cur + 1; y >= cur - 10; y--) {
    yEl.add(new Option(y, y, false, y === selYear));
  }
  yEl.value = selYear;
}

// expose
window.openMpPayModal   = openMpPayModal;
window.unmarkMonthlyPaid= unmarkMonthlyPaid;
window.openMpEditModal  = openMpEditModal;
window.populateYearSelect = populateYearSelect;
window.populateMonthYearSelects = populateMonthYearSelects;
