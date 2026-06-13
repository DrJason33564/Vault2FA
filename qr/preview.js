// SPDX-License-Identifier: MIT
'use strict';

const PREVIEW_I18N = {};
const DEFAULT_LOCALE_ID = window.Vault2FALocales ? window.Vault2FALocales.DEFAULT_LOCALE_ID : 'en-US';
let previewLang = DEFAULT_LOCALE_ID;

const PREVIEW_FALLBACK = {
  showQrCodeLibraryError: 'QR library loading failed.',
  showQrCodeGenerateError: 'Failed to generate QR code.',
};

function resolveLocaleId(value){
  return window.Vault2FALocales ? window.Vault2FALocales.localeIdFromLanguage(value) : DEFAULT_LOCALE_ID;
}

async function loadPreviewLocale(localeId){
  if(!window.Vault2FALocales) return;
  const targetLocaleId = resolveLocaleId(localeId);
  const section = await window.Vault2FALocales.getSection('qr-previewer', targetLocaleId);
  PREVIEW_I18N[targetLocaleId] = Object.assign({}, PREVIEW_I18N[targetLocaleId] || {}, section || {});
}

function t(key){
  return (PREVIEW_I18N[previewLang] && PREVIEW_I18N[previewLang][key])
    || (PREVIEW_I18N[DEFAULT_LOCALE_ID] && PREVIEW_I18N[DEFAULT_LOCALE_ID][key])
    || PREVIEW_FALLBACK[key]
    || key;
}

function showErr(message){
  const err = document.getElementById('err');
  const mount = document.getElementById('qrMount');
  if(mount) mount.style.display = 'none';
  if(err){
    err.textContent = String(message || '');
    err.classList.add('show');
  }
}

async function debugInfo(message, context){
  try {
    await browser.runtime.sendMessage({ action:'appendDebugInfo', message, context });
  } catch (_) {
    // Ignore debug logging errors to keep QR preview unaffected.
  }
}

async function sendMessage(payload){
  const resp = await browser.runtime.sendMessage(payload);
  if(!resp || resp.success === false){
    const err = new Error((resp && resp.error) || 'Request failed.');
    err.code = resp && resp.code;
    throw err;
  }
  return resp;
}

function getAccountIdFromHash(){
  const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  return String(hash.get('id') || '').trim();
}

async function generateQrCode(otpauthUri){
  if(typeof QRCode !== 'function') throw new Error(t('showQrCodeLibraryError'));
  const mount = document.getElementById('qrMount');
  if(!mount) throw new Error(t('showQrCodeGenerateError'));
  mount.replaceChildren();
  try {
    new QRCode(mount, {
      text: otpauthUri,
      width: 512,
      height: 512,
      colorDark : '#000000',
      colorLight : '#ffffff',
      correctLevel : QRCode.CorrectLevel.H,
    });
  } catch (_) {
    throw new Error(t('showQrCodeGenerateError'));
  }
  await new Promise((resolve, reject) => {
    let tries = 0;
    const maxTries = 20;
    const poll = () => {
      const generated = mount.querySelector('img,canvas');
      if(generated){
        resolve();
        return;
      }
      tries += 1;
      if(tries >= maxTries){
        reject(new Error(t('showQrCodeGenerateError')));
        return;
      }
      requestAnimationFrame(poll);
    };
    poll();
  });
}

async function init(){
  try {
    const result = await browser.storage.local.get('uiLanguage');
    previewLang = resolveLocaleId(result.uiLanguage);
    document.documentElement.lang = previewLang;
    await loadPreviewLocale(previewLang);

    const accountId = getAccountIdFromHash();
    await debugInfo('QR export preview opened', { accountId });
    const response = await sendMessage({ action:'getOtpAuthUriForAccount', id: accountId });
    await generateQrCode(response.uri);
    await debugInfo('QR export preview generated code', {
      accountId,
      account: response.account || undefined,
    });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    await debugInfo('QR export preview failed', {
      accountId: getAccountIdFromHash(),
      error: message,
    });
    showErr(message);
  }
}

init();
