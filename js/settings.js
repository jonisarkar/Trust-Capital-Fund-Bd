// settings.js — App configuration and password change

App.registerPage('settings', initSettingsPage);

async function initSettingsPage() {
  await loadSettingsForm();
  setupSettingsEvents();
}

async function loadSettingsForm() {
  const s = await DB.getAllSettings();
  const $ = id => document.getElementById(id);
  $('s-monthly-amount') && ($('s-monthly-amount').value = s.monthlyAmount ?? 2500);
  $('s-app-name')      && ($('s-app-name').value       = s.appName       ?? 'Trust Capital Fund Bd');
}

function setupSettingsEvents() {
  document.getElementById('settings-form')?.addEventListener('submit', saveSettings);
  document.getElementById('password-form')?.addEventListener('submit', changePassword);

}

async function saveSettings(e) {
  e.preventDefault();
  const $ = id => document.getElementById(id);
  await DB.setSetting('monthlyAmount',   parseFloat($('s-monthly-amount')?.value) || 2500);
  await DB.setSetting('appName',         $('s-app-name')?.value.trim()            || 'Trust Capital Fund Bd');
  App.toast('Settings saved ✅', 'success');
}

async function changePassword(e) {
  e.preventDefault();
  const current = document.getElementById('s-current-pass')?.value;
  const newPass  = document.getElementById('s-new-pass')?.value;
  const confirm  = document.getElementById('s-confirm-pass')?.value;
  if (!current || !newPass || !confirm) { App.toast('Fill all password fields', 'error'); return; }
  if (newPass !== confirm) { App.toast('New passwords do not match', 'error'); return; }
  if (newPass.length < 4)  { App.toast('Password must be at least 4 characters', 'error'); return; }
  const ok = await DB.verifyPassword(current);
  if (!ok) { App.toast('Current password is incorrect', 'error'); return; }
  await DB.changePassword(newPass);
  App.toast('Password changed ✅', 'success');
  document.getElementById('password-form')?.reset();
}



// Danger zone
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('clear-all-btn')?.addEventListener('click', () => {
    App.confirm('Clear ALL Data', 'This will permanently delete ALL members and payment records. This cannot be undone!', async () => {
      await DB.db.members.clear();
      await DB.db.monthlyPayments.clear();
      App.toast('All data cleared', 'warning');
    }, true);
  });
});
