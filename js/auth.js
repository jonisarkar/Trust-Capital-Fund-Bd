// auth.js — Login & session management
// ============================================================

const Auth = (() => {
  const SESSION_KEY = 'arafat_session';

  function isLoggedIn() {
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  }
  function setLoggedIn() {
    sessionStorage.setItem(SESSION_KEY, 'true');
  }
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  }

  async function init() {
    if (isLoggedIn()) return true;

    // Show login screen
    const screen  = document.getElementById('login-screen');
    const form    = document.getElementById('login-form');
    const errEl   = document.getElementById('login-error');
    const passEl  = document.getElementById('login-password');
    const btn     = document.getElementById('login-btn');

    screen.classList.remove('hidden');

    return new Promise(resolve => {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        btn.disabled = true;
        btn.textContent = 'Verifying…';
        const ok = await DB.verifyPassword(passEl.value.trim());
        if (ok) {
          setLoggedIn();
          screen.classList.add('hidden');
          resolve(true);
        } else {
          errEl.textContent = 'Incorrect password. Try again.';
          errEl.classList.add('show');
          passEl.value = '';
          passEl.focus();
          btn.disabled = false;
          btn.textContent = 'Sign In';
          // shake
          screen.querySelector('.login-card').animate(
            [{transform:'translateX(-8px)'},{transform:'translateX(8px)'},{transform:'translateX(0)'}],
            {duration:300}
          );
        }
      });
    });
  }

  return { init, isLoggedIn, setLoggedIn, logout };
})();
