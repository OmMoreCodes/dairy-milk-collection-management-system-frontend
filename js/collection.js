// Record a milk collection: farmer, date, shift, milk type, liters, fat, snf.
// The current rate for the selected milk type is shown live, and the payable
// amount is previewed - but the server always makes the final calculation.

let currentRates = { Cow: null, Buffalo: null }; // latest Rate per milk type

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  initShell('collection');

  document.getElementById('dateInput').value = todayISO();
  document.getElementById('collectionForm').addEventListener('submit', handleCollectionSubmit);

  ['milkTypeSelect', 'litersInput'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateAmountPreview);
    document.getElementById(id).addEventListener('change', updateAmountPreview);
  });

  loadFarmers();
  loadRates();
  loadTodayCollections();
});

async function loadFarmers() {
  const select = document.getElementById('farmerSelect');
  try {
    const farmers = await apiFetch('/api/farmers');
    const activeFarmers = farmers
      .filter((f) => f.status === 'active')
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!activeFarmers.length) {
      select.innerHTML = '<option value="">No active farmers - add one first</option>';
      return;
    }

    select.innerHTML =
      '<option value="">Select a farmer</option>' +
      activeFarmers
        .map((f) =>
          '<option value="' + f._id + '">' +
          escapeHtml(f.farmerId + ' - ' + f.name + ' (' + f.village + ')') +
          '</option>'
        )
        .join('');
  } catch (err) {
    select.innerHTML = '<option value="">Failed to load farmers</option>';
    showToast(err.message, 'error');
  }
}

async function loadRates() {
  try {
    const rates = await apiFetch('/api/rates');
    // The list is sorted by effectiveFrom desc, so the first match per milk
    // type is the current rate.
    currentRates.Cow = rates.find((r) => r.milkType === 'Cow') || null;
    currentRates.Buffalo = rates.find((r) => r.milkType === 'Buffalo') || null;
    updateAmountPreview();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function getSelectedRate() {
  return currentRates[document.getElementById('milkTypeSelect').value] || null;
}

function updateAmountPreview() {
  const rateDoc = getSelectedRate();
  const liters = parseFloat(document.getElementById('litersInput').value);
  const rateNote = document.getElementById('rateNote');
  const amountValue = document.getElementById('amountValue');
  const submitBtn = document.getElementById('collectionSubmitBtn');

  if (!rateDoc) {
    rateNote.textContent = 'No rate set for this milk type - add one on the Rates page first.';
    amountValue.textContent = '\u20B90.00';
    submitBtn.disabled = true;
    return;
  }

  submitBtn.disabled = false;
  rateNote.textContent =
    'Current rate: \u20B9' + fmtNumber(rateDoc.rate) + '/L (effective from ' + fmtDate(rateDoc.effectiveFrom) + ')';

  const amount = Number.isFinite(liters) && liters > 0 ? liters * rateDoc.rate : 0;
  amountValue.textContent = fmtAmount(amount);
}

async function handleCollectionSubmit(event) {
  event.preventDefault();
  const feedback = document.getElementById('collectionFeedback');
  feedback.textContent = '';
  feedback.className = 'form-feedback';

  const payload = {
    farmerId: document.getElementById('farmerSelect').value,
    date: document.getElementById('dateInput').value,
    shift: document.getElementById('shiftSelect').value,
    milkType: document.getElementById('milkTypeSelect').value,
    liters: document.getElementById('litersInput').value,
    fat: document.getElementById('fatInput').value,
    snf: document.getElementById('snfInput').value
  };

  if (!payload.farmerId) {
    feedback.textContent = 'Please select a farmer.';
    feedback.classList.add('error');
    return;
  }
  if (!payload.date) {
    feedback.textContent = 'Please select a date.';
    feedback.classList.add('error');
    return;
  }
  const liters = parseFloat(payload.liters);
  if (!Number.isFinite(liters) || liters <= 0) {
    feedback.textContent = 'Liters must be a number greater than 0.';
    feedback.classList.add('error');
    return;
  }

  const submitBtn = document.getElementById('collectionSubmitBtn');
  await withButtonLoading(submitBtn, async () => {
    try {
      const data = await apiFetch('/api/collections', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const saved = data.collection;
      showToast(
        'Collection saved: ' + fmtNumber(saved.liters) + ' L at \u20B9' + fmtNumber(saved.rate) +
        '/L = ' + fmtAmount(saved.amount),
        'success'
      );
      document.getElementById('litersInput').value = '';
      document.getElementById('fatInput').value = '';
      document.getElementById('snfInput').value = '';
      updateAmountPreview();
      loadTodayCollections();
    } catch (err) {
      feedback.textContent = err.message;
      feedback.classList.add('error');
    }
  });
}

async function loadTodayCollections() {
  const tbody = document.getElementById('todayTableBody');
  const foot = document.getElementById('todayTableFoot');
  tbody.innerHTML = '<tr><td colspan="8" class="loading-row">Loading...</td></tr>';
  foot.style.display = 'none';

  try {
    const collections = await apiFetch('/api/collections?date=' + todayISO());

    if (!collections.length) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="table-empty">No collections recorded yet today.</td></tr>';
      document.getElementById('todayCount').textContent = '';
      return;
    }

    document.getElementById('todayCount').textContent =
      collections.length + ' entr' + (collections.length === 1 ? 'y' : 'ies') + ' today';

    tbody.innerHTML = collections.map((c) =>
      '<tr>' +
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
    document.getElementById('todayTotalLiters').textContent = fmtNumber(totalLiters) + ' L';
    document.getElementById('todayTotalAmount').textContent = fmtAmount(totalAmount);
    foot.style.display = 'table-footer-group';
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">' + escapeHtml(err.message) + '</td></tr>';
  }
}
