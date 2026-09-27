// Profile page: update the operator account + dairy details, and change the
// password. Saving also refreshes the session stored in localStorage so the
// sidebar/topbar (name, dairy name) reflect the changes immediately.

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  initShell('profile');

  document.getElementById('profileForm').addEventListener('submit', (event) => {
    event.preventDefault();
    saveProfile();
  });

  document.getElementById('passwordForm').addEventListener('submit', (event) => {
    event.preventDefault();
    changePassword();
  });

  loadProfile();
});

async function loadProfile() {
  ['operatorName', 'operatorEmail', 'dairyName', 'ownerName', 'phone', 'address'].forEach((id) => {
    document.getElementById(id).disabled = true;
  });
  document.getElementById('saveProfileBtn').disabled = true;

  try {
    const data = await apiFetch('/api/auth/profile');
    document.getElementById('operatorName').value = data.user.name || '';
    document.getElementById('operatorEmail').value = data.user.email || '';
    document.getElementById('dairyName').value = data.organization.dairyName || '';
    document.getElementById('ownerName').value = data.organization.ownerName || '';
    document.getElementById('phone').value = data.organization.phone || '';
    document.getElementById('address').value = data.organization.address || '';
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    ['operatorName', 'operatorEmail', 'dairyName', 'ownerName', 'phone', 'address'].forEach((id) => {
      document.getElementById(id).disabled = false;
    });
    document.getElementById('saveProfileBtn').disabled = false;
  }
}

async function saveProfile() {
  const button = document.getElementById('saveProfileBtn');
  const name = document.getElementById('operatorName').value.trim();
  const email = document.getElementById('operatorEmail').value.trim();
  const dairyName = document.getElementById('dairyName').value.trim();
  const ownerName = document.getElementById('ownerName').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const address = document.getElementById('address').value.trim();

  if (!name || !email || !dairyName || !ownerName || !phone || !address) {
    showToast('All profile fields are required.', 'error');
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    showToast('Please enter a valid email address.', 'error');
    return;
  }

  try {
    await withButtonLoading(button, async () => {
      const data = await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, email, dairyName, ownerName, phone, address })
      });

      // Refresh the stored session so the shell (topbar name, dairy name)
      // shows the new values everywhere.
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(AUTH_ORG_KEY, JSON.stringify(data.organization));

      initShell('profile');
      showToast(data.message, 'success');
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function changePassword() {
  const button = document.getElementById('changePasswordBtn');
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast('All password fields are required.', 'error');
    return;
  }
  if (String(newPassword).length < 6) {
    showToast('New password must be at least 6 characters long.', 'error');
    return;
  }
  if (newPassword !== confirmPassword) {
    showToast('New password and confirmation do not match.', 'error');
    return;
  }

  try {
    await withButtonLoading(button, async () => {
      const data = await apiFetch('/api/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      document.getElementById('passwordForm').reset();
      showToast(data.message, 'success');
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}
