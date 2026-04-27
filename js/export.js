// export.js — CSV and JSON export system
// ============================================================

App.registerPage('export', initExportPage);

function initExportPage() {
  document.getElementById('exp-json-btn')?.addEventListener('click', exportJSON);
  document.getElementById('exp-members-btn')?.addEventListener('click', exportMembersCSV);
  document.getElementById('exp-monthly-btn')?.addEventListener('click', exportMonthlyCSV);
  document.getElementById('exp-collections-btn')?.addEventListener('click', exportCollectionsCSV);
  document.getElementById('exp-monthly-grid-btn')?.addEventListener('click', exportMonthlyGridCSV);
}

// ---- JSON BACKUP ----
async function exportJSON() {
  try {
    App.toast('Preparing backup...', 'info');
    const data = await DB.exportFullBackup();
    const json = JSON.stringify(data, null, 2);
    const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadFile(`association-backup-${date}.json`, json, 'application/json');
    App.toast('Full JSON backup downloaded ✅', 'success');
  } catch(e) {
    App.toast('Export failed: ' + e.message, 'error');
  }
}

// ---- CSV: MEMBERS ----
async function exportMembersCSV() {
  try {
    const members = await DB.db.members.toArray();
    const headers = ['MemberID','Name','Mobile','NID','DOB','Address','JoinDate'];
    const rows = members.map(m => [
      m.memberId, m.fullName, m.mobile||'', m.nid||'', m.dob||'', m.address||'', m.joinDate||''
    ]);
    downloadCSV('members.csv', headers, rows);
    App.toast(`Exported ${members.length} members ✅`, 'success');
  } catch(e) {
    App.toast('Export failed: ' + e.message, 'error');
  }
}

// ---- CSV: PAYMENT HISTORY (All Individual Records) ----
async function exportMonthlyCSV() {
  try {
    const payments = await DB.db.monthlyPayments.toArray();
    payments.sort((a,b) => b.year-a.year || b.month-a.month);
    const headers = ['MemberID','Name','Month','Year','Amount','Status','PaymentDate','Notes'];
    const rows = payments.map(p => [
      p.memberId, p.memberName, App.monthName(p.month), p.year,
      p.amount, p.status, p.paymentDate||'', p.notes||''
    ]);
    downloadCSV('payment-history.csv', headers, rows);
    App.toast(`Exported ${payments.length} records ✅`, 'success');
  } catch(e) {
    App.toast('Export failed: ' + e.message, 'error');
  }
}

// ---- CSV: COLLECTIONS REPORT (Total per Member) ----
async function exportCollectionsCSV() {
  try {
    const members = await DB.db.members.toArray();
    const payments = await DB.db.monthlyPayments.where('status').equals('Paid').toArray();
    
    const totals = {};
    payments.forEach(p => {
      totals[p.memberId] = (totals[p.memberId] || 0) + (p.amount || 0);
    });

    const headers = ['MemberID', 'Name', 'Total Collected'];
    const rows = members.map(m => [
      m.memberId, m.fullName, totals[m.memberId] || 0
    ]);

    downloadCSV('collections-report.csv', headers, rows);
    App.toast('Collections report exported ✅', 'success');
  } catch(e) {
    App.toast('Export failed: ' + e.message, 'error');
  }
}

// ---- CSV: MONTHLY PAYMENTS GRID (Matrix format) ----
async function exportMonthlyGridCSV() {
  try {
    const year = new Date().getFullYear();
    const members = await DB.db.members.toArray();
    const payments = await DB.db.monthlyPayments.where('year').equals(year).toArray();
    
    const headers = ['MemberID', 'Name', ...App.MONTH_NAMES, 'Total Paid'];
    const rows = members.map(m => {
      const mPayments = payments.filter(p => p.memberId === m.memberId);
      let rowTotal = 0;
      const monthValues = App.MONTH_NAMES.map((_, i) => {
        const p = mPayments.find(pay => pay.month === i + 1);
        if (p && p.status === 'Paid') {
          rowTotal += p.amount;
          return p.amount;
        }
        return 0;
      });
      return [m.memberId, m.fullName, ...monthValues, rowTotal];
    });

    downloadCSV(`monthly-grid-${year}.csv`, headers, rows);
    App.toast(`Monthly grid for ${year} exported ✅`, 'success');
  } catch(e) {
    App.toast('Export failed: ' + e.message, 'error');
  }
}


// ---- HELPERS ----
function csvCell(val) {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function downloadCSV(filename, headers, rows) {
  const lines = [headers.map(csvCell).join(','), ...rows.map(r => r.map(csvCell).join(','))];
  const csv   = '\uFEFF' + lines.join('\r\n');  // BOM for Excel UTF-8
  downloadFile(filename, csv, 'text/csv;charset=utf-8;');
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Global expose
window.exportJSON          = exportJSON;
window.exportMembersCSV    = exportMembersCSV;
window.exportMonthlyCSV    = exportMonthlyCSV;
window.exportCollectionsCSV= exportCollectionsCSV;
window.exportMonthlyGridCSV= exportMonthlyGridCSV;
