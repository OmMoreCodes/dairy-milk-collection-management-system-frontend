// Reports page: Daily, Monthly and Date Range tabs. Every report can be
// exported as PDF; the date range report also exports to Excel. The farmer
// statement lives on its own dedicated page (statement.html / js/statement.js).
//
// Filter inputs are persisted under `filters:reports` so the user's last
// values are restored on the next visit; the active tab is stored under
// `filters:reports:tab` so the user lands on the report they were last viewing.

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const REPORTS_FILTER_KEY = 'reports';
const REPORTS_TAB_KEY = 'reports:tab';

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  initShell('reports');

  // Restore persisted filter values, falling back to sensible defaults
  // for any field that was never stored or has been cleared.
  const restored = applyStoredFilters(REPORTS_FILTER_KEY, document);
  if (!restored.dailyDate) document.getElementById('dailyDate').value = todayISO();
  const now = new Date();
  document.getElementById('monthlyMonth').innerHTML = MONTH_NAMES
    .map((name, index) => '<option value="' + (index + 1) + '">' + name + '</option>')
    .join('');
  if (!restored.monthlyMonth) document.getElementById('monthlyMonth').value = String(now.getMonth() + 1);
  if (!restored.monthlyYear) document.getElementById('monthlyYear').value = String(now.getFullYear());
  if (!restored.rangeFrom) document.getElementById('rangeFrom').value = monthStartISO();
  if (!restored.rangeTo) document.getElementById('rangeTo').value = todayISO();

  // Tab switching with persistence of the active tab id.
  const savedTab = loadFilters(REPORTS_TAB_KEY).tab;
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach((button) => {
    const activate = (tabId) => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      const target = document.querySelector('.tab-btn[data-tab="' + tabId + '"]');
      if (target) target.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.add('hidden'));
      const panel = document.getElementById('panel-' + tabId);
      if (panel) panel.classList.remove('hidden');
      saveFilters(REPORTS_TAB_KEY, { tab: tabId });
    };
    button.addEventListener('click', () => activate(button.dataset.tab));
    if (savedTab === button.dataset.tab) activate(button.dataset.tab);
  });

  // Report generation - persist filters on submit before triggering.
  document.getElementById('dailyForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveFormFilters(REPORTS_FILTER_KEY, document.getElementById('dailyForm'));
    generateDaily();
  });
  document.getElementById('monthlyForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveFormFilters(REPORTS_FILTER_KEY, document.getElementById('monthlyForm'));
    generateMonthly();
  });
  document.getElementById('rangeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveFormFilters(REPORTS_FILTER_KEY, document.getElementById('rangeForm'));
    generateRange();
  });

  // Exports.
  document.getElementById('dailyPdfBtn').addEventListener('click', () =>
    exportWithValidation('/api/exports/pdf/daily?date=' + document.getElementById('dailyDate').value,
      'daily-report.pdf', () => !!document.getElementById('dailyDate').value));

  document.getElementById('monthlyPdfBtn').addEventListener('click', () =>
    exportWithValidation('/api/exports/pdf/monthly?month=' + document.getElementById('monthlyMonth').value +
      '&year=' + document.getElementById('monthlyYear').value, 'monthly-report.pdf', validateMonthlyInputs));

  document.getElementById('rangePdfBtn').addEventListener('click', () =>
    exportWithValidation('/api/exports/pdf/range?from=' + document.getElementById('rangeFrom').value +
      '&to=' + document.getElementById('rangeTo').value, 'range-report.pdf', () => validateRangeInputs('rangeFrom', 'rangeTo')));

  document.getElementById('rangeExcelBtn').addEventListener('click', () =>
    exportWithValidation('/api/exports/excel?from=' + document.getElementById('rangeFrom').value +
      '&to=' + document.getElementById('rangeTo').value, 'milk-collections.xlsx', () => validateRangeInputs('rangeFrom', 'rangeTo')));
});

