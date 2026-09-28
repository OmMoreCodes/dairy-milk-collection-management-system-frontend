// Farmer management: list, search, add, edit, deactivate and delete.
// The current search term is persisted under `filters:farmers` so the user
// does not have to re-type it after navigating away and back. Clearing the
// search field removes the stored value.

const FARMERS_FILTER_KEY = 'farmers';

let farmersCache = [];
let editingFarmerId = null; // MongoDB _id of farmer being edited
let deletingFarmerId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  initShell('farmers');

  document.getElementById('addFarmerBtn').addEventListener('click', () => openFarmerModal());
  document.getElementById('farmerModalClose').addEventListener('click', closeFarmerModal);
  document.getElementById('farmerForm').addEventListener('submit', handleFarmerFormSubmit);
  document.getElementById('deleteModalClose').addEventListener('click', () => {
    document.getElementById('deleteModal').classList.add('hidden');
  });
  document.getElementById('deleteCancelBtn').addEventListener('click', () => {
    document.getElementById('deleteModal').classList.add('hidden');
  });
  document.getElementById('deleteConfirmBtn').addEventListener('click', handleDeleteConfirm);

  // Restore the previously-typed search term, if any.
  const restored = loadFilters(FARMERS_FILTER_KEY);
  const searchInput = document.getElementById('searchInput');
  if (restored.search) searchInput.value = restored.search;

  let searchTimer = null;
  searchInput.addEventListener('input', (event) => {
    const term = event.target.value.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      // Persist on every debounce so even mid-typing the page can be safely
      // reloaded without losing the latest input.
      saveFilters(FARMERS_FILTER_KEY, { search: term });
      loadFarmers(term);
    }, 300);
  });

  // Initial load - use restored term so the list reflects the user's last
  // search.
  loadFarmers(restored.search || '');
});

async function loadFarmers(search = '') {
  const tbody = document.getElementById('farmersTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Loading farmers...</td></tr>';

  try {
    const query = search ? '?search=' + encodeURIComponent(search) : '';
    farmersCache = await apiFetch('/api/farmers' + query);
    renderFarmers();
    renderStats();
  } catch (err) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="table-empty">' + escapeHtml(err.message) + '</td></tr>';
    showToast(err.message, 'error');
  }
}

function renderStats() {
  const active = farmersCache.filter((f) => f.status === 'active').length;
  document.getElementById('statTotal').textContent = String(farmersCache.length);
  document.getElementById('statActive').textContent = String(active);
  document.getElementById('statInactive').textContent = String(farmersCache.length - active);
}

function renderFarmers() {
  const tbody = document.getElementById('farmersTableBody');

  if (!farmersCache.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="table-empty">No farmers found. Click "Add Farmer" to register your first farmer.</td></tr>';
    return;
  }

  tbody.innerHTML = farmersCache.map((farmer) => {
    const statusBadge = farmer.status === 'active'
      ? '<span class="badge badge-active">Active</span>'
      : '<span class="badge badge-inactive">Inactive</span>';

    const toggleLabel = farmer.status === 'active' ? 'Deactivate' : 'Activate';
    const toggleClass = farmer.status === 'active' ? 'btn-ghost' : 'btn-outline';

    return (
      '<tr>' +
      '<td><strong>' + escapeHtml(farmer.farmerId) + '</strong></td>' +
      '<td>' + escapeHtml(farmer.name) + '</td>' +
      '<td>' + escapeHtml(farmer.phone) + '</td>' +
      '<td>' + escapeHtml(farmer.village) + '</td>' +
      '<td class="small muted">' + escapeHtml(farmer.address) + '</td>' +
      '<td>' + statusBadge + '</td>' +
      '<td class="actions-cell">' +
      '<button type="button" class="btn btn-sm ' + toggleClass + '" data-action="toggle" data-id="' + farmer._id + '">' + toggleLabel + '</button> ' +
      '<button type="button" class="btn btn-sm btn-ghost" data-action="edit" data-id="' + farmer._id + '">Edit</button> ' +
      '<button type="button" class="btn btn-sm btn-danger-outline" data-action="delete" data-id="' + farmer._id + '">Delete</button>' +
      '</td></tr>'
    );
  }).join('');

  tbody.querySelectorAll('button[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-id');
      const action = button.getAttribute('data-action');
      if (action === 'edit') openFarmerModal(id);
      else if (action === 'toggle') handleToggleStatus(id);
      else if (action === 'delete') openDeleteModal(id);
    });
  });
}

