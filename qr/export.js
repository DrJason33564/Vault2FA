// SPDX-License-Identifier: MIT
'use strict';

const DEFAULT_LOCALE_ID = window.Vault2FALocales ? window.Vault2FALocales.DEFAULT_LOCALE_ID : 'en-US';
let lang = DEFAULT_LOCALE_ID;
const I18N = {};

function resolveLocaleId(value){
  return window.Vault2FALocales ? window.Vault2FALocales.localeIdFromLanguage(value) : DEFAULT_LOCALE_ID;
}
function t(key, fallback){
  const val = (I18N[lang] && I18N[lang][key]) || (I18N[DEFAULT_LOCALE_ID] && I18N[DEFAULT_LOCALE_ID][key]);
  return val || fallback || key;
}
function applyTheme(){
  const light = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
}

async function loadLocales(){
  if(!window.Vault2FALocales) return;
  const localeIds = await window.Vault2FALocales.discoverLocaleIds();
  for(const localeId of localeIds){
    const section = await window.Vault2FALocales.getSection('popup', localeId);
    I18N[localeId] = Object.assign({}, I18N[localeId] || {}, section || {});
  }
}

function getOtpAuthFromQuery(){
  const params = new URLSearchParams(window.location.search || '');
  return String(params.get('otpauth') || '').trim();
}

function renderText(){
  document.getElementById('title').textContent = t('showQrCode', 'Export via QR');
  document.getElementById('desc').textContent = t('showQrCodeDesc', 'Scan this QR code in another authenticator app to import this account.');
}

function renderQr(otpauth){
  const box = document.getElementById('qrcode');
  const status = document.getElementById('status');
  box.replaceChildren();
  if(!otpauth || !otpauth.startsWith('otpauth://')){
    status.textContent = t('invalidOtp', 'Invalid OTP URI.');
    return;
  }
  if(typeof QRCode !== 'function'){
    status.textContent = 'QRCode library is not loaded.';
    return;
  }
  new QRCode(box, {
    text: otpauth,
    width: 256,
    height: 256,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H,
  });
  status.textContent = t('showQrCode', 'Export via QR');
}

(async function init(){
  applyTheme();
  const prefs = await browser.storage.local.get('uiLanguage');
  lang = resolveLocaleId(prefs && prefs.uiLanguage);
  await loadLocales();
  renderText();
  renderQr(getOtpAuthFromQuery());
})();
