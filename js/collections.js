// collections.js — Summary Collections Report
// ============================================================

App.registerPage('collections', initCollectionsPage);

let collSearchQ = '';

async function initCollectionsPage() {
  await renderCollectionsTable();
  setupCollectionsEvents();
}

function setupCollectionsEvents() {
  document.getElementById('coll-search')?.addEventListener('input', e => {
    collSearchQ = e.target.value.toLowerCase();
    renderCollectionsTable();
  });
}

async function renderCollectionsTable() {
  const members      = await DB.db.members.toArray();
  const allPaidMp    = await DB.db.monthlyPayments.where('status').equals('Paid').toArray();

  // Aggregate monthly payments by memberId
  const mpMap = {};
  allPaidMp.forEach(p => {
    mpMap[p.memberId] = (mpMap[p.memberId] || 0) + (parseFloat(p.amount) || 0);
  });

  const report = members.map(m => {
    const monthlyTotal = mpMap[m.memberId] || 0;
    return {
      memberId: m.memberId,
      fullName: m.fullName,
      monthlyTotal
    };
  });

  let filtered = report;
  if (collSearchQ) {
    filtered = report.filter(r =>
      r.fullName.toLowerCase().includes(collSearchQ) ||
      r.memberId.toLowerCase().includes(collSearchQ)
    );
  }

  const tbody = document.getElementById('coll-tbody');
  const tfoot = document.getElementById('coll-tfoot');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><h3>No records found</h3></div></td></tr>`;
    if (tfoot) tfoot.innerHTML = '';
  } else {
    tbody.innerHTML = filtered.map(r => `
      <tr>
        <td class="td-id">${r.memberId}</td>
        <td class="td-name">${escHtml(r.fullName)}</td>
        <td style="font-weight:700; color:var(--accent)">${App.formatCurrency(r.monthlyTotal)}</td>
      </tr>`).join('');

    const sumMonthly = filtered.reduce((s, r) => s + r.monthlyTotal, 0);

    if (tfoot) {
      tfoot.innerHTML = `
        <tr>
          <td colspan="2">TOTAL (Filtered: ${filtered.length})</td>
          <td>${App.formatCurrency(sumMonthly)}</td>
        </tr>`;
    }
  }
}
