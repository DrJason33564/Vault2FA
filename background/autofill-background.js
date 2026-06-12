// SPDX-License-Identifier: MIT
'use strict';

const FEATURE_SETTINGS_KEY = 'featureSettings';
const defaultFeatureSettings = {
  autofillEnabled: true,
  rightclickEnabled: true,
};

function normalizeAutofillPattern(pattern){
  return String(pattern || '').trim().toLowerCase();
}
function getAccountPatterns(account){
  if(Array.isArray(account && account.autofillPatterns)){
    return account.autofillPatterns.map(normalizeAutofillPattern).filter(Boolean);
  }
  if(account && typeof account.domain === 'string'){
    const legacy = normalizeAutofillPattern(account.domain);
    return legacy ? [legacy] : [];
  }
  return [];
}
function matchHostname(hostname, pattern){
  const normalizedHost = normalizeAutofillPattern(hostname);
  const normalizedPattern = normalizeAutofillPattern(pattern);
  if(!normalizedHost || !normalizedPattern) return false;
  if(normalizedPattern.startsWith('*.')){
    const baseDomain = normalizedPattern.slice(2);
    if(!baseDomain) return false;
    return normalizedHost === baseDomain || normalizedHost.endsWith('.' + baseDomain);
  }
  return normalizedHost === normalizedPattern;
}
function shouldSkipInjectionUrl(url){
  const value = String(url || '').trim();
  if(!value) return true;
  return !/^https?:\/\//i.test(value);
}
function isAutofillMessageAction(action){
  return action === 'getAccountsForAutofill' || action === 'generateCodeForAutofillById';
}
function getSenderAddOnId(sender){
  return String(sender && sender.id || '');
}
function getRuntimeAddOnId(){
  return String(browser && browser.runtime && browser.runtime.id || '');
}
function extractHostnameFromUrl(url){
  try {
    const parsed = new URL(String(url || ''));
    return String(parsed.hostname || '').trim().toLowerCase();
  } catch (_) {
    return '';
  }
}
async function shouldInjectAutofillForHostname(hostname){
  const target = String(hostname || '').trim().toLowerCase();
  if(!target) return false;
  let accounts = [];
  try {
    accounts = await getLocalAccounts();
  } catch (err) {
    if(err && err.code === 'NEED_UNLOCK') return false;
    throw err;
  }
  return accounts.some(account => getAccountPatterns(account).some(pattern => matchHostname(target, pattern)));
}
async function injectAutofillAssets(tabId){
  await browser.scripting.insertCSS({
    target: { tabId, allFrames: false },
    files: ['autofill/autofill.css'],
  });
  await browser.scripting.executeScript({
    target: { tabId, allFrames: false },
    files: ['locales/i18n.js', 'autofill/autofill-content.js'],
  });
}
async function maybeInjectAutofillForTab(tabId, url){
  if(typeof browser.scripting === 'undefined' || !browser.scripting || typeof browser.scripting.executeScript !== 'function'){
    return;
  }
  const featureSettings = await getFeatureSettings();
  if(featureSettings.autofillEnabled === false) return;
  if(shouldSkipInjectionUrl(url)) return;
  const hostname = extractHostnameFromUrl(url);
  if(!hostname) return;
  const matched = await shouldInjectAutofillForHostname(hostname);
  if(!matched) return;
  await injectAutofillAssets(tabId);
}
async function refreshAutofillInjectionForOpenTabs(){
  if(typeof browser.tabs === 'undefined' || !browser.tabs || typeof browser.tabs.query !== 'function') return;
  const tabs = await browser.tabs.query({});
  for(const tab of tabs){
    if(!tab || typeof tab.id !== 'number') continue;
    const tabUrl = String(tab.url || '');
    try {
      await maybeInjectAutofillForTab(tab.id, tabUrl);
    } catch (_) {}
  }
}

async function getFeatureSettings(){
  const result = await browser.storage.local.get(FEATURE_SETTINGS_KEY);
  return Object.assign({}, defaultFeatureSettings, result[FEATURE_SETTINGS_KEY] || {});
}
async function setFeatureSettings(next){
  const merged = Object.assign({}, await getFeatureSettings(), next || {});
  await browser.storage.local.set({ [FEATURE_SETTINGS_KEY]: merged });
  return merged;
}

async function guardAutofillMessage(message, sender){
  const action = message && message.action;
  if(!isAutofillMessageAction(action)) return null;

  const senderId = getSenderAddOnId(sender);
  const expectedId = getRuntimeAddOnId();
  const context = {
    action,
    senderId: senderId || null,
    expectedId: expectedId || null,
    hostname: message && message.hostname ? String(message.hostname) : null,
  };

  if(senderId !== expectedId){
    await appendDebugInfo('Autofill request denied because sender add-on id mismatched', context);
    return { success: false, error: 'Permission denied: mismatching add-on id', code: 'MISMATCHING_ADDON_ID' };
  }

  const featureSettings = await getFeatureSettings();
  if(featureSettings.autofillEnabled === false){
    await appendDebugInfo('Autofill request denied because autofill is disabled', context);
    return { success: false, error: 'Permission denied: autofill is disabled', code: 'AUTOFILL_DISABLED' };
  }

  return null;
}