async function exportWithValidation(url, fallbackFilename, validate) {
  if (!validate()) {
    showToast('Please fill the report inputs correctly before exporting.', 'error');
    return;
  }
  try {
    await apiDownload(url, fallbackFilename);
    showToast('Download started.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function validateMonthlyInputs() {
  const month = document.getElementById('monthlyMonth').value;
  const year = document.getElementById('monthlyYear').value;
  return !!month && !!year && Number(year) >= 1900 && Number(year) <= 2100;
}

function validateRangeInputs(fromId, toId) {
  const from = document.getElementById(fromId).value;
  const to = document.getElementById(toId).value;
  return !!from && !!to && from <= to;
}

/* ------------------------------------------------------------------- shared */

function summaryStrip(items) {
  return (
    '<div class="summary-strip mb-20">' +
    items.map((item) =>
      '<div class="summary-item"><div class="summary-label">' + item.label + '</div>' +
      '<div class="summary-value">' + item.value + '</div></div>'
    ).join('') +
    '</div>'
  );
}

function emptyCard(message) {
  return '<div class="card"><div class="card-body"><div class="empty-state"><p>' + escapeHtml(message) + '</p></div></div></div>';
}

/* -------------------------------------------------------------------- daily */

async function generateDaily() {
  const result = document.getElementById('dailyResult');
  result.innerHTML = '<div class="card"><div class="card-body"><p class="loading-row">Generating report...</p></div></div>';

  const date = document.getElementById('dailyDate').value;
  try {
    const data = await apiFetch('/api/reports/daily?date=' + date);

    if (!data.records.length) {
      result.innerHTML = emptyCard('No collections were recorded on ' + fmtDate(date) + '.');
      return;
    }

    const rows = data.records.map((r) =>
      '<tr>' +
      '<td><div class="farmer-meta"><strong>' + escapeHtml(r.farmer.farmerId || '-') + '</strong>' +
      '<span class="sub">' + escapeHtml(r.farmer.name || '') + '</span></div></td>' +
      '<td><span class="badge badge-' + r.shift.toLowerCase() + '">' + r.shift + '</span></td>' +
      '<td><span class="badge badge-' + r.milkType.toLowerCase() + '">' + r.milkType + '</span></td>' +
      '<td class="num">' + fmtNumber(r.liters) + '</td>' +
      '<td class="num">' + fmtNumber(r.fat) + '</td>' +
      '<td class="num">' + fmtNumber(r.snf) + '</td>' +
      '<td class="num">' + fmtNumber(r.rate) + '</td>' +
      '<td class="num">' + fmtAmount(r.amount) + '</td>' +
      '</tr>'
    ).join('');

    result.innerHTML =
      summaryStrip([
        { label: 'Total Farmers', value: String(data.summary.totalFarmers) },
        { label: 'Collections', value: String(data.summary.totalCollections) },
        { label: 'Total Liters', value: fmtNumber(data.summary.totalLiters) + ' L' },
        { label: 'Avg Fat', value: fmtNumber(data.summary.avgFat) + ' %' },
        { label: 'Avg SNF', value: fmtNumber(data.summary.avgSnf) + ' %' },
        { label: 'Total Amount', value: fmtAmount(data.summary.totalAmount) }
      ]) +
      '<div class="card"><div class="card-header"><h2>Collections on ' + fmtDate(date) + '</h2></div>' +
      '<div class="card-body" style="padding-top:12px;"><div class="table-wrap"><table class="table">' +
      '<thead><tr><th>Farmer</th><th>Shift</th><th>Type</th><th class="num">Liters</th>' +
      '<th class="num">Fat %</th><th class="num">SNF %</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="3">Total</td><td class="num">' + fmtNumber(data.summary.totalLiters) + '</td>' +
      '<td colspan="3"></td><td class="num">' + fmtAmount(data.summary.totalAmount) + '</td></tr></tfoot>' +
      '</table></div></div></div>';
  } catch (err) {
    result.innerHTML = emptyCard(err.message);
    showToast(err.message, 'error');
  }
}

/* ------------------------------------------------------------------ monthly */

async function generateMonthly() {
  const result = document.getElementById('monthlyResult');
  result.innerHTML = '<div class="card"><div class="card-body"><p class="loading-row">Generating report...</p></div></div>';

  const month = document.getElementById('monthlyMonth').value;
  const year = document.getElementById('monthlyYear').value;
  try {
    const data = await apiFetch('/api/reports/monthly?month=' + month + '&year=' + year);

    if (!data.farmers.length) {
      result.innerHTML = emptyCard('No collections found for ' + data.monthName + ' ' + data.year + '.');
      return;
    }

    const rows = data.farmers.map((f) =>
      '<tr>' +
      '<td><strong>' + escapeHtml(f.farmer.farmerId || '-') + '</strong></td>' +
      '<td>' + escapeHtml(f.farmer.name || '') + '</td>' +
      '<td>' + escapeHtml(f.farmer.village || '') + '</td>' +
      '<td class="num">' + f.collectionCount + '</td>' +
      '<td class="num">' + fmtNumber(f.totalLiters) + '</td>' +
      '<td class="num">' + fmtAmount(f.totalAmount) + '</td>' +
      '</tr>'
    ).join('');

    result.innerHTML =
      summaryStrip([
        { label: 'Farmers', value: String(data.summary.farmerCount) },
        { label: 'Collections', value: String(data.summary.collectionCount) },
        { label: 'Total Liters', value: fmtNumber(data.summary.totalLiters) + ' L' },
        { label: 'Total Amount', value: fmtAmount(data.summary.totalAmount) }
      ]) +
      '<div class="card"><div class="card-header"><h2>Farmer-wise Totals - ' + data.monthName + ' ' + data.year + '</h2></div>' +
      '<div class="card-body" style="padding-top:12px;"><div class="table-wrap"><table class="table">' +
      '<thead><tr><th>Farmer ID</th><th>Name</th><th>Village</th><th class="num">Collections</th>' +
      '<th class="num">Total Liters</th><th class="num">Total Amount</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="3">Total</td><td class="num">' + data.summary.collectionCount + '</td>' +
      '<td class="num">' + fmtNumber(data.summary.totalLiters) + '</td>' +
      '<td class="num">' + fmtAmount(data.summary.totalAmount) + '</td></tr></tfoot>' +
      '</table></div></div></div>';
  } catch (err) {
    result.innerHTML = emptyCard(err.message);
    showToast(err.message, 'error');
  }
}

/* -------------------------------------------------------------------- range */

async function generateRange() {
  const result = document.getElementById('rangeResult');
  result.innerHTML = '<div class="card"><div class="card-body"><p class="loading-row">Generating report...</p></div></div>';

  const from = document.getElementById('rangeFrom').value;
  const to = document.getElementById('rangeTo').value;
  try {
    const data = await apiFetch('/api/reports/range?from=' + from + '&to=' + to);

    if (!data.records.length) {
      result.innerHTML = emptyCard('No collections found between ' + fmtDate(from) + ' and ' + fmtDate(to) + '.');
      return;
    }

    const rows = data.records.map((r) =>
      '<tr>' +
      '<td>' + fmtDate(r.date) + '</td>' +
      '<td><div class="farmer-meta"><strong>' + escapeHtml(r.farmer.farmerId || '-') + '</strong>' +
      '<span class="sub">' + escapeHtml(r.farmer.name || '') + '</span></div></td>' +
      '<td><span class="badge badge-' + r.shift.toLowerCase() + '">' + r.shift + '</span></td>' +
      '<td><span class="badge badge-' + r.milkType.toLowerCase() + '">' + r.milkType + '</span></td>' +
      '<td class="num">' + fmtNumber(r.liters) + '</td>' +
      '<td class="num">' + fmtNumber(r.rate) + '</td>' +
      '<td class="num">' + fmtAmount(r.amount) + '</td>' +
      '</tr>'
    ).join('');

    result.innerHTML =
      summaryStrip([
        { label: 'Collections', value: String(data.summary.collectionCount) },
        { label: 'Farmers', value: String(data.summary.farmerCount) },
        { label: 'Total Liters', value: fmtNumber(data.summary.totalLiters) + ' L' },
        { label: 'Total Amount', value: fmtAmount(data.summary.totalAmount) }
      ]) +
      '<div class="card"><div class="card-header"><h2>' + fmtDate(from) + ' to ' + fmtDate(to) + '</h2></div>' +
      '<div class="card-body" style="padding-top:12px;"><div class="table-wrap"><table class="table">' +
      '<thead><tr><th>Date</th><th>Farmer</th><th>Shift</th><th>Type</th>' +
      '<th class="num">Liters</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="4">Total</td><td class="num">' + fmtNumber(data.summary.totalLiters) + '</td>' +
      '<td></td><td class="num">' + fmtAmount(data.summary.totalAmount) + '</td></tr></tfoot>' +
      '</table></div></div></div>';
  } catch (err) {
    result.innerHTML = emptyCard(err.message);
    showToast(err.message, 'error');
  }
}