/* --------------------------------------------------------------- add / edit */

function openFarmerModal(farmerId) {
  editingFarmerId = farmerId || null;
  const modal = document.getElementById('farmerModal');
  const form = document.getElementById('farmerForm');
  const statusField = document.getElementById('statusField');
  form.reset();

  if (farmerId) {
    const farmer = farmersCache.find((f) => f._id === farmerId);
    if (!farmer) return;
    document.getElementById('farmerModalTitle').textContent = 'Edit Farmer';
    document.getElementById('mFarmerId').value = farmer.farmerId;
    document.getElementById('mName').value = farmer.name;
    document.getElementById('mPhone').value = farmer.phone;
    document.getElementById('mVillage').value = farmer.village;
    document.getElementById('mAddress').value = farmer.address;
    document.getElementById('mStatus').value = farmer.status;
    statusField.style.display = 'block';
  } else {
    document.getElementById('farmerModalTitle').textContent = 'Add Farmer';
    statusField.style.display = 'none';
  }

  modal.classList.remove('hidden');
}

function closeFarmerModal() {
  document.getElementById('farmerModal').classList.add('hidden');
  editingFarmerId = null;
}

async function handleFarmerFormSubmit(event) {
  event.preventDefault();

  const payload = {
    farmerId: document.getElementById('mFarmerId').value.trim(),
    name: document.getElementById('mName').value.trim(),
    phone: document.getElementById('mPhone').value.trim(),
    village: document.getElementById('mVillage').value.trim(),
    address: document.getElementById('mAddress').value.trim()
  };

  const submitBtn = document.getElementById('farmerFormSubmit');
  await withButtonLoading(submitBtn, async () => {
    try {
      if (editingFarmerId) {
        payload.status = document.getElementById('mStatus').value;
        await apiFetch('/api/farmers/' + editingFarmerId, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Farmer updated successfully.', 'success');
      } else {
        await apiFetch('/api/farmers', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('Farmer added successfully.', 'success');
      }
      closeFarmerModal();
      await loadFarmers(document.getElementById('searchInput').value.trim());
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

/* ---------------------------------------------------------------- deactivate */

async function handleToggleStatus(farmerId) {
  const farmer = farmersCache.find((f) => f._id === farmerId);
  if (!farmer) return;
  const newStatus = farmer.status === 'active' ? 'inactive' : 'active';

  try {
    await apiFetch('/api/farmers/' + farmerId, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });
    showToast(
      newStatus === 'inactive'
        ? farmer.name + ' deactivated. New collections are blocked for this farmer.'
        : farmer.name + ' activated again.',
      'success'
    );
    await loadFarmers(document.getElementById('searchInput').value.trim());
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* -------------------------------------------------------------------- delete */

function openDeleteModal(farmerId) {
  const farmer = farmersCache.find((f) => f._id === farmerId);
  if (!farmer) return;
  deletingFarmerId = farmerId;
  document.getElementById('deleteModalText').innerHTML =
    'Delete <strong>' + escapeHtml(farmer.name) + ' (' + escapeHtml(farmer.farmerId) + ')</strong>? ' +
    'This only works when the farmer has no milk collections yet - otherwise deactivate instead.';
  document.getElementById('deleteModal').classList.remove('hidden');
}

async function handleDeleteConfirm() {
  const confirmBtn = document.getElementById('deleteConfirmBtn');
  await withButtonLoading(confirmBtn, async () => {
    try {
      await apiFetch('/api/farmers/' + deletingFarmerId, { method: 'DELETE' });
      showToast('Farmer deleted successfully.', 'success');
      document.getElementById('deleteModal').classList.add('hidden');
      await loadFarmers(document.getElementById('searchInput').value.trim());
    } catch (err) {
      showToast(err.message, 'error');
      document.getElementById('deleteModal').classList.add('hidden');
    }
  });
}
