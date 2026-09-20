let deferredInstallPrompt = null;
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const installButton = document.querySelector('#installApp');
const installDialog = document.querySelector('#installDialog');
const nativeInstall = document.querySelector('#nativeInstall');
const installGuide = document.querySelector('#installGuide');

if (isStandalone) installButton.classList.add('hidden');

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

installButton.addEventListener('click', () => {
  const canPrompt = Boolean(deferredInstallPrompt);
  nativeInstall.classList.toggle('hidden', !canPrompt);
  installGuide.classList.toggle('hidden', canPrompt);
  installDialog.showModal();
});

nativeInstall.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installDialog.close();
});

window.addEventListener('appinstalled', () => installButton.classList.add('hidden'));

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}
