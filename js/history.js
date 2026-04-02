// history.js — Full payment history with filters
// ============================================================

App.registerPage('history', initHistoryPage);

let histFilters = { memberId: '', status: '', search: '', year: '', month: '' };
let histData = [];
let histPage = 1;
const HIST_PAGE = 25;

async function initHistoryPage() {
  await populateHistMemberDropdown();
  await renderHistoryTable();
  setupHistoryEvents();
}

function setupHistoryEvents() {

  document.getElementById('hist-member')?.addEventListener('change', e => { histFilters.memberId = e.target.value; histPage = 1; renderHistoryTable(); });
  document.getElementById('hist-status')?.addEventListener('change', e => { histFilters.status = e.target.value; histPage = 1; renderHistoryTable(); });
  document.getElementById('hist-year')?.addEventListener('change', e => { histFilters.year = e.target.value; histPage = 1; renderHistoryTable(); });
  document.getElementById('hist-month')?.addEventListener('change', e => { histFilters.month = e.target.value; histPage = 1; renderHistoryTable(); });
  document.getElementById('hist-search')?.addEventListener('input', e => { histFilters.search = e.target.value; histPage = 1; renderHistoryTable(); });

  // Populate year & month dropdowns
  const yEl = document.getElementById('hist-year');
  if (yEl && yEl.options.length <= 1) {
    const cur = new Date().getFullYear();
    for (let y = cur + 1; y >= cur - 10; y--) yEl.add(new Option(y, y));
  }
  const mEl = document.getElementById('hist-month');
  if (mEl && mEl.options.length <= 1) {
    App.MONTH_NAMES.forEach((name, i) => mEl.add(new Option(name, i + 1)));
  }
}

async function populateHistMemberDropdown() {
  const members = await DB.getMembers();
  const sel = document.getElementById('hist-member');
  if (!sel || sel.options.length > 1) return;
  members.forEach(m => sel.add(new Option(`${m.memberId} — ${m.fullName}`, m.memberId)));
}

async function renderHistoryTable() {
  const f = histFilters;

  histData = await DB.getMonthlyPayments({
    memberId: f.memberId || undefined,
    month: f.month || undefined,
    year: f.year || undefined,
    status: f.status || undefined
  });

  if (f.search) {
    const q = f.search.toLowerCase();
    histData = histData.filter(p => p.memberName?.toLowerCase().includes(q) || p.memberId?.toLowerCase().includes(q));
  }

  // Stats
  const paid   = histData.filter(p=>p.status==='Paid').length;
  const unpaid = histData.filter(p=>p.status==='Unpaid').length;
  const total  = histData.filter(p=>p.status==='Paid').reduce((s,p)=>s+(p.amount||0),0);
  document.getElementById('hist-summary').innerHTML = `
    <span class="badge badge-muted">Total: ${histData.length}</span>
    <span class="badge badge-success">Paid: ${paid}</span>
    <span class="badge badge-danger">Unpaid: ${unpaid}</span>
    <span class="badge badge-info">Collected: ${App.formatCurrency(total)}</span>
  `;

  // Pagination
  const pages = Math.max(1, Math.ceil(histData.length / HIST_PAGE));
  histPage = Math.min(histPage, pages);
  const slice = histData.slice((histPage-1)*HIST_PAGE, histPage*HIST_PAGE);

  const tbody  = document.getElementById('hist-tbody');
  const header = document.getElementById('hist-thead');
  if (!tbody || !header) return;

  header.innerHTML = `<tr><th>ID</th><th>Name</th><th>Month</th><th>Year</th><th>Amount</th><th>Status</th><th>Paid On</th><th>Notes</th></tr>`;
  tbody.innerHTML = slice.length === 0
    ? `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📜</div><h3>No records found</h3></div></td></tr>`
    : slice.map(p => {
        const isLate = p.status==='Unpaid' && isLatePayment(p.month, p.year);
        return `<tr class="${isLate?'late':''}">
          <td class="td-id" data-label="ID">${p.memberId}</td>
          <td class="td-name" data-label="Name">${escHtml(p.memberName)}${isLate?' <span class="badge badge-warning" style="font-size:.7rem">Late</span>':''}</td>
          <td data-label="Month">${App.monthName(p.month)}</td>
          <td data-label="Year">${p.year}</td>
          <td class="td-amount" data-label="Amount">${App.formatCurrency(p.amount)}</td>
          <td data-label="Status"><span class="badge badge-${p.status==='Paid'?'success':'danger'}">${p.status}</span></td>
          <td data-label="Paid On">${App.formatDate(p.paymentDate)}</td>
          <td data-label="Notes" style="color:var(--text-muted);font-size:.8rem">${escHtml(p.notes)||'—'}</td>
        </tr>`;
      }).join('');

  renderPagination('hist-pagination', histPage, pages, p => { histPage = p; renderHistoryTable(); });
}

function isLatePayment(month, year) {
  const now = new Date();
  if (year < now.getFullYear()) return true;
  if (year === now.getFullYear() && month < now.getMonth() + 1) return true;
  return false;
}
