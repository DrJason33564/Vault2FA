// SPDX-License-Identifier: MIT
'use strict';

const MENU_I18N = {};
const DEFAULT_LOCALE_ID = window.Vault2FALocales ? window.Vault2FALocales.DEFAULT_LOCALE_ID : 'en-US';
const BACKGROUND_FALLBACK = {
  scanQrFromImage: 'Scan QR code',
  openAutofillPopup: 'Open autofill pop-up here',
};

const QR_CONTEXT_MENU_ID = 'vault2fa-scan-qr-image';
const AUTOFILL_CONTEXT_MENU_ID = 'vault2fa-open-autofill-popup';
function resolveLocaleId(value){
  return window.Vault2FALocales ? window.Vault2FALocales.localeIdFromLanguage(value) : DEFAULT_LOCALE_ID;
}
async function loadBackgroundLocale(localeId){
  if(!window.Vault2FALocales) return;
  const targetLocaleId = resolveLocaleId(localeId);
  const section = await window.Vault2FALocales.getSection('background', targetLocaleId);
  MENU_I18N[targetLocaleId] = Object.assign({}, MENU_I18N[targetLocaleId] || {}, section || {});
}

function getContextMenuTitle(language, key){
  const localeId = resolveLocaleId(language);
  return (MENU_I18N[localeId] && MENU_I18N[localeId][key])
    || (MENU_I18N[DEFAULT_LOCALE_ID] && MENU_I18N[DEFAULT_LOCALE_ID][key])
    || BACKGROUND_FALLBACK[key]
    || key;
}
async function resolveContextMenuLanguage(){
  try {
    const settings = await browser.storage.local.get('uiLanguage');
    if(settings && settings.uiLanguage) return resolveLocaleId(settings.uiLanguage);
  } catch (_) {}
  try {
    if(browser.i18n && typeof browser.i18n.getUILanguage === 'function'){
      return resolveLocaleId(browser.i18n.getUILanguage());
    }
  } catch (_) {}
  return DEFAULT_LOCALE_ID;
}
async function setupContextMenus(){
  if(!browser.contextMenus || typeof browser.contextMenus.create !== 'function') return;
  const [featureSettings, language] = await Promise.all([
    getFeatureSettings(),
    resolveContextMenuLanguage(),
  ]);
  await loadBackgroundLocale(language);
  await Promise.all([QR_CONTEXT_MENU_ID, AUTOFILL_CONTEXT_MENU_ID].map(async id => {
    try {
      await browser.contextMenus.remove(id);
    } catch (_) {}
  }));
  try {
    if(featureSettings.rightclickEnabled !== false){
      browser.contextMenus.create({
        id: QR_CONTEXT_MENU_ID,
        title: getContextMenuTitle(language, 'scanQrFromImage'),
        contexts: ['image'],
      });
    }
    if(featureSettings.rightclickAutofillEnabled !== false){
      browser.contextMenus.create({
        id: AUTOFILL_CONTEXT_MENU_ID,
        title: getContextMenuTitle(language, 'openAutofillPopup'),
        contexts: ['editable'],
      });
    }
  } catch (_) {}
}
async function openQrScannerForImageUrl(imageUrl){
  const source = String(imageUrl || '').trim();
  if(!source) return;
  const pageUrl = browser.runtime.getURL(`qr/qr.html?imageUrl=${encodeURIComponent(source)}`);
  await browser.tabs.create({ url: pageUrl });
}

async function openAutofillPopupForTab(tab){
  if(!tab || typeof tab.id !== 'number') return;
  if(shouldSkipInjectionUrl(tab.url)) return;
  await injectAutofillAssets(tab.id);
  await browser.tabs.sendMessage(tab.id, { action: 'openAutofillPopupHere' });
}
