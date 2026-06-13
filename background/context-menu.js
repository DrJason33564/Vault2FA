// SPDX-License-Identifier: MIT
'use strict';

const MENU_I18N = {};
const DEFAULT_LOCALE_ID = window.Vault2FALocales ? window.Vault2FALocales.DEFAULT_LOCALE_ID : 'en-US';
const BACKGROUND_FALLBACK = {
  scanQrFromImage: 'Scan QR code',
};

const QR_CONTEXT_MENU_ID = 'vault2fa-scan-qr-image';
function resolveLocaleId(value){
  return window.Vault2FALocales ? window.Vault2FALocales.localeIdFromLanguage(value) : DEFAULT_LOCALE_ID;
}
async function loadBackgroundLocale(localeId){
  if(!window.Vault2FALocales) return;
  const targetLocaleId = resolveLocaleId(localeId);
  const section = await window.Vault2FALocales.getSection('background', targetLocaleId);
  MENU_I18N[targetLocaleId] = Object.assign({}, MENU_I18N[targetLocaleId] || {}, section || {});
}

function getContextMenuTitle(language){
  const localeId = resolveLocaleId(language);
  return (MENU_I18N[localeId] && MENU_I18N[localeId].scanQrFromImage)
    || (MENU_I18N[DEFAULT_LOCALE_ID] && MENU_I18N[DEFAULT_LOCALE_ID].scanQrFromImage)
    || BACKGROUND_FALLBACK.scanQrFromImage;
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
  try {
    await browser.contextMenus.remove(QR_CONTEXT_MENU_ID);
  } catch (_) {}
  if(featureSettings.rightclickEnabled === false) return;
  try {
    browser.contextMenus.create({
      id: QR_CONTEXT_MENU_ID,
      title: getContextMenuTitle(language),
      contexts: ['image'],
    });
  } catch (_) {}
}
async function openQrScannerForImageUrl(imageUrl){
  const source = String(imageUrl || '').trim();
  if(!source) return;
  const pageUrl = browser.runtime.getURL(`qr/qr.html?imageUrl=${encodeURIComponent(source)}`);
  await browser.tabs.create({ url: pageUrl });
}
