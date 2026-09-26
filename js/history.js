// Collection history with filters: from/to dates, farmer, shift, milk type.

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  initShell('history');

  document.getElementById('fromInput').value = monthStartISO();
  document.getElementById('toInput').value = todayISO();

  document.getElementById('historyFilterForm').addEventListener('submit', (event) => {
    event.preventDefault();
    loadHistory();
  });

  document.getElementById('clearFiltersBtn').addEventListener('click', () => {
    document.getElementById('fromInput').value = monthStartISO();
    document.getElementById('toInput').value = todayISO();
    document.getElementById('farmerFilter').value = '';
    document.getElementById('shiftFilter').value = '';
    document.getElementById('milkTypeFilter').value = '';
    loadHistory();
  });

  loadFarmerOptions();
  loadHistory();
});

async function loadFarmerOptions() {
  try {
    const farmers = await apiFetch('/api/farmers');
    const select = document.getElementById('farmerFilter');
    select.innerHTML =
      '<option value="">All farmers</option>' +
      farmers
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

async function loadHistory() {
  const tbody = document.getElementById('historyTableBody');
  const foot = document.getElementById('historyTableFoot');
  tbody.innerHTML = '<tr><td colspan="9" class="loading-row">Loading...</td></tr>';
  foot.style.display = 'none';

  const params = new URLSearchParams();
  const from = document.getElementById('fromInput').value;
  const to = document.getElementById('toInput').value;
  const farmerId = document.getElementById('farmerFilter').value;
  const shift = document.getElementById('shiftFilter').value;
  const milkType = document.getElementById('milkTypeFilter').value;

  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (farmerId) params.set('farmerId', farmerId);
  if (shift) params.set('shift', shift);
  if (milkType) params.set('milkType', milkType);

  try {
    const collections = await apiFetch('/api/collections?' + params.toString());

    if (!collections.length) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="table-empty">No collections found for the selected filters.</td></tr>';
      document.getElementById('historyCount').textContent = '';
      return;
    }

    document.getElementById('historyCount').textContent =
      collections.length + ' record(s) - ' + fmtDate(from) + ' to ' + fmtDate(to);

    tbody.innerHTML = collections.map((c) =>
      '<tr>' +
      '<td>' + fmtDate(c.date) + '</td>' +
      '<td><div class="farmer-meta"><strong>' + escapeHtml(c.farmerId?.farmerId || '-') + '</strong>' +
      '<span class="sub">' + escapeHtml(c.farmerId?.name || '') + '</span></div></td>' +
      '<td><span class="badge badge-' + c.shift.toLowerCase() + '">' + c.shift + '</span></td>' +
      '<td><span class="badge badge-' + c.milkType.toLowerCase() + '">' + c.milkType + '</span></td>' +
      '<td class="num">' + fmtNumber(c.liters) + '</td>' +
      '<td class="num">' + fmtNumber(c.fat) + '</td>' +
      '<td class="num">' + fmtNumber(c.snf) + '</td>' +
      '<td class="num">' + fmtNumber(c.rate) + '</td>' +
      '<td class="num">' + fmtAmount(c.amount) + '</td>' +
      '</tr>'
    ).join('');

    const totalLiters = collections.reduce((sum, c) => sum + c.liters, 0);
    const totalAmount = collections.reduce((sum, c) => sum + c.amount, 0);
    document.getElementById('historyTotalLiters').textContent = fmtNumber(totalLiters) + ' L';
    document.getElementById('historyTotalAmount').textContent = fmtAmount(totalAmount);
    foot.style.display = 'table-footer-group';
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="9" class="table-empty">' + escapeHtml(err.message) + '</td></tr>';
    showToast(err.message, 'error');
  }
}
