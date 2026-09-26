// Milk rate management: current rates, add new rate, edit existing entries.

let ratesCache = [];
let editingRateId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  initShell('rates');

  document.getElementById('effectiveFromInput').value = todayISO();
  document.getElementById('rateForm').addEventListener('submit', handleRateSubmit);
  document.getElementById('rateModalClose').addEventListener('click', () => {
    document.getElementById('rateModal').classList.add('hidden');
  });
  document.getElementById('rateEditForm').addEventListener('submit', handleRateEditSubmit);

  loadRates();
});

async function loadRates() {
  const tbody = document.getElementById('ratesTableBody');
  tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Loading...</td></tr>';

  try {
    ratesCache = await apiFetch('/api/rates');
    renderCurrentRates();
    renderRateHistory();
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty">' + escapeHtml(err.message) + '</td></tr>';
    showToast(err.message, 'error');
  }
}

function renderCurrentRates() {
  const cowRate = ratesCache.find((r) => r.milkType === 'Cow');
  const buffaloRate = ratesCache.find((r) => r.milkType === 'Buffalo');

  const cowValue = document.getElementById('cowRateValue');
  const cowSub = document.getElementById('cowRateSub');
  if (cowRate) {
    cowValue.textContent = '\u20B9' + fmtNumber(cowRate.rate) + ' / L';
    cowSub.textContent = 'effective from ' + fmtDate(cowRate.effectiveFrom);
  } else {
    cowValue.textContent = '--';
    cowSub.textContent = 'No rate set yet';
  }

  const buffaloValue = document.getElementById('buffaloRateValue');
  const buffaloSub = document.getElementById('buffaloRateSub');
  if (buffaloRate) {
    buffaloValue.textContent = '\u20B9' + fmtNumber(buffaloRate.rate) + ' / L';
    buffaloSub.textContent = 'effective from ' + fmtDate(buffaloRate.effectiveFrom);
  } else {
    buffaloValue.textContent = '--';
    buffaloSub.textContent = 'No rate set yet';
  }
}

function renderRateHistory() {
  const tbody = document.getElementById('ratesTableBody');

  if (!ratesCache.length) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="table-empty">No rates yet. Add your first cow and buffalo milk rates above.</td></tr>';
    document.getElementById('rateHistoryCount').textContent = '';
    return;
  }

  document.getElementById('rateHistoryCount').textContent = ratesCache.length + ' rate entr' + (ratesCache.length === 1 ? 'y' + 'ies'.slice(0, -2) : 'ies');

  tbody.innerHTML = ratesCache.map((rate) => {
    const badge = rate.milkType === 'Cow' ? 'badge-cow' : 'badge-buffalo';
    return (
      '<tr>' +
      '<td><span class="badge ' + badge + '">' + rate.milkType + '</span></td>' +
      '<td class="num"><strong>\u20B9' + fmtNumber(rate.rate) + '</strong> / L</td>' +
      '<td>' + fmtDate(rate.effectiveFrom) + '</td>' +
      '<td class="small muted">' + fmtDate(rate.createdAt ? rate.createdAt.slice(0, 10) : null) + '</td>' +
      '<td class="actions-cell">' +
      '<button type="button" class="btn btn-sm btn-ghost" data-id="' + rate._id + '">Edit</button>' +
      '</td></tr>'
    );
  }).join('');

  tbody.querySelectorAll('button[data-id]').forEach((button) => {
    button.addEventListener('click', () => openRateModal(button.getAttribute('data-id')));
  });
}

async function handleRateSubmit(event) {
  event.preventDefault();

  const payload = {
    milkType: document.getElementById('milkTypeInput').value,
    rate: document.getElementById('rateInput').value,
    effectiveFrom: document.getElementById('effectiveFromInput').value
  };

  const submitBtn = document.getElementById('rateSubmitBtn');
  await withButtonLoading(submitBtn, async () => {
    try {
      await apiFetch('/api/rates', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast(payload.milkType + ' milk rate saved successfully.', 'success');
      document.getElementById('rateInput').value = '';
      await loadRates();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function openRateModal(rateId) {
  const rate = ratesCache.find((r) => r._id === rateId);
  if (!rate) return;
  editingRateId = rateId;
  document.getElementById('editMilkType').value = rate.milkType;
  document.getElementById('editRate').value = rate.rate;
  document.getElementById('editEffectiveFrom').value = rate.effectiveFrom;
  document.getElementById('rateModal').classList.remove('hidden');
}

async function handleRateEditSubmit(event) {
  event.preventDefault();

  const payload = {
    milkType: document.getElementById('editMilkType').value,
    rate: document.getElementById('editRate').value,
    effectiveFrom: document.getElementById('editEffectiveFrom').value
  };

  const submitBtn = document.getElementById('rateEditSubmitBtn');
  await withButtonLoading(submitBtn, async () => {
    try {
      await apiFetch('/api/rates/' + editingRateId, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showToast('Rate updated successfully.', 'success');
      document.getElementById('rateModal').classList.add('hidden');
      await loadRates();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
