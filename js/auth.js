// Handles the register and login forms. Used by register.html and login.html.

document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');

  // Already logged in? Go straight to the dashboard.
  if (getToken() && (registerForm || loginForm)) {
    window.location.replace('dashboard.html');
    return;
  }

  /* ------------------------------------------------------------ registration */

  if (registerForm) {
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    const feedback = document.getElementById('formFeedback');

    // Confirmation is checked while typing.
    confirmPasswordInput.addEventListener('input', () => {
      if (confirmPasswordInput.value && confirmPasswordInput.value !== passwordInput.value) {
        confirmPasswordInput.setCustomValidity('Passwords do not match');
      } else {
        confirmPasswordInput.setCustomValidity('');
      }
    });
    passwordInput.addEventListener('input', () => {
      if (confirmPasswordInput.value && confirmPasswordInput.value !== passwordInput.value) {
        confirmPasswordInput.setCustomValidity('Passwords do not match');
      } else {
        confirmPasswordInput.setCustomValidity('');
      }
    });

    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      feedback.textContent = '';
      feedback.className = 'form-feedback';

      const password = passwordInput.value;
      if (password.length < 6) {
        feedback.textContent = 'Password must be at least 6 characters long.';
        feedback.classList.add('error');
        return;
      }
      if (password !== confirmPasswordInput.value) {
        feedback.textContent = 'Passwords do not match.';
        feedback.classList.add('error');
        return;
      }

      const payload = {
        dairyName: document.getElementById('dairyName').value.trim(),
        ownerName: document.getElementById('ownerName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        address: document.getElementById('address').value.trim(),
        password
      };

      await withButtonLoading(submitBtn, async () => {
        try {
          await apiFetch('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          showToast('Organization registered successfully. Please login.', 'success');
          setTimeout(() => {
            window.location.href = 'login.html?registered=1';
          }, 900);
        } catch (err) {
          feedback.textContent = err.message;
          feedback.classList.add('error');
        }
      });
    });
  }

  /* -------------------------------------------------------------------- login */

  if (loginForm) {
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const feedback = document.getElementById('formFeedback');

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('registered') === '1') {
      feedback.textContent = 'Registration successful. Please login with your email and password.';
      feedback.classList.add('success');
    }

    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      feedback.textContent = '';
      feedback.className = 'form-feedback';

      const payload = {
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value
      };

      await withButtonLoading(submitBtn, async () => {
        try {
          const data = await apiFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          saveSession(data.token, data.user, data.organization);
          showToast('Login successful. Welcome back, ' + (data.user.name || 'Dairy Operator') + '!', 'success');
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 700);
        } catch (err) {
          feedback.textContent = err.message;
          feedback.classList.add('error');
        }
      });
    });
  }
});
