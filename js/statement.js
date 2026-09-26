// Dedicated farmer statement page: pick a farmer and a period, then view or
// export the statement as PDF.

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  initShell('statement');

  document.getElementById('fromInput').value = monthStartISO();
  document.getElementById('toInput').value = todayISO();

  document.getElementById('statementForm').addEventListener('submit', (event) => {
    event.preventDefault();
    generateStatement();
  });

  document.getElementById('pdfBtn').addEventListener('click', handleExportPdf);

  loadFarmers();
});

async function loadFarmers() {
  const select = document.getElementById('farmerSelect');
  try {
    const farmers = await apiFetch('/api/farmers');
    select.innerHTML =
      '<option value="">Select a farmer</option>' +
      farmers
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) =>
          '<option value="' + f._id + '">' + escapeHtml(f.farmerId + ' - ' + f.name + ' (' + f.village + ')') + '</option>'
        )
        .join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function generateStatement() {
  const result = document.getElementById('statementResult');
  result.innerHTML = '<div class="card"><div class="card-body"><p class="loading-row">Generating statement...</p></div></div>';

  const farmerId = document.getElementById('farmerSelect').value;
  const from = document.getElementById('fromInput').value;
  const to = document.getElementById('toInput').value;

  if (!farmerId) {
    result.innerHTML = '<div class="card"><div class="card-body"><div class="empty-state"><p>Please select a farmer.</p></div></div></div>';
    return;
  }

  try {
    const data = await apiFetch('/api/reports/statement?farmerId=' + farmerId + '&from=' + from + '&to=' + to);

    if (!data.records.length) {
      result.innerHTML =
        '<div class="card"><div class="card-body"><div class="empty-state"><p>No collections found for ' +
        escapeHtml(data.farmer.name) + ' between ' + fmtDate(from) + ' and ' + fmtDate(to) + '.</p></div></div></div>';
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
      '<p class="small muted">Village: ' + escapeHtml(data.farmer.village) +
      ' &nbsp;|&nbsp; Phone: ' + escapeHtml(data.farmer.phone) +
      ' &nbsp;|&nbsp; Period: ' + fmtDate(data.from) + ' to ' + fmtDate(data.to) + '</p>' +
      '</div></div>' +
      '<div class="summary-strip mb-20">' +
      '<div class="summary-item"><div class="summary-label">Collections</div>' +
      '<div class="summary-value">' + data.summary.collectionCount + '</div></div>' +
      '<div class="summary-item"><div class="summary-label">Total Liters</div>' +
      '<div class="summary-value">' + fmtNumber(data.summary.totalLiters) + ' L</div></div>' +
      '<div class="summary-item"><div class="summary-label">Total Amount</div>' +
      '<div class="summary-value">' + fmtAmount(data.summary.totalAmount) + '</div></div>' +
      '</div>' +
      '<div class="card"><div class="card-header"><h2>Collection Records</h2></div>' +
      '<div class="card-body" style="padding-top:12px;"><div class="table-wrap"><table class="table">' +
      '<thead><tr><th>Date</th><th>Shift</th><th>Type</th><th class="num">Liters</th>' +
      '<th class="num">Fat %</th><th class="num">SNF %</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="3">Total</td><td class="num">' + fmtNumber(data.summary.totalLiters) + '</td>' +
      '<td colspan="3"></td><td class="num">' + fmtAmount(data.summary.totalAmount) + '</td></tr></tfoot>' +
      '</table></div></div></div>';
  } catch (err) {
    result.innerHTML =
      '<div class="card"><div class="card-body"><div class="empty-state"><p>' + escapeHtml(err.message) + '</p></div></div></div>';
    showToast(err.message, 'error');
  }
}

async function handleExportPdf() {
  const farmerId = document.getElementById('farmerSelect').value;
  const from = document.getElementById('fromInput').value;
  const to = document.getElementById('toInput').value;

  if (!farmerId || !from || !to || from > to) {
    showToast('Please select a farmer and a valid date range first.', 'error');
    return;
  }

  try {
    await apiDownload(
      '/api/exports/pdf/statement?farmerId=' + farmerId + '&from=' + from + '&to=' + to,
      'farmer-statement.pdf'
    );
    showToast('Statement PDF download started.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
