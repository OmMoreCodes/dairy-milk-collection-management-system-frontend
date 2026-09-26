// Reports page: Daily, Monthly, Date Range and Farmer Statement tabs.
// Every report can be exported as PDF; the date range report also exports
// to Excel.

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

let statementFarmers = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  initShell('reports');

  // Defaults.
  document.getElementById('dailyDate').value = todayISO();
  const now = new Date();
  document.getElementById('monthlyMonth').innerHTML = MONTH_NAMES
    .map((name, index) => '<option value="' + (index + 1) + '">' + name + '</option>')
    .join('');
  document.getElementById('monthlyMonth').value = String(now.getMonth() + 1);
  document.getElementById('monthlyYear').value = String(now.getFullYear());
  document.getElementById('rangeFrom').value = monthStartISO();
  document.getElementById('rangeTo').value = todayISO();
  document.getElementById('statementFrom').value = monthStartISO();
  document.getElementById('statementTo').value = todayISO();

  // Tab switching.
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.add('hidden'));
      document.getElementById('panel-' + button.dataset.tab).classList.remove('hidden');
    });
  });

  // Report generation.
  document.getElementById('dailyForm').addEventListener('submit', (e) => { e.preventDefault(); generateDaily(); });
  document.getElementById('monthlyForm').addEventListener('submit', (e) => { e.preventDefault(); generateMonthly(); });
  document.getElementById('rangeForm').addEventListener('submit', (e) => { e.preventDefault(); generateRange(); });
  document.getElementById('statementForm').addEventListener('submit', (e) => { e.preventDefault(); generateStatement(); });

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

  document.getElementById('statementPdfBtn').addEventListener('click', () => {
    const farmerId = document.getElementById('statementFarmer').value;
    const from = document.getElementById('statementFrom').value;
    const to = document.getElementById('statementTo').value;
    exportWithValidation(
      '/api/exports/pdf/statement?farmerId=' + farmerId + '&from=' + from + '&to=' + to,
      'farmer-statement.pdf',
      () => !!farmerId && !!from && !!to && from <= to
    );
  });

  loadStatementFarmers();
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

async function loadStatementFarmers() {
  try {
    statementFarmers = await apiFetch('/api/farmers');
    const select = document.getElementById('statementFarmer');
    select.innerHTML =
      '<option value="">Select a farmer</option>' +
      statementFarmers
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) =>
          '<option value="' + f._id + '">' + escapeHtml(f.farmerId + ' - ' + f.name) + '</option>'
        )
        .join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
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

/* ---------------------------------------------------------------- statement */

async function generateStatement() {
  const result = document.getElementById('statementResult');
  result.innerHTML = '<div class="card"><div class="card-body"><p class="loading-row">Generating statement...</p></div></div>';

  const farmerId = document.getElementById('statementFarmer').value;
  const from = document.getElementById('statementFrom').value;
  const to = document.getElementById('statementTo').value;

  if (!farmerId) {
    result.innerHTML = emptyCard('Please select a farmer.');
    return;
  }

  try {
    const data = await apiFetch('/api/reports/statement?farmerId=' + farmerId + '&from=' + from + '&to=' + to);

    if (!data.records.length) {
      result.innerHTML = emptyCard(
        'No collections found for ' + data.farmer.name + ' between ' + fmtDate(from) + ' and ' + fmtDate(to) + '.'
      );
      return;
    }

    const rows = data.records.map((r) =>
      '<tr>' +
      '<td>' + fmtDate(r.date) + '</td>' +
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
      '<div class="card mb-20"><div class="card-body">' +
      '<h3 style="font-size:16px;">' + escapeHtml(data.farmer.name) + ' (' + escapeHtml(data.farmer.farmerId) + ')</h3>' +
      '<p class="small muted">Village: ' + escapeHtml(data.farmer.village) + ' &nbsp;|&nbsp; Phone: ' + escapeHtml(data.farmer.phone) +
      ' &nbsp;|&nbsp; Period: ' + fmtDate(data.from) + ' to ' + fmtDate(data.to) + '</p>' +
      '</div></div>' +
      summaryStrip([
        { label: 'Collections', value: String(data.summary.collectionCount) },
        { label: 'Total Liters', value: fmtNumber(data.summary.totalLiters) + ' L' },
        { label: 'Total Amount', value: fmtAmount(data.summary.totalAmount) }
      ]) +
      '<div class="card"><div class="card-header"><h2>Collection Records</h2></div>' +
      '<div class="card-body" style="padding-top:12px;"><div class="table-wrap"><table class="table">' +
      '<thead><tr><th>Date</th><th>Shift</th><th>Type</th><th class="num">Liters</th>' +
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
