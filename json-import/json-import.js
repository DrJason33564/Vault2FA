// SPDX-License-Identifier: MIT
'use strict';

const dz = document.getElementById('dz');
const fileInput = document.getElementById('fileInput');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const resultNameEl = document.getElementById('resultName');
const errEl = document.getElementById('err');

const I18N = {};
const DEFAULT_LOCALE_ID = window.Vault2FALocales ? window.Vault2FALocales.DEFAULT_LOCALE_ID : 'en-US';
const JSON_IMPORT_FALLBACK = {
  titleSuffix: ' — JSON Import',
  dzTitle: 'Drop a JSON file here',
  dzSub: 'or click to choose a file',
  waiting: 'Waiting for a JSON file…',
  resultSub: 'Accounts imported — you can close this tab.',
  resultEncryptedSub: 'Encrypted data imported. Vault is now locked.',
  hint: 'Supports either { accounts: [...] } or a raw account array JSON.',
  invalidJson: 'Invalid JSON file.',
  missingAccounts: 'JSON must be an account array or contain an accounts array.',
  notJsonFile: 'Please choose a JSON file.',
  importing: 'Importing…',
  importFailed: 'Import failed: ',
  lockedHint: 'Unlock the vault first, then retry.',
  importedSummary: '{count} account(s) imported.',
};
let lang = DEFAULT_LOCALE_ID;

async function loadJsonImportLocale(localeId){
  if(!window.Vault2FALocales) return;
  const targetLocaleId = window.Vault2FALocales.localeIdFromLanguage(localeId);
  if(targetLocaleId === DEFAULT_LOCALE_ID) return;
  const section = await window.Vault2FALocales.getSection('json-import', targetLocaleId);
  I18N[targetLocaleId] = Object.assign({}, I18N[targetLocaleId] || {}, section || {});
}

function t(key){
  return (I18N[lang] && I18N[lang][key])
    || (I18N[DEFAULT_LOCALE_ID] && I18N[DEFAULT_LOCALE_ID][key])
    || JSON_IMPORT_FALLBACK[key]
    || key;
}
function tFmt(key, values = {}){
  return String(t(key)).replace(/\{(\w+)\}/g, (_, name) => values[name] == null ? '' : String(values[name]));
}
function tf(key, fallback){
  const value = t(key);
  return value === key ? fallback : value;
}

function applyTheme(){
  const light = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
}

function applyI18n(){
  document.documentElement.lang = lang;
  const pageTitle = document.getElementById('pageTitle');
  if(pageTitle){
    pageTitle.replaceChildren();
    pageTitle.appendChild(document.createTextNode('Vault '));
    const accent = document.createElement('em');
    accent.textContent = '2FA';
    pageTitle.appendChild(accent);
    pageTitle.appendChild(document.createTextNode(t('titleSuffix')));
  }
  document.getElementById('dzTitle').textContent = t('dzTitle');
  document.getElementById('dzSub').textContent = t('dzSub');
  document.getElementById('status').textContent = t('waiting');
  setResultSub(false);
  document.getElementById('pageHint').textContent = t('hint');
}


function toDebugEnglishMessage(message){
  const raw = String(message == null ? '' : message);
  if(!raw) return raw;
  const langPack = I18N[lang] || {};
  const basePack = I18N[DEFAULT_LOCALE_ID] || {};
  for(const [key, value] of Object.entries(langPack)){
    if(String(value) === raw && basePack[key]) return String(basePack[key]);
  }
  return raw;
}

function showStatus(msg){ statusEl.textContent = msg; }
function hideErr(){ errEl.textContent = ''; errEl.classList.remove('show'); }
function showErr(msg){ errEl.textContent = msg; errEl.classList.add('show'); showStatus(''); }
function setResultSub(isEncrypted){
  const sub = document.getElementById('resultSub');
  if(!sub) return;
  sub.textContent = isEncrypted ? tf('resultEncryptedSub', 'Encrypted data imported. Vault is now locked.') : t('resultSub');
}
async function debugInfo(message, context){
  try {
    await browser.runtime.sendMessage({ action:'appendDebugInfo', message, context });
  } catch (_) {
    // Ignore debug logging failures.
  }
}

async function importFile(file){
  hideErr();
  resultEl.classList.remove('show');
  if(!file || (!/\.json$/i.test(file.name || '') && file.type && !/json/i.test(file.type))){
    showErr(t('notJsonFile'));
    await debugInfo('JSON import rejected non-json file', {
      fileName: file && file.name ? file.name : '',
      fileType: file && file.type ? file.type : '',
      fileSize: file && typeof file.size === 'number' ? file.size : null,
    });
    return;
  }
  showStatus(t('importing'));
  try {
    await debugInfo('JSON import started', {
      fileName: file.name || '',
      fileType: file.type || '',
      fileSize: typeof file.size === 'number' ? file.size : null,
    });
    const text = await file.text();
    await debugInfo('JSON import file read', {
      textLength: text.length,
    });
    const resp = await browser.runtime.sendMessage({
      action:'importAccountsFromJson',
      rawText: text,
    });
    if(!resp || resp.success === false){
      throw new Error((resp && resp.error) || 'Unknown error');
    }
    await debugInfo('JSON import persisted via background', {
      importedCount: resp.importedCount || 0,
      totalAccounts: resp.totalAccounts,
      importedEncrypted: !!resp.importedEncrypted,
    });
    setResultSub(!!resp.importedEncrypted);
    resultNameEl.textContent = tFmt('importedSummary', { count: resp.importedCount || 0 });
    resultEl.classList.add('show');
    showStatus('');
  } catch(err){
    const msg = String((err && err.message) || err);
    const displayMsg = err && err.name === 'SyntaxError' ? t('invalidJson') : msg;
    const debugMsg = toDebugEnglishMessage(displayMsg);
    const extra = /Vault is locked|unlock/i.test(msg) ? ` ${t('lockedHint')}` : '';
    await debugInfo('JSON import failed', {
      error: debugMsg,
      vaultLockedHintShown: !!extra,
    });
    showErr(t('importFailed') + displayMsg + extra);
  }
}

dz.addEventListener('dragenter', (e) => { e.preventDefault(); dz.classList.add('drag-over'); });
dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag-over'); });
dz.addEventListener('dragleave', (e) => { if(!dz.contains(e.relatedTarget)) dz.classList.remove('drag-over'); });
dz.addEventListener('drop', async (e) => {
  e.preventDefault();
  dz.classList.remove('drag-over');
  await importFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', async (e) => {
  await importFile(e.target.files && e.target.files[0]);
});

browser.storage.local.get('uiLanguage').then(async (result) => {
  lang = window.Vault2FALocales ? window.Vault2FALocales.localeIdFromLanguage(result.uiLanguage) : DEFAULT_LOCALE_ID;
  await loadJsonImportLocale(lang);
  applyI18n();
});

applyTheme();
if(window.matchMedia){
  const media = window.matchMedia('(prefers-color-scheme: light)');
  if(media.addEventListener){
    media.addEventListener('change', applyTheme);
  } else if(media.addListener){
    media.addListener(applyTheme);
  }
}
