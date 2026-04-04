// dashboard.js — Stats, charts and overview
// ============================================================

App.registerPage('dashboard', initDashboard);

let dashYear  = new Date().getFullYear();
let dashMonth = new Date().getMonth() + 1;
let charts    = {};
let dashEventsReady = false; // guard: attach listeners only once

async function initDashboard() {
  populateDashFilters();
  await renderDashboard();
  setupDashEvents();
}

function setupDashEvents() {
  if (dashEventsReady) return;
  dashEventsReady = true;
  document.getElementById('dash-year')?.addEventListener('change', e => {
    dashYear = parseInt(e.target.value);
    renderDashboard();
  });
  document.getElementById('dash-month')?.addEventListener('change', e => {
    dashMonth = parseInt(e.target.value);
    renderDashboard();
  });
}

function populateDashFilters() {
  const yEl = document.getElementById('dash-year');
  const mEl = document.getElementById('dash-month');
  if (yEl && yEl.options.length === 0) {
    const cur = new Date().getFullYear();
    for (let y = cur + 1; y >= cur - 10; y--) {
      yEl.add(new Option(y, y, false, y === dashYear));
    }
    yEl.value = dashYear;
  }
  if (mEl && mEl.options.length === 0) {
    App.MONTH_NAMES.forEach((name, i) => {
      mEl.add(new Option(name, i + 1, false, i + 1 === dashMonth));
    });
    mEl.value = dashMonth;
  }
}

async function renderDashboard() {
  const stats = await DB.getDashboardStats(dashYear, dashMonth);

  document.getElementById('stat-members').textContent      = stats.members;
  document.getElementById('stat-month-col').textContent    = App.formatCurrency(stats.monthCol);
  document.getElementById('stat-total').textContent        = App.formatCurrency(stats.totalCollected);
  document.getElementById('stat-month-paid').textContent   = `${stats.monthPaid} paid`;
  document.getElementById('stat-month-unpaid').textContent = `${stats.monthUnpaid} unpaid`;

  // Expenses & Balance cards
  const expEl = document.getElementById('stat-expenses');
  if (expEl) expEl.textContent = App.formatCurrency(stats.totalExpenses);

  const balEl   = document.getElementById('stat-balance');
  const balCard = document.getElementById('stat-balance-card');
  if (balEl) balEl.textContent = App.formatCurrency(stats.availBalance);
  if (balCard) {
    const positive = stats.availBalance >= 0;
    balCard.style.setProperty('--stat-color', positive ? 'var(--success)' : 'var(--danger)');
    balCard.style.setProperty('--stat-bg',    positive ? 'var(--success-bg)' : 'rgba(239,68,68,.1)');
  }


  await renderCharts(stats);
}

async function renderCharts(stats) {
  const isDark = document.documentElement.dataset.theme !== 'light';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  Chart.defaults.color = textColor;
  Chart.defaults.borderColor = gridColor;

  // Monthly bar chart
  const mData = await DB.getMonthlyChartData(dashYear);
  destroyChart('chart-monthly');
  const ctxM = document.getElementById('chart-monthly')?.getContext('2d');
  if (ctxM) {
    charts['chart-monthly'] = new Chart(ctxM, {
      type: 'bar',
      data: {
        labels: App.MONTH_NAMES,
        datasets: [
          {
            label: 'Paid',
            data: mData.paid,
            backgroundColor: 'rgba(16,185,129,0.7)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Unpaid',
            data: mData.unpaid,
            backgroundColor: 'rgba(239,68,68,0.45)',
            borderColor: '#ef4444',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { stacked: false, grid: { color: gridColor } },
          y: { stacked: false, grid: { color: gridColor }, ticks: { callback: v => '৳' + v.toLocaleString() } }
        }
      }
    });
  }



  // Paid vs Unpaid doughnut
  destroyChart('chart-donut');
  const ctxD = document.getElementById('chart-donut')?.getContext('2d');
  if (ctxD) {
    const total = stats.monthPaid + stats.monthUnpaid;
    charts['chart-donut'] = new Chart(ctxD, {
      type: 'doughnut',
      data: {
        labels: ['Paid', 'Unpaid'],
        datasets: [{
          data: [stats.monthPaid, stats.monthUnpaid],
          backgroundColor: ['rgba(16,185,129,0.8)','rgba(239,68,68,0.7)'],
          borderColor: ['#10b981','#ef4444'],
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} members (${total ? Math.round(ctx.raw/total*100) : 0}%)` } }
        }
      }
    });
  }
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// Re-render charts on theme change
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    setTimeout(() => { if (document.getElementById('page-dashboard')?.classList.contains('active')) renderDashboard(); }, 50);
  });
});
