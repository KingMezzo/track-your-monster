(function () {
  'use strict';
  const button = document.querySelector('#btn-install');
  const help = document.querySelector('#install-help');
  const installed = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let prompt = null;
  function render() {
    button.classList.toggle('hidden', !prompt || installed());
    help.textContent = installed() ? 'Die App läuft bereits als installierte Web-App.' :
      'Im Browser-Menü „App installieren“ wählen. Auf iPhone und iPad: in Safari „Teilen“ und „Zum Home-Bildschirm“ öffnen.';
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); prompt = event; render();
  });
  window.addEventListener('appinstalled', () => { prompt = null; render(); });
  button.addEventListener('click', async () => {
    if (!prompt) return;
    const current = prompt;
    prompt = null;
    button.disabled = true;
    try { await current.prompt(); await current.userChoice; }
    finally { button.disabled = false; render(); }
  });
  render();
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {
        document.querySelector('#offline-help').textContent = 'Offline-Modus konnte nicht eingerichtet werden. Öffne die App mit Internetverbindung erneut.';
      });
    });
  }
})();
