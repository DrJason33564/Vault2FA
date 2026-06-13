// SPDX-License-Identifier: MIT
'use strict';


let accounts = [];
let visibleAccounts = [];
let activeTab = 'manual';
let globalTick = null;
let syncSettings = {
  enabled:false,
  sessionId:'',
  intervalMinutes:5,
  lastUploadedAt:null,
  lastDownloadedAt:null,
  useEncryptedPayload:false,
};
let vaultStatus = { encryptionEnabled:false, unlocked:true, lastUnlockedAt:null };
let vaultTimerSettings = { autoLockEnabled:false, autoLockMinutes:15 };
let debugState = { enabled:false };
let featureSettings = { autofillEnabled:true, rightclickEnabled:true };
let debugUiUnlocked = false;
let uiLanguage = 'en-US';
let uiTheme = 'auto';
let editingAccountId = null;
const debugTapTimes = [];
const DEBUG_TAP_WINDOW_MS = 1600;
let displayCodesById = new Map();
let displayCodeRefreshInFlight = false;
let accountSettings = { sequence: {} };
let dragAccountId = null;
let touchDragState = null;
const TOUCH_DRAG_HOLD_MS = 320;

const I18N = {};
let availableLanguages = [];
const DEFAULT_LOCALE_ID = window.Vault2FALocales ? window.Vault2FALocales.DEFAULT_LOCALE_ID : 'en-US';
const POPUP_FALLBACK = {
  "localOnly": "Local only",
  "syncOn": "Sync ON ·",
  "storageModeLabel": "Storage mode:",
  "storageModeSync": "Local + Firefox Sync upload",
  "storageModeLocal": "Local only",
  "lastUpload": "Last upload:",
  "lastDownload": "Last local overwrite from cloud:",
  "uploadSuccess": "Uploaded local data",
  "syncSaved": "Sync settings saved",
  "syncDisabled": "Sync settings saved",
  "needSession": "Please enter a sync session ID first.",
  "needSessionEnable": "Please enter a sync session ID before enabling sync.",
  "noAccountsToExport": "No account to export",
  "copied": "Copied!",
  "addAccount": "Add Account",
  "editAccount": "Edit Account",
  "showQrCode": "Export via QR",
  "showQrCodeSuccess": "QR Code generated in new tab.",
  "reorderAccount": "Reorder all accounts by issuers' first letter",
  "reorderAccountSuccess": "Accounts reordered.",
  "noAccountsYet": "No account yet",
  "emptySub": "Add your first account using the\n+ button below.",
  "vaultLocked": "Vault Locked",
  "vaultLockSub": "Local vault is locked. Enter your passphrase to unlock this browser session.",
  "unlockVault": "Unlock Vault",
  "searchPlaceholder": "Search accounts...",
  "syncEnabledHint": "Accounts are stored locally by default. When auto upload is on, local changes upload by interval to the session ID below.",
  "syncEnableText": "Enable Firefox Sync upload",
  "syncSessionLabel": "Sync Session ID",
  "syncSessionHint": "Each session ID is isolated. Use a different ID for each sync group.",
  "syncIntervalLabel": "Auto Upload Interval (minutes)",
  "syncIntervalHint": "When auto upload is enabled, local changes upload no more often than this interval.",
  "syncSaveBtn": "Save Sync Settings",
  "syncUploadBtn": "Upload Local Data Now",
  "syncDownloadBtn": "Download Cloud Data to Local",
  "syncWarnOverwrite": "Downloading from the cloud will overwrite your current local accounts.",
  "addDrawerTitle": "Add Account",
  "tabManual": "Manual",
  "tabQr": "Scan QR",
  "tabUri": "URI",
  "labelIssuer": "Issuer / Service",
  "labelAccount": "Account / Email",
  "labelSecret": "Secret Key",
  "labelSecretFormat": "Secret Format",
  "labelAutofillPatterns": "Autofill Patterns",
  "hintAutofillPatterns": "Comma-separated. Supports * wildcard matching.",
  "hintAutofillExample": "Example: github.com, *.github.com",
  "autofillMatchLabel": "Matching",
  "noAutofillRules": "No autofill rules set",
  "labelType": "Type",
  "labelDigits": "Digits",
  "labelPeriod": "Period",
  "qrTabTitle": "Scan a QR Code",
  "qrTabSub": "A new tab will open where you can drop or pick your QR image. The account will be added automatically when scanned.",
  "openQrTab": "Open QR Scanner Tab",
  "labelUri": "otpauth:// otpauth-migration:// URI",
  "hintUri": "Paste from your QR reader or another authenticator's export.",
  "saveAccountBtn": "Add Account",
  "exportDrawerTitle": "Export Accounts",
  "exportHint": "Keep these safe — they contain your secrets.",
  "copyExportBtn": "Copy to Clipboard",
  "exportJsonBtn": "Download JSON File",
  "exportUriLabel": "otpauth:// URIs",
  "importDrawerTitle": "Import Accounts",
  "importInputLabel": "Paste otpauth:// otpauth-migration:// URIs (one per line) or JSON",
  "importFileHint": "JSON file import opens in a new tab.",
  "openJsonImportTabBtn": "Open JSON Import Tab",
  "importBtn": "Import",
  "editDrawerTitle": "Edit Account",
  "editSaveBtn": "Save Changes",
  "deleteConfirm": "Delete this account?",
  "editBtnTitle": "Edit",
  "saveEditSuccess": "Account updated",
  "settingDrawerTitle": "Setting",
  "settingSecurityTitle": "Sync & Security",
  "settingPermissionTitle": "Permission",
  "settingDebugTitle": "Debugging",
  "vaultEnableText": "Enable local encryption",
  "vaultEnableHint": "When enabled, local accounts are encrypted at rest. Unlock is required once per browser session.",
  "labelVaultPassphrase": "Vault Passphrase",
  "vaultTimerEnableText": "Enable automatic vault lock",
  "vaultTimerEnableHint": "Automatically lock the vault after inactivity when encryption is enabled.",
  "labelVaultTimerPeriod": "Auto-lock period (minutes)",
  "applyVaultBtn": "Apply Security Setting",
  "lockVaultBtn": "Lock Vault Now",
  "vaultLockedPill": "Locked",
  "needEncryptBeforeLock": "You need to encrypt the vault first.",
  "themeToggleTitle": "Toggle light/dark theme",
  "themeLight": "Light mode",
  "themeDark": "Dark mode",
  "vaultLockedActionBlocked": "Unlock Vault to use this feature.",
  "debugEnableText": "Enable debug mode",
  "debugHint": "When enabled, info logs are stored locally and can be downloaded as a .txt file.",
  "debugDownloadBtn": "Download Debug Log",
  "debugUnlockedToast": "Debug switch unlocked",
  "debugModeOn": "Debug mode enabled",
  "debugModeOff": "Debug mode disabled",
  "debugLogEmpty": "No debug log available.",
  "importNothing": "Nothing to import.",
  "importDuplicateConfirm": "Detected {count} imported item(s) with similar names. Import all parsed accounts anyway?",
  "importSummary": "Imported {ok} account(s){failPart}{dupPart}",
  "importFailPart": ", failed {count}",
  "importDupPart": ", have duplicate {count}",
  "openJsonImportTabStatus": "JSON import tab opened — continue there.",
  "exportJsonEmpty": "No accounts available to export.",
  "exportJsonFilename": "vault2fa-accounts-{timestamp}.json",
  "exportJsonEncrypted": "Local vault is encrypted. Export as encrypted?",
  "nextCodeTitle": "Next code",
  "deleteBtnTitle": "Delete",
  "clickToCopy": "click to copy",
  "unknown": "Unknown",
  "noLabel": "(no label)",
  "invalidSecretByFormat": "Invalid secret for selected format.",
  "btnImportTitle": "Import accounts",
  "btnExportTitle": "Export accounts",
  "btnSyncTitle": "Sync and security",
  "btnLangTitle": "Switch language",
  "unlockPassphrasePlaceholder": "Passphrase",
  "vaultPassphrasePlaceholder": "At least 6 characters",
  "secretFormatUtf8": "String (UTF-8)",
  "secretFormatLatin1": "String (Latin-1)",
  "btnLangText": "🌐",
  "jsonMissingAccounts": "Invalid JSON format: missing accounts array.",
  "jsonMissingSecretOrLabel": "JSON contains item(s) without secret or account label.",
  "duplicateHint": "Warning: found {count} similar account name{suffix}. You will be asked to confirm before adding.",
  "never": "Never",
  "vaultMetaEncryption": "Local encryption:",
  "enabled": "Enabled",
  "disabled": "Disabled",
  "vaultMetaState": "Vault state:",
  "unlocked": "Unlocked",
  "locked": "Locked",
  "notRequired": "Not required",
  "vaultMetaLastUnlock": "Last unlock:",
  "vaultUnlockedToast": "Vault unlocked",
  "qrTabOpenedStatus": "QR scanner tab opened — scan your code there. This popup will update automatically.",
  "qrAccountAdded": "QR account added!",
  "needOtpAuthUri": "Please enter an otpauth:// URI.",
  "useOpenQrTabBtn": "Use the \"Open QR Scanner Tab\" button above.",
  "secretRequired": "Secret key is required.",
  "accountNameRequired": "Account name is required.",
  "accountAdded": "Account added",
  "accountSaved": "Account saved",
  "noEditAccountSelected": "No account selected for editing.",
  "accountNotExists": "Account no longer exists.",
  "confirmCloudOverwrite": "Cloud data will overwrite your current local accounts. Continue?",
  "downloadedCloudData": "Downloaded cloud data",
  "confirmDisableEncryption": "Disable local encryption and store data locally without encryption?",
  "securitySettingChanged": "Security settings updated",
  "securitySettingUnchanged": "Security settings unchanged",
  "vaultLockedToast": "Vault locked",
  "popupLoadFailed": "Failed to load popup",
  "migrationAccountsImported": "Account imported from third-party source!",
  "langVersionMismatch": "Language file version mismatches with add-on version",
  "syncUseEncryptedPayloadText": "Upload encrypted local vault directlly",
  "syncUseEncryptedPayloadHint": "When local encryption is enabled, upload the encrypted payload to Firefox Sync instead of plaintext data.",
  "confirmCloudEncryptedOverwrite": "The downloaded sync data is encrypted and needs decryption. Overwrite local data with encrypted payload and lock vault now?",
  "downloadedEncryptedCloudData": "Encrypted cloud data downloaded. Vault is locked.",
  "permissionAutofillEnableText": "Enable autofill feature",
  "permissionAutofillEnableHint": "Fill in 2FA related input fields in websites.",
  "permissionRightclickEnableText": "Enable right-click QR scan",
  "permissionRightclickEnableHint": "Show a QR scanning action in the right-click image context menu.",
  "permissionSaveBtn": "Save Permission Settings",
  "permissionSavedToast": "Permission Settings saved"
};
let popupVersion = '';

function resolveLocaleId(value){
  const raw = String(value || '').trim();
  if(window.Vault2FALocales && raw){
    const mapped = window.Vault2FALocales.localeIdFromLanguage(raw);
    if(mapped) return mapped;
  }
  if(raw.includes('-')) return raw;
  return raw.toLowerCase().startsWith('zh') ? 'zh-CN' : DEFAULT_LOCALE_ID;
}

async function loadPopupLocale(localeId){
  if(!window.Vault2FALocales) return;
  const target = resolveLocaleId(localeId);
  const section = await window.Vault2FALocales.getSection('popup', target);
  I18N[target] = Object.assign({}, I18N[target] || {}, section || {});
}

async function loadAvailableLanguages(){
  if(!window.Vault2FALocales) return;
  availableLanguages = await window.Vault2FALocales.getAvailableLanguages();
  try {
    const manifest = browser.runtime.getManifest && browser.runtime.getManifest();
    popupVersion = String((manifest && manifest.version) || '');
  } catch (_) {
    popupVersion = '';
  }
}

const STATIC_TEXT_MAP = {
  lockTitle: 'vaultLocked', lockSub: 'vaultLockSub', btnUnlock: 'unlockVault',
  emptyTitle: 'noAccountsYet', addDrawerTitle: 'addDrawerTitle', tabManualBtn: 'tabManual', tabQrBtn: 'tabQr', tabUriBtn: 'tabUri',
  labelIssuer: 'labelIssuer', labelAccount: 'labelAccount', labelSecret: 'labelSecret', labelSecretFormat: 'labelSecretFormat', labelAutofillPatterns: 'labelAutofillPatterns', editLabelAutofillPatterns: 'labelAutofillPatterns',
  hintAutofillPatterns: 'hintAutofillPatterns', editHintAutofillPatterns: 'hintAutofillPatterns',
  labelType: 'labelType', labelDigits: 'labelDigits', labelPeriod: 'labelPeriod', qrTabTitle: 'qrTabTitle', qrTabSub: 'qrTabSub',
  btnOpenQrTab: 'openQrTab', labelUri: 'labelUri', hintUri: 'hintUri', btnSave: 'saveAccountBtn', exportDrawerTitle: 'exportDrawerTitle',
  exportHint: 'exportHint', btnCopyExport: 'copyExportBtn', btnDownloadExportJson: 'exportJsonBtn', exportUriLabel: 'exportUriLabel', importDrawerTitle: 'importDrawerTitle', importInputLabel: 'importInputLabel', importFileHint: 'importFileHint', btnOpenJsonImportTab: 'openJsonImportTabBtn', btnDoImport: 'importBtn',
  editDrawerTitle: 'editDrawerTitle', editLabelIssuer: 'labelIssuer', editLabelAccount: 'labelAccount', btnSaveEdit: 'editSaveBtn',
  settingDrawerTitle: 'settingDrawerTitle', settingSecurityTitle: 'settingSecurityTitle', settingPermissionTitle: 'settingPermissionTitle',
  settingDebugTitle: 'settingDebugTitle',
  permissionAutofillEnableText: 'permissionAutofillEnableText', permissionAutofillEnableHint: 'permissionAutofillEnableHint',
  permissionRightclickEnableText: 'permissionRightclickEnableText', permissionRightclickEnableHint: 'permissionRightclickEnableHint',
  btnSavePermission: 'permissionSaveBtn',
  syncEnableText: 'syncEnableText', syncEnabledHint: 'syncEnabledHint', labelSyncSession: 'syncSessionLabel', syncSessionHint: 'syncSessionHint',
  labelSyncInterval: 'syncIntervalLabel', syncIntervalHint: 'syncIntervalHint', btnSaveSync: 'syncSaveBtn', btnUploadSync: 'syncUploadBtn',
  btnDownloadSync: 'syncDownloadBtn', syncWarnOverwrite: 'syncWarnOverwrite', vaultEnableText: 'vaultEnableText',
  vaultEnableHint: 'vaultEnableHint', labelVaultPassphrase: 'labelVaultPassphrase',
  vaultTimerEnableText: 'vaultTimerEnableText', vaultTimerEnableHint: 'vaultTimerEnableHint', labelVaultTimerPeriod: 'labelVaultTimerPeriod',
  btnApplyVault: 'applyVaultBtn', btnLockVault: 'lockVaultBtn',
  vaultLockedPill: 'vaultLockedPill', btnAdd: 'addAccount', debugEnableText: 'debugEnableText',
  debugHint: 'debugHint', btnDownloadDebug: 'debugDownloadBtn'
};

const PAL = ['#58a6ff','#3fb950','#d29922','#f78166','#bc8cff','#39c5cf','#ff7b72','#79c0ff'];
function pal(s){ let h=0; for(const c of s) h=(h*31+c.charCodeAt(0))>>>0; return PAL[h%PAL.length]; }
function byId(id){ return document.getElementById(id); }
function settingButton(){ return byId('btnSetting'); }
function fmt(code, d){ return d===8 ? code.slice(0,4)+' '+code.slice(4) : code.slice(0,3)+' '+code.slice(3); }
function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function sid(acc){ return 'ac' + String(acc.id).replace(/\W/g,''); }
function t(key){
  return (I18N[uiLanguage] && I18N[uiLanguage][key])
    || POPUP_FALLBACK[key]
    || key;
}
function tFmt(key, values = {}){
  return String(t(key)).replace(/\{(\w+)\}/g, (_, name) => values[name] == null ? '' : String(values[name]));
}
function tf(key, fallback){
  const value = t(key);
  return value === key ? fallback : value;
}

function setMultilineText(el, text){
  if(!el) return;
  el.replaceChildren();
  const parts = String(text || '').split('\n');
  parts.forEach((part, idx) => {
    const span = document.createElement('span');
    span.textContent = part;
    el.appendChild(span);
    if(idx < parts.length - 1) el.appendChild(document.createElement('br'));
  });
}
function systemTheme(){
  const light = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  return light ? 'light' : 'dark';
}

function applyTheme(){
  const mode = uiTheme === 'light' || uiTheme === 'dark' ? uiTheme : systemTheme();
  document.documentElement.setAttribute('data-theme', mode);
  const themeBtn = byId('btnTheme');
  if(themeBtn){
    const isLight = mode === 'light';
    themeBtn.textContent = isLight ? '☀' : '☾';
    themeBtn.title = `${t('themeToggleTitle')} (${isLight ? t('themeLight') : t('themeDark')})`;
  }
}

function setTheme(mode, persist = true){
  uiTheme = mode === 'light' ? 'light' : mode === 'dark' ? 'dark' : 'auto';
  if(persist) browser.storage.local.set({ uiTheme });
  applyTheme();
}

function applyStaticTranslations(){
  for(const [id, key] of Object.entries(STATIC_TEXT_MAP)){
    const el = byId(id);
    if(!el) continue;
    const value = t(key);
    if(value === key) continue;
    if(id === 'btnAdd'){
      el.textContent = '＋ ' + value;
      continue;
    }
    el.textContent = value;
  }
  const popupFallbackText = {
    settingDrawerTitle: 'Settings',
    settingSecurityTitle: 'Sync & Security',
    settingPermissionTitle: 'Permissions',
    settingDebugTitle: 'Debugging',
    permissionAutofillEnableText: 'Enable autofill feature',
    permissionAutofillEnableHint: 'Automatically inject autofill on matched websites.',
    permissionRightclickEnableText: 'Enable right-click QR scan option',
    permissionRightclickEnableHint: 'Show a QR scanning action in the browser image context menu.',
    btnSavePermission: 'Save Permission Settings',
    vaultTimerEnableText: 'Enable automatic vault lock',
    vaultTimerEnableHint: 'Automatically lock the vault after inactivity.',
    labelVaultTimerPeriod: 'Auto-lock period (minutes)',
  };
  for(const [id, fallback] of Object.entries(popupFallbackText)){
    const el = byId(id);
    if(!el) continue;
    const key = STATIC_TEXT_MAP[id];
    if(!key) continue;
    el.textContent = tf(key, fallback);
  }
  byId('btnImport').title = t('btnImportTitle');
  byId('btnExport').title = t('btnExportTitle');
  const syncBtn = settingButton();
  if(syncBtn) syncBtn.title = tf('btnSettingTitle', tf('btnSyncTitle', 'Settings'));
  const reorderBtn = byId('btnReorderAll');
  if(reorderBtn) reorderBtn.title = tf('reorderAccount', "Reorder all accounts by issuers' first letter.");
  byId('btnLang').title = t('btnLangTitle');
  byId('btnLang').textContent = t('btnLangText');
  byId('langDrawerTitle').textContent = t('btnLangTitle');
  byId('btnTheme').title = t('themeToggleTitle');
  byId('search').placeholder = t('searchPlaceholder');
  byId('unlockPassphrase').placeholder = t('unlockPassphrasePlaceholder');
  byId('vaultPassphrase').placeholder = t('vaultPassphrasePlaceholder');
  const encryptedSyncTextEl = byId('syncUseEncryptedPayloadText');
  if(encryptedSyncTextEl){
    encryptedSyncTextEl.textContent = tf('syncUseEncryptedPayloadText', 'Upload encrypted local vault payload directly');
  }
  const encryptedSyncHintEl = byId('syncUseEncryptedPayloadHint');
  if(encryptedSyncHintEl){
    encryptedSyncHintEl.textContent = tf('syncUseEncryptedPayloadHint', 'When local encryption is enabled, upload encrypted storage payload from this browser instead of plaintext account data.');
  }
  const secretFormatLabels = {
    base32: 'Base32',
    base64: 'Base64',
    hex: 'Hex',
    utf8: t('secretFormatUtf8'),
    latin1: t('secretFormatLatin1'),
  };
  for(const [value, label] of Object.entries(secretFormatLabels)){
    const opt = document.querySelector(`#fSecretFormat option[value="${value}"]`);
    if(opt) opt.textContent = label;
  }
  setMultilineText(byId('emptySub'), t('emptySub'));
  renderLanguageDrawer();
}
function majorMinor(version){
  const [major = '', minor = ''] = String(version || '').split('.');
  return `${major}.${minor}`;
}

function renderLanguageDrawer(){
  const listEl = byId('langList');
  if(!listEl) return;
  listEl.replaceChildren();
  const mismatchTipRaw = t('langVersionMismatch');
  const mismatchTip = mismatchTipRaw === 'langVersionMismatch' ? 'Language file version is incompatible with current extension version.' : mismatchTipRaw;
  for(const meta of availableLanguages){
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'lang-item';
    if(meta.localeId === uiLanguage) row.classList.add('active');
    row.addEventListener('click', () => {
      setLanguage(meta.localeId).catch(() => {});
      closeD('drawLang');
    });

    const left = document.createElement('div');
    left.className = 'lang-item-left';
    const name = document.createElement('div');
    name.className = 'lang-item-name';
    name.textContent = meta.language || meta.localeId;
    const locale = document.createElement('div');
    locale.className = 'lang-item-locale';
    locale.textContent = meta.localeId;
    left.append(name, locale);

    const right = document.createElement('div');
    right.className = 'lang-item-right';
    const mismatch = popupVersion && meta.version && majorMinor(popupVersion) !== majorMinor(meta.version);
    if(mismatch){
      const warn = document.createElement('span');
      warn.className = 'lang-item-warn';
      warn.textContent = '⚠';
      warn.title = mismatchTip;
      right.appendChild(warn);
    }
    const translator = document.createElement('span');
    translator.textContent = meta.translator || t('unknown');
    right.appendChild(translator);

    row.append(left, right);
    listEl.appendChild(row);
  }
}

async function setLanguage(next){
  uiLanguage = resolveLocaleId(next);
  await loadPopupLocale(uiLanguage);
  document.documentElement.lang = uiLanguage;
  byId('btnLang').textContent = t('btnLangText');
  browser.storage.local.set({ uiLanguage });
  applyStaticTranslations();
  applyTheme();
  updateSyncUi();
  render();
}


applyTheme();
if(window.matchMedia){
  const popupThemeMedia = window.matchMedia('(prefers-color-scheme: light)');
  const onThemeChange = () => { if(uiTheme === 'auto') applyTheme(); };
  if(popupThemeMedia.addEventListener){
    popupThemeMedia.addEventListener('change', onThemeChange);
  } else if(popupThemeMedia.addListener){
    popupThemeMedia.addListener(onThemeChange);
  }
}

function normalizeName(s){ return String(s || '').toLowerCase().replace(/[@._\-\s]+/g, ' ').trim(); }
function accountKey(acc){ return normalizeName((acc.issuer||'') + ' ' + (acc.label||'')); }

function normalizeAutofillPattern(pattern){
  return String(pattern || '').trim().toLowerCase();
}
function parseAutofillPatterns(raw){
  return String(raw || '').split(',').map(normalizeAutofillPattern).filter(Boolean).filter((item, idx, arr) => arr.indexOf(item) === idx);
}
function formatAutofillPatterns(patterns){
  return (Array.isArray(patterns) ? patterns : []).map(normalizeAutofillPattern).filter(Boolean).join(', ');
}

const ACCOUNT_SETTINGS_KEY = 'accountSettings';

function normalizeSequence(raw){
  const normalized = {};
  if(!raw || typeof raw !== 'object') return normalized;
  for(const [id, value] of Object.entries(raw)){
    const index = Number(value);
    if(!id || !Number.isFinite(index) || index < 0) continue;
    normalized[String(id)] = Math.floor(index);
  }
  return normalized;
}

async function loadAccountSettings(){
  const prefs = await browser.storage.local.get(ACCOUNT_SETTINGS_KEY);
  const data = prefs && prefs[ACCOUNT_SETTINGS_KEY];
  accountSettings = { sequence: normalizeSequence(data && data.sequence) };
}

async function persistAccountSettings(){
  await browser.storage.local.set({
    [ACCOUNT_SETTINGS_KEY]: accountSettings,
  });
}

function normalizeAccountRecord(acc){
  const next = Object.assign({}, acc || {});
  next.autofillPatterns = Array.isArray(next.autofillPatterns)
    ? next.autofillPatterns.map(normalizeAutofillPattern).filter(Boolean).filter((item, idx, arr) => arr.indexOf(item) === idx)
    : [];
  if(!next.autofillPatterns.length && typeof next.domain === 'string' && next.domain.trim()){
    next.autofillPatterns = [normalizeAutofillPattern(next.domain)];
  }
  return next;
}

function compareIssuerOrder(a, b){
  const issuerA = String(a.issuer || '').trim();
  const issuerB = String(b.issuer || '').trim();
  const issuerCmp = issuerA.localeCompare(issuerB, 'en', { numeric: true, sensitivity: 'base' });
  if(issuerCmp !== 0) return issuerCmp;

  const labelA = String(a.label || '').trim();
  const labelB = String(b.label || '').trim();
  const labelCmp = labelA.localeCompare(labelB, 'en', { numeric: true, sensitivity: 'base' });
  if(labelCmp !== 0) return labelCmp;

  return String(a.id || '').localeCompare(String(b.id || ''), 'en', { numeric: true, sensitivity: 'base' });
}

function compareAccountOrder(a, b){
  const sequence = (accountSettings && accountSettings.sequence) || {};
  const posA = sequence[String(a.id || '')];
  const posB = sequence[String(b.id || '')];
  const hasA = Number.isFinite(posA);
  const hasB = Number.isFinite(posB);
  if(hasA && hasB && posA !== posB) return posA - posB;
  if(hasA !== hasB) return hasA ? -1 : 1;

  return compareIssuerOrder(a, b);
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

function setNodeState(el, baseClass, stateClass){
  if(!el) return;
  const value = (baseClass + (stateClass ? ' ' + stateClass : '')).trim();
  if(typeof el.className === 'string') {
    el.className = value;
  } else {
    el.setAttribute('class', value);
  }
}

function startTicker(){
  if(globalTick !== null) return;
  globalTick = setInterval(() => {
    updateVisibleCodes();
    refreshDisplayCodes().catch(() => {});
  }, 1000);
}

function isVaultLocked(){
  return !!(vaultStatus.encryptionEnabled && !vaultStatus.unlocked);
}

function guardVaultUnlocked(){
  if(!isVaultLocked()) return true;
  toast(t('vaultLockedActionBlocked'));
  return false;
}
function stopTicker(){
  if(globalTick !== null){ clearInterval(globalTick); globalTick = null; }
}

function getDisplayCode(acc){
  const info = displayCodesById.get(String(acc.id || ''));
  if(info){
    if(info.type === 'hotp') return info;
    const period = Math.max(1, Number(info.period || acc.period || 30));
    const generatedAt = Number(info.generatedAt || 0);
    const baseRemaining = Math.max(1, Number(info.baseRemaining || info.remaining || period));
    if(!generatedAt){
      return Object.assign({}, info, { remaining: Math.max(0, baseRemaining) });
    }
    const elapsed = Math.max(0, Math.floor((Date.now() - generatedAt) / 1000));
    const remaining = Math.max(0, baseRemaining - elapsed);
    return Object.assign({}, info, { remaining, period });
  }
  if(acc.type === 'hotp') return { code: '------', remaining: null, period: null, counter: Math.max(0, Number(acc.counter || 0)) };
  const period = Math.max(1, Number(acc.period || 30));
  return { code: '------', remaining: period, period };
}

function updateVisibleCodes(){
  for(const acc of visibleAccounts){
    const id = sid(acc);
    const codeEl = byId('code-' + id);
    if(!codeEl) continue;
    const ringEl = byId('rfg-' + id);
    const textEl = byId('rtxt-' + id);
    const { code, remaining, period, counter } = getDisplayCode(acc);
    const isHotp = acc.type === 'hotp';
    const level = isHotp ? '' : (remaining <= 5 ? 'urgent' : remaining <= 10 ? 'warn' : '');
    const pretty = fmt(code, acc.digits || 6);
    if(codeEl.textContent !== pretty) codeEl.textContent = pretty;
    setNodeState(codeEl, 'otp-code', level);
    if(textEl) textEl.textContent = isHotp ? String(Math.max(0, Number(counter || acc.counter || 0))) : String(remaining);
    if(ringEl){
      ringEl.style.strokeDashoffset = isHotp ? '0' : (2 * Math.PI * 13 * (1 - remaining / period)).toFixed(2);
      setNodeState(ringEl, 'ring-fg', level);
    }
  }
}

async function refreshDisplayCodes(){
  if(displayCodeRefreshInFlight) return;
  const ids = visibleAccounts.map(acc => String(acc.id || '')).filter(Boolean);
  const now = Date.now();
  if(!ids.length) return;
  const visibleById = new Map(visibleAccounts.map(acc => [String(acc.id || ''), acc]));
  const idsToFetch = ids.filter((id) => {
    const cached = displayCodesById.get(id);
    if(!cached) return true;
    if(cached.type === 'hotp'){
      return true;
    }
    const nextRefreshAt = Number(cached.nextRefreshAt || 0);
    return !Number.isFinite(nextRefreshAt) || now >= nextRefreshAt;
  });
  if(!idsToFetch.length) return;
  displayCodeRefreshInFlight = true;
  try {
    const resp = await sendMessage({ action:'generateCodesForDisplay', ids: idsToFetch });
    for(const item of (resp.items || [])){
      const id = String(item.id || '');
      const acc = visibleById.get(id);
      displayCodesById.set(id, Object.assign({}, item, {
        counterSnapshot: item.type === 'hotp' ? Number((acc && acc.counter) || 0) : undefined,
      }));
    }
    updateVisibleCodes();
  } finally {
    displayCodeRefreshInFlight = false;
  }
}

function buildCard(acc){
  const { code, remaining, period, counter } = getDisplayCode(acc);
  const color = pal(acc.issuer || '');
  const level =
    acc.type !== 'hotp' && remaining !== null && remaining <= 5 ? 'urgent' :
    remaining !== null && remaining <= 10 ? 'warn' : '';

  const da = 2 * Math.PI * 13;
  const doff = acc.type === 'hotp' ? '0' : (remaining !== null ? (da * (1 - remaining / period)).toFixed(2) : '0');
  const id = sid(acc);

  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = String(acc.id);
  card.draggable = true;

  const top = document.createElement('div');
  top.className = 'card-top';

  const info = document.createElement('div');
  info.className = 'card-info';

  const issuer = document.createElement('div');
  issuer.className = 'card-issuer';

  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.backgroundColor = color;

  issuer.appendChild(dot);
  issuer.appendChild(document.createTextNode(acc.issuer || 'Unknown'));

  const label = document.createElement('div');
  label.className = 'card-label';
  label.textContent = acc.label || '';

  info.appendChild(issuer);
  info.appendChild(label);

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const patterns = Array.isArray(acc.autofillPatterns) ? acc.autofillPatterns.filter(Boolean) : [];
  if(patterns.length){
    const chip = document.createElement('span');
    chip.className = 'meta-chip match';
    chip.textContent = `${t('autofillMatchLabel')}: ${patterns.slice(0, 2).join(', ')}${patterns.length > 2 ? ` +${patterns.length - 2}` : ''}`;
    chip.title = patterns.join(', ');
    meta.appendChild(chip);
  }
  if(meta.childNodes.length) info.appendChild(meta);

  const acts = document.createElement('div');
  acts.className = 'card-acts';

  if (acc.type === 'hotp') {
    const nextBtn = document.createElement('button');
    nextBtn.className = 'act-btn';
    nextBtn.dataset.a = 'next';
    nextBtn.dataset.id = String(acc.id);
    nextBtn.title = t('nextCodeTitle');
    nextBtn.type = 'button';
    nextBtn.textContent = '↻';
    acts.appendChild(nextBtn);
  }

  const shareBtn = document.createElement('button');
  shareBtn.className = 'act-btn share';
  shareBtn.dataset.a = 'share';
  shareBtn.dataset.id = String(acc.id);
  shareBtn.title = tf('showQrCode', 'Export via QR');
  shareBtn.type = 'button';
  shareBtn.textContent = '↗';
  acts.appendChild(shareBtn);

  const editBtn = document.createElement('button');
  editBtn.className = 'act-btn edit';
  editBtn.dataset.a = 'edit';
  editBtn.dataset.id = String(acc.id);
  editBtn.title = t('editBtnTitle');
  editBtn.type = 'button';
  editBtn.textContent = '✎';
  acts.appendChild(editBtn);

  const delBtn = document.createElement('button');
  delBtn.className = 'act-btn del';
  delBtn.dataset.a = 'del';
  delBtn.dataset.id = String(acc.id);
  delBtn.title = t('deleteBtnTitle');
  delBtn.type = 'button';
  delBtn.textContent = '✕';
  acts.appendChild(delBtn);

  top.appendChild(info);
  top.appendChild(acts);

  const otp = document.createElement('div');
  otp.className = 'card-otp';

  const left = document.createElement('div');

  const codeEl = document.createElement('div');
  codeEl.className = level ? `otp-code ${level}` : 'otp-code';
  codeEl.id = `code-${id}`;
  codeEl.textContent = fmt(code, acc.digits || 6);

  const hint = document.createElement('div');
  hint.className = 'otp-hint';
  hint.textContent = t('clickToCopy');

  left.appendChild(codeEl);
  left.appendChild(hint);
  otp.appendChild(left);

  {
    const wrap = document.createElement('div');
    wrap.className = 'ring-wrap';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'ring-svg');
    svg.setAttribute('width', '34');
    svg.setAttribute('height', '34');
    svg.setAttribute('viewBox', '0 0 34 34');

    const bg = document.createElementNS(svgNS, 'circle');
    bg.setAttribute('class', 'ring-bg');
    bg.setAttribute('cx', '17');
    bg.setAttribute('cy', '17');
    bg.setAttribute('r', '13');
    bg.setAttribute('fill', 'none');
    bg.setAttribute('stroke-width', '2.5');

    const fg = document.createElementNS(svgNS, 'circle');
    fg.setAttribute('class', level ? `ring-fg ${level}` : 'ring-fg');
    fg.setAttribute('cx', '17');
    fg.setAttribute('cy', '17');
    fg.setAttribute('r', '13');
    fg.setAttribute('fill', 'none');
    fg.setAttribute('stroke-width', '2.5');
    fg.setAttribute('stroke-dasharray', da.toFixed(2));
    fg.setAttribute('stroke-dashoffset', doff);
    fg.id = `rfg-${id}`;

    svg.appendChild(bg);
    svg.appendChild(fg);

    const num = document.createElement('div');
    num.className = 'ring-num';
    num.id = `rtxt-${id}`;
    num.textContent = acc.type === 'hotp'
      ? String(Math.max(0, Number(counter || acc.counter || 0)))
      : String(remaining);

    wrap.appendChild(svg);
    wrap.appendChild(num);
    otp.appendChild(wrap);
  }

  card.appendChild(top);
  card.appendChild(otp);

  return card;
}

function persistSequenceFromCurrentOrder(){
  const next = {};
  accounts.forEach((acc, idx) => { next[String(acc.id)] = idx; });
  accountSettings.sequence = next;
}

async function reorderAccount(dragId, dropId){
  const from = accounts.findIndex(a => String(a.id) === String(dragId));
  const to = accounts.findIndex(a => String(a.id) === String(dropId));
  if(from < 0 || to < 0 || from === to) return;
  const [moved] = accounts.splice(from, 1);
  accounts.splice(to, 0, moved);
  persistSequenceFromCurrentOrder();
  await persistAndRender();
}

function clearDragOverStyles(){
  for(const row of byId('list').querySelectorAll('.card.drag-over')) row.classList.remove('drag-over');
}

function finishTouchDrag(){
  if(!touchDragState) return;
  if(touchDragState.timerId) clearTimeout(touchDragState.timerId);
  if(touchDragState.card) touchDragState.card.classList.remove('dragging');
  byId('list').classList.remove('touch-dragging');
  touchDragState = null;
  dragAccountId = null;
  clearDragOverStyles();
}

function startTouchHoldDrag(e){
  if(!guardVaultUnlocked()) return;
  const card = e.target.closest('.card');
  if(!card) return;
  if(e.target.closest('[data-a], .otp-code')) return;
  finishTouchDrag();
  const touch = e.touches && e.touches[0];
  if(!touch) return;
  touchDragState = {
    card,
    startX: touch.clientX,
    startY: touch.clientY,
    lastDropId: null,
    dragging: false,
    timerId: setTimeout(() => {
      if(!touchDragState || touchDragState.card !== card) return;
      touchDragState.dragging = true;
      dragAccountId = String(card.dataset.id || '');
      card.classList.add('dragging');
      byId('list').classList.add('touch-dragging');
    }, TOUCH_DRAG_HOLD_MS),
  };
}

function moveTouchHoldDrag(e){
  if(!touchDragState) return;
  const touch = e.touches && e.touches[0];
  if(!touch) return;
  const dx = touch.clientX - touchDragState.startX;
  const dy = touch.clientY - touchDragState.startY;
  if(!touchDragState.dragging && Math.hypot(dx, dy) > 10){
    finishTouchDrag();
    return;
  }
  if(!touchDragState.dragging) return;
  e.preventDefault();
  const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.card');
  clearDragOverStyles();
  if(!target || String(target.dataset.id || '') === dragAccountId){
    touchDragState.lastDropId = null;
    return;
  }
  target.classList.add('drag-over');
  touchDragState.lastDropId = String(target.dataset.id || '');
}

async function endTouchHoldDrag(){
  if(!touchDragState) return;
  const shouldReorder = touchDragState.dragging && dragAccountId && touchDragState.lastDropId;
  const dragId = dragAccountId;
  const dropId = touchDragState.lastDropId;
  finishTouchDrag();
  if(shouldReorder) await reorderAccount(dragId, dropId);
}


async function openQrPreviewTabForAccountId(accountId){
  await sendMessage({ action:'openQrPreviewForAccount', id: accountId });
}

function render(){
  const list = byId('list');
  const empty = byId('empty');
  const q = byId('search').value.toLowerCase().trim();
  visibleAccounts = accounts
    .filter(a => (a.issuer||'').toLowerCase().includes(q) || (a.label||'').toLowerCase().includes(q))
    .slice()
    .sort(compareAccountOrder);
empty.style.display = visibleAccounts.length ? 'none' : 'flex';
  const frag = document.createDocumentFragment();
  for(const acc of visibleAccounts) frag.appendChild(buildCard(acc));
  list.replaceChildren(empty, frag);
  if(visibleAccounts.some(a => a.type !== 'hotp')) startTicker(); else stopTicker();
  refreshDisplayCodes().catch(() => {});
}


function toDebugEnglishMessage(message){
  const raw = String(message == null ? '' : message);
  if(!raw) return raw;
  const langPack = I18N[uiLanguage] || {};
  const basePack = I18N[DEFAULT_LOCALE_ID] || {};
  for(const [key, value] of Object.entries(langPack)){
    if(String(value) === raw && basePack[key]) return String(basePack[key]);
  }
  return raw;
}

function toast(msg){
  const t = byId('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._tmr);
  toast._tmr = setTimeout(() => t.classList.remove('show'), 1800);
}

async function debugInfo(message, context){
  try {
    await browser.runtime.sendMessage({ action:'appendDebugInfo', message, context });
  } catch (_) {
    // Ignore debug logging errors to avoid affecting UX.
  }
}

function openD(id){ byId(id).classList.add('open'); }
function closeD(id){ byId(id).classList.remove('open'); }

function nextAccountId(){
  if(crypto && crypto.randomUUID) return 'acc_' + crypto.randomUUID().replace(/-/g, '');
  return 'acc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function findPotentialDuplicates(acc, pool = accounts){
  const issuer = normalizeName(acc.issuer);
  const label = normalizeName(acc.label);
  const full = accountKey(acc);
  return pool.filter(existing => {
    const exFull = accountKey(existing);
    const exIssuer = normalizeName(existing.issuer);
    const exLabel = normalizeName(existing.label);
    if(existing.id && acc.id && String(existing.id) === String(acc.id)) return false;
    if(full && exFull === full) return true;
    if(label && exLabel === label) return true;
    if(issuer && label && exIssuer === issuer && (exLabel.includes(label) || label.includes(exLabel))) return true;
    return false;
  });
}

function duplicateWarningText(acc, matches){
  const sample = matches.slice(0, 3).map(m => `${m.issuer || t('unknown')} / ${m.label || t('noLabel')}`).join('\n');
  return `Found ${matches.length} account name match${matches.length > 1 ? 'es' : ''} for:\n${acc.issuer || t('unknown')} / ${acc.label || t('noLabel')}\n\n${sample}${matches.length > 3 ? '\n...' : ''}\n\nAdd it anyway?`;
}

function buildImportSummaryText(parsedCount, failCount, duplicateCount){
  const failPart = failCount ? tFmt('importFailPart', { count: failCount }) : '';
  const dupPart = duplicateCount ? tFmt('importDupPart', { count: duplicateCount }) : '';
  return tFmt('importSummary', { ok: parsedCount, failPart, dupPart });
}

async function parseImportData(raw){
  const resp = await sendMessage({ action:'parseAccountsForImport', rawText: raw });
  if(!resp || resp.success === false) throw new Error((resp && resp.error) || t('importNothing'));
  return { parsed: Array.isArray(resp.parsed) ? resp.parsed : [], fail: Number(resp.fail || 0), inputType: resp.inputType || 'unknown' };
}

async function saveAccounts(){
  const resp = await sendMessage({ action:'saveAccounts', accounts });
  updateSyncBadgeFromResponse(resp);
}

async function persistAndRender(){
  const ids = new Set(accounts.map(acc => String(acc.id)));
  const seq = (accountSettings && accountSettings.sequence) || {};
  for(const id of Object.keys(seq)){
    if(!ids.has(id)) delete seq[id];
  }
  accountSettings.sequence = normalizeSequence(seq);
  await saveAccounts();
  await persistAccountSettings();
  render();
}

async function pushAccount(acc, opts = {}){
  const item = normalizeAccountRecord(Object.assign({}, acc, { id: acc.id || nextAccountId() }));
  const matches = findPotentialDuplicates(item);
  if(matches.length && !opts.skipDuplicateConfirm){
    const ok = window.confirm(duplicateWarningText(item, matches));
    if(!ok) return false;
  }
  accounts.push(item);
  await persistAndRender();
  return true;
}

function resetForm(){
  ['fIssuer','fLabel','fSecret','fUri','fAutofillPatterns'].forEach(id => { const el = byId(id); if(el) el.value = ''; });
  byId('addErr').style.display = 'none';
  byId('dupHint').style.display = 'none';
  byId('fType').value = 'totp';
  byId('fSecretFormat').value = 'base32';
  byId('fDigits').value = '6';
  byId('fPeriod').value = '30';
  setQrStatus('', false);
  if(resetForm.qrPollInterval){ clearInterval(resetForm.qrPollInterval); resetForm.qrPollInterval = null; }
}

function resetEditForm(){
  editingAccountId = null;
  byId('editIssuer').value = '';
  byId('editLabel').value = '';
  byId('editAutofillPatterns').value = '';
  byId('editErr').style.display = 'none';
}

function openEditDrawer(acc){
  editingAccountId = acc.id;
  byId('editIssuer').value = acc.issuer || '';
  byId('editLabel').value = acc.label || '';
  byId('editAutofillPatterns').value = formatAutofillPatterns(acc.autofillPatterns);
  byId('editErr').style.display = 'none';
  openD('drawEdit');
}

function setQrStatus(msg, isErr){
  const el = byId('qrStatus');
  el.textContent = msg;
  el.className = 'qr-status' + (isErr ? ' qr-err' : '');
}

function updateDuplicateHint(){
  const hint = byId('dupHint');
  const draft = {
    issuer: byId('fIssuer').value.trim() || byId('fLabel').value.trim(),
    label: byId('fLabel').value.trim(),
  };
  if(!draft.label){
    hint.style.display = 'none';
    return;
  }
  const matches = findPotentialDuplicates(draft);
  if(!matches.length){
    hint.style.display = 'none';
    return;
  }
  hint.textContent = tFmt('duplicateHint', { count: matches.length, suffix: matches.length > 1 ? 's' : '' });
  hint.style.display = 'block';
}

async function loadAccounts(){
  const resp = await sendMessage({ action:'getAccounts' });
  return (resp.accounts || []).map(normalizeAccountRecord);
}

function fmtTs(ts){ return ts ? new Date(ts).toLocaleString() : t('never'); }

function updateSyncUi(){
  byId('autofillEnabled').checked = featureSettings.autofillEnabled !== false;
  byId('rightclickEnabled').checked = featureSettings.rightclickEnabled !== false;
  byId('syncEnabled').checked = !!syncSettings.enabled;
  byId('syncSessionId').value = syncSettings.sessionId || '';
  byId('syncInterval').value = syncSettings.intervalMinutes || 5;
  byId('syncUseEncryptedPayload').checked = !!syncSettings.useEncryptedPayload;
  const encryptedUploadRow = byId('syncEncryptedUploadRow');
  if(encryptedUploadRow){
    encryptedUploadRow.style.display = vaultStatus.encryptionEnabled ? 'block' : 'none';
  }
  const meta = [
    t('storageModeLabel') + (syncSettings.enabled && syncSettings.sessionId ? t('storageModeSync') : t('storageModeLocal')),
    t('lastUpload') + fmtTs(syncSettings.lastUploadedAt),
    t('lastDownload') + fmtTs(syncSettings.lastDownloadedAt),
  ];
  byId('syncMeta').textContent = meta.join('\n');

  const badge = byId('syncBadge');
  const text = byId('syncBadgeText');
  badge.classList.remove('offline', 'syncing');
  if(syncSettings.enabled && syncSettings.sessionId){
    badge.classList.add('syncing');
    text.textContent = t('syncOn') + syncSettings.sessionId;
  } else {
    badge.classList.add('offline');
    text.textContent = t('localOnly');
  }
}

function updateSyncBadgeFromResponse(resp){
  if(resp && resp.settings) syncSettings = Object.assign({}, syncSettings, resp.settings);
  if(resp && resp.upload && resp.upload.updatedAt) syncSettings.lastUploadedAt = resp.upload.updatedAt;
  if(resp && resp.sync && resp.sync.updatedAt) syncSettings.lastUploadedAt = resp.sync.updatedAt;
  updateSyncUi();
}

function updateDebugUi(){
  const shouldShow = debugState.enabled || debugUiUnlocked;
  byId('settingDebugTitle').style.display = shouldShow ? 'block' : 'none';
  byId('debugPanel').style.display = shouldShow ? 'block' : 'none';
  byId('debugSep').style.display = shouldShow ? 'block' : 'none';
  byId('debugEnabled').checked = !!debugState.enabled;
  byId('btnDownloadDebug').disabled = !debugState.enabled;
  const errEl = byId('debugErr');
  if(!shouldShow){
    errEl.style.display = 'none';
    errEl.textContent = '';
  }
}

async function loadSyncSettings(){
  const resp = await sendMessage({ action:'getSyncSettings' });
  if(resp.settings) syncSettings = Object.assign({}, syncSettings, resp.settings);
  updateSyncUi();
}
async function loadFeatureSettings(){
  const resp = await sendMessage({ action:'getFeatureSettings' });
  if(resp.settings) featureSettings = Object.assign({}, featureSettings, resp.settings);
  updateSyncUi();
}
async function loadDebugState(){
  const resp = await sendMessage({ action:'getDebugState' });
  if(resp.debug) debugState = Object.assign({}, debugState, resp.debug);
  if(debugState.enabled) debugUiUnlocked = true;
  updateDebugUi();
}

function updateVaultUi(){
  byId('vaultPassphrase').value = '';
  byId('vaultEncryptionEnabled').checked = !!vaultStatus.encryptionEnabled;
  byId('vaultMeta').textContent = [
    t('vaultMetaEncryption') + (vaultStatus.encryptionEnabled ? t('enabled') : t('disabled')),
    t('vaultMetaState') + (vaultStatus.encryptionEnabled ? (vaultStatus.unlocked ? t('unlocked') : t('locked')) : t('notRequired')),
    t('vaultMetaLastUnlock') + fmtTs(vaultStatus.lastUnlockedAt),
  ].join('\n');
  byId('vaultLockedPill').style.display = vaultStatus.encryptionEnabled && !vaultStatus.unlocked ? 'inline-flex' : 'none';
  byId('lockScreen').style.display = vaultStatus.encryptionEnabled && !vaultStatus.unlocked ? 'flex' : 'none';
  const encryptedUploadRow = byId('syncEncryptedUploadRow');
  if(encryptedUploadRow){
    encryptedUploadRow.style.display = vaultStatus.encryptionEnabled ? 'block' : 'none';
  }

  const locked = isVaultLocked();
  const gatedIds = ['btnAdd','btnImport','btnExport','btnSetting'];
  for(const id of gatedIds){
    const el = byId(id);
    if(!el) continue;
    el.disabled = locked;
    el.classList.toggle('is-disabled', locked);
    el.setAttribute('aria-disabled', locked ? 'true' : 'false');
  }
}

async function refreshVaultTimerSettings(){
  const resp = await sendMessage({ action:'getVaultTimerSettings' });
  if(resp && resp.settings){
    vaultTimerSettings = Object.assign({}, vaultTimerSettings, resp.settings);
  }
  byId('vaultTimerEnabled').checked = !!vaultTimerSettings.autoLockEnabled;
  byId('vaultTimerPeriod').value = Number(vaultTimerSettings.autoLockMinutes || 15);
}

async function refreshVaultStatus(){
  vaultStatus = await sendMessage({ action:'getVaultStatus' });
  updateVaultUi();
}

async function unlockWithInput(inputId, errId){
  const passphrase = byId(inputId).value;
  const errEl = byId(errId);
  errEl.style.display = 'none';
  try {
    await sendMessage({ action:'unlockVault', passphrase });
    await refreshVaultStatus();
    accounts = await loadAccounts();
    render();
    toast(t('vaultUnlockedToast'));
  } catch(err){
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
}


async function migrateAccountSequenceIfMissing(){
  const prefs = await browser.storage.local.get(ACCOUNT_SETTINGS_KEY);
  const raw = prefs && prefs[ACCOUNT_SETTINGS_KEY];
  if(raw && typeof raw === 'object' && raw.sequence && typeof raw.sequence === 'object') return false;
  const beforeOrder = accounts.map(acc => String(acc && acc.id || ''));
  accounts = accounts.slice().sort(compareIssuerOrder);
  persistSequenceFromCurrentOrder();
  await persistAccountSettings();
  await debugInfo('Account sequence migrated to accountSettings.sequence', {
    reason: 'missing_sequence',
    accountCount: accounts.length,
    beforeOrder,
    afterOrder: accounts.map(acc => String(acc && acc.id || '')),
    sequenceSize: Object.keys((accountSettings && accountSettings.sequence) || {}).length,
  });
  return true;
}

async function boot(){
  const prefs = await browser.storage.local.get(['uiLanguage','uiTheme']);
  uiTheme = prefs.uiTheme || 'auto';
  await loadAvailableLanguages();
  await loadAccountSettings();
  const fallbackLocale = availableLanguages[0] ? availableLanguages[0].localeId : DEFAULT_LOCALE_ID;
  await setLanguage(resolveLocaleId(prefs.uiLanguage || fallbackLocale));
  applyTheme();
  
  await refreshVaultStatus();
  await refreshVaultTimerSettings();
  await loadFeatureSettings();
  await loadSyncSettings();
  await loadDebugState();
  if(vaultStatus.encryptionEnabled && !vaultStatus.unlocked){
    accounts = [];
    render();
    return;
  }
  accounts = await loadAccounts();
  await migrateAccountSequenceIfMissing();
  render();
}

function handleDebugLogoTap(){
  const now = Date.now();
  debugTapTimes.push(now);
  while(debugTapTimes.length && now - debugTapTimes[0] > DEBUG_TAP_WINDOW_MS){
    debugTapTimes.shift();
  }
  if(debugTapTimes.length >= 5){
    debugTapTimes.length = 0;
    debugUiUnlocked = true;
    updateDebugUi();
    toast(t('debugUnlockedToast'));
  }
}

byId('btnReorderAll').addEventListener('click', async () => {
  if(!guardVaultUnlocked()) return;
  accounts = accounts.slice().sort(compareIssuerOrder);
  persistSequenceFromCurrentOrder();
  await persistAndRender();
  toast(tf('reorderAccountSuccess', 'Accounts reordered.'));
});

byId('btnAdd').addEventListener('click', () => {
  if(!guardVaultUnlocked()) return;
  openD('drawAdd');
});
byId('hdrLogo').addEventListener('click', handleDebugLogoTap);
byId('btnTheme').addEventListener('click', () => setTheme((document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark'));
byId('btnLang').addEventListener('click', () => openD('drawLang'));
byId('closeLang').addEventListener('click', () => closeD('drawLang'));
byId('drawLang').addEventListener('click', function(e){ if(e.target===this) closeD('drawLang'); });
byId('closeAdd').addEventListener('click', () => { closeD('drawAdd'); resetForm(); });
byId('drawAdd').addEventListener('click', function(e){ if(e.target===this){ closeD('drawAdd'); resetForm(); } });
const syncEntryBtn = settingButton();
if(syncEntryBtn) syncEntryBtn.addEventListener('click', () => {
  if(!guardVaultUnlocked()) return;
  openD('drawSync');
});
byId('closeSync').addEventListener('click', () => closeD('drawSync'));
byId('drawSync').addEventListener('click', function(e){ if(e.target===this) closeD('drawSync'); });
byId('closeExport').addEventListener('click', () => closeD('drawExport'));
byId('drawExport').addEventListener('click', function(e){ if(e.target===this) closeD('drawExport'); });
byId('btnImport').addEventListener('click', () => {
  if(!guardVaultUnlocked()) return;
  openD('drawImport');
});
byId('closeImport').addEventListener('click', () => closeD('drawImport'));
byId('drawImport').addEventListener('click', function(e){ if(e.target===this) closeD('drawImport'); });
byId('closeEdit').addEventListener('click', () => { closeD('drawEdit'); resetEditForm(); });
byId('drawEdit').addEventListener('click', function(e){ if(e.target===this){ closeD('drawEdit'); resetEditForm(); } });

for(const btn of document.querySelectorAll('.tab')){
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    byId('tabManual').style.display = activeTab==='manual' ? 'block' : 'none';
    byId('tabQr').style.display = activeTab==='qr' ? 'block' : 'none';
    byId('tabUri').style.display = activeTab==='uri' ? 'block' : 'none';
  });
}

byId('btnOpenQrTab').addEventListener('click', () => {
  if(!guardVaultUnlocked()) return;
  browser.storage.local.remove('pendingQrAccount');
  browser.tabs.create({ url: browser.runtime.getURL('qr/qr.html') });
  setQrStatus(t('qrTabOpenedStatus'), false);
  if(resetForm.qrPollInterval) clearInterval(resetForm.qrPollInterval);
  resetForm.qrPollInterval = setInterval(async () => {
    const result = await browser.storage.local.get('pendingQrAccount');
    if(!result.pendingQrAccount) return;
    clearInterval(resetForm.qrPollInterval);
    resetForm.qrPollInterval = null;
    await browser.storage.local.remove('pendingQrAccount');
    const added = await pushAccount(result.pendingQrAccount);
    if(added){ closeD('drawAdd'); resetForm(); toast(t('qrAccountAdded')); }
  }, 800);
});

byId('btnSave').addEventListener('click', async () => {
  if(!guardVaultUnlocked()) return;
  const errEl = byId('addErr');
  errEl.style.display = 'none';
  try {
    let acc;
    if(activeTab === 'uri'){
      const uri = byId('fUri').value.trim();
      if(!uri) throw new Error(t('needOtpAuthUri'));

      const { parsed } = await parseImportData(uri);
      if(!parsed.length) throw new Error(t('needOtpAuthUri'));

      let addedCount = 0;
      for(const item of parsed){
        const added = await pushAccount(item);
        if(added) addedCount++;
      }

      if(addedCount > 0){
         closeD('drawAdd');
         resetForm();
         toast(addedCount > 1 ? tFmt('migrationAccountsImported', { count: addedCount }) : t('accountSaved'));
       }
       return;
    } else if(activeTab === 'qr'){
      throw new Error(t('useOpenQrTabBtn'));
    } else {
      const secret = byId('fSecret').value.trim();
      const label = byId('fLabel').value.trim();
      const secretFormat = byId('fSecretFormat').value;
      if(!secret) throw new Error(t('secretRequired'));
      if(!label) throw new Error(t('accountNameRequired'));
      const draft = {
        type: byId('fType').value,
        issuer: byId('fIssuer').value.trim() || label,
        label,
        secret,
        secretFormat,
        algorithm: 'SHA1',
        digits: parseInt(byId('fDigits').value, 10),
        period: parseInt(byId('fPeriod').value, 10),
        counter: 0,
        autofillPatterns: parseAutofillPatterns(byId('fAutofillPatterns').value),
      };
      try {
        const normalized = await sendMessage({ action:'normalizeAccountForPopup', account: draft });
        acc = normalized && normalized.account;
      } catch(e){
        debugInfo('Popup manual account normalization failed', {
          secretFormat,
          secretLength: secret.length,
          parseError: e && e.message ? e.message : String(e),
          issuer: draft.issuer,
          label,
        });
        throw new Error(t('invalidSecretByFormat'));
      }
      debugInfo('Popup manual account normalized', {
        secretFormat,
        secretLength: secret.length,
        normalizedBase32Length: acc && acc.secret ? acc.secret.length : 0,
        issuer: draft.issuer,
        label,
        type: draft.type,
      });
    }
    const added = await pushAccount(acc);
    debugInfo('Popup add account submit result', {
      activeTab,
      added: !!added,
      accountType: acc && acc.type,
      issuer: acc && acc.issuer,
      label: acc && acc.label,
    });
    if(added){ closeD('drawAdd'); resetForm(); toast(t('accountAdded')); }
  } catch(e){
    debugInfo('Popup add account failed', {
      activeTab,
      error: toDebugEnglishMessage(e && e.message ? e.message : String(e)),
    });
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
});

byId('btnExport').addEventListener('click', async () => {
  if(!guardVaultUnlocked()) return;
  if(!accounts.length){ toast(t('noAccountsToExport')); return; }
  const resp = await sendMessage({ action:'buildOtpAuthUrisForExport' });
  const lines = resp && Array.isArray(resp.uris) ? resp.uris : [];
  byId('exportData').value = lines.join('\n');
  openD('drawExport');
});
byId('btnCopyExport').addEventListener('click', () => {
  if(!guardVaultUnlocked()) return;
  navigator.clipboard.writeText(byId('exportData').value).then(() => toast(t('copied')));
});
byId('btnDownloadExportJson').addEventListener('click', async () => {
  if(!guardVaultUnlocked()) return;
  if(!accounts.length){ toast(t('exportJsonEmpty')); return; }
  const jsonExport = await sendMessage({ action:'buildJsonExportPayload' });
  let payload = jsonExport && jsonExport.payload;
  let exportedMode = 'plaintext';
  if(vaultStatus.encryptionEnabled){
    try {
      const vaultExport = await sendMessage({ action:'getEncryptedPayloadForExport' });
      const encryptedPayload = vaultExport && vaultExport.payload;
      const hasEncryptedPayload = !!(vaultExport && vaultExport.hasPayload);
      await debugInfo('Popup JSON export encryption status checked', {
        encryptionEnabled: !!vaultStatus.encryptionEnabled,
        hasEncryptedPayload,
      });
      if(hasEncryptedPayload){
        const confirmText = tf('exportJsonEncrypted', 'Local vault is encrypted. Export as encrypted?');
        const shouldExportEncrypted = window.confirm(confirmText);
        await debugInfo('Popup JSON export mode confirmed', {
          shouldExportEncrypted,
        });
        if(shouldExportEncrypted){
          payload = encryptedPayload;
          exportedMode = 'encrypted';
        }
      }
    } catch (err){
      await debugInfo('Popup JSON export encryption check failed', {
        error: toDebugEnglishMessage(err && err.message ? err.message : String(err)),
      });
    }
  }
  debugInfo('Popup JSON export requested', {
    mode: exportedMode,
    accountCount: exportedMode === 'plaintext' ? payload.accounts.length : null,
    fields: exportedMode === 'plaintext' ? ['id','type','issuer','label','secret','algorithm','digits','period','counter','autofillPatterns'] : ['kdf','iterations','salt','keyLength','cipher','version','iv','data'],
  });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = tFmt('exportJsonFilename', { timestamp: stamp });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  debugInfo('Popup JSON export download triggered', {
    mode: exportedMode,
    accountCount: exportedMode === 'plaintext' ? payload.accounts.length : null,
    filename: a.download,
  });
});

async function applyImportRawText(rawText){
  const errEl = byId('importErr');
  errEl.style.display = 'none';
  try {
    const { parsed, fail, inputType } = await parseImportData(rawText);
    debugInfo('Popup import parse finished', {
      inputType,
      parsedCount: parsed.length,
      failedCount: fail,
    });
    if(!parsed.length){
      errEl.textContent = t('importNothing');
      errEl.style.display = 'block';
      return;
    }
    const duplicateCount = parsed.reduce((n, acc) => n + (findPotentialDuplicates(acc, accounts.concat(parsed)).length ? 1 : 0), 0);
    if(duplicateCount){
      const ok = window.confirm(tFmt('importDuplicateConfirm', { count: duplicateCount }));
      if(!ok) return;
    }
    accounts = accounts.concat(parsed.map(acc => normalizeAccountRecord(Object.assign({}, acc, { id: acc.id || nextAccountId() }))));
    await persistAndRender();
    debugInfo('Popup import persisted', {
      importedCount: parsed.length,
      failedCount: fail,
      duplicateWarned: duplicateCount,
      totalAccounts: accounts.length,
    });
    closeD('drawImport');
    byId('importData').value = '';
    toast(buildImportSummaryText(parsed.length, fail, duplicateCount));
  } catch(err){
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
}

byId('btnOpenJsonImportTab').addEventListener('click', () => {
  if(!guardVaultUnlocked()) return;
  browser.tabs.create({ url: browser.runtime.getURL('json-import/json-import.html') });
  toast(t('openJsonImportTabStatus'));
  debugInfo('Popup opened JSON import tab');
});

byId('btnDoImport').addEventListener('click', async () => {
  if(!guardVaultUnlocked()) return;
  await applyImportRawText(byId('importData').value);
});

byId('search').addEventListener('input', render);
byId('fIssuer').addEventListener('input', updateDuplicateHint);
byId('fLabel').addEventListener('input', updateDuplicateHint);

byId('list').addEventListener('click', async e => {
  if(!guardVaultUnlocked()) return;
  const actionBtn = e.target.closest('[data-a]');
  if(actionBtn){
    const index = accounts.findIndex(a => String(a.id) === String(actionBtn.dataset.id));
    if(index < 0) return;
    if(actionBtn.dataset.a === 'del'){
      if(!window.confirm(t('deleteConfirm'))) return;
      accounts.splice(index, 1);
      await persistAndRender();
    }
    if(actionBtn.dataset.a === 'next'){
      accounts[index].counter = (accounts[index].counter || 0) + 1;
      await persistAndRender();
    }
    if(actionBtn.dataset.a === 'edit'){
      openEditDrawer(accounts[index]);
    }
    if(actionBtn.dataset.a === 'share'){
      try {
        await debugInfo('Popup opening QR export preview', {
          accountId: String(accounts[index].id || ''),
          issuer: String(accounts[index].issuer || ''),
          label: String(accounts[index].label || ''),
          type: accounts[index].type === 'hotp' ? 'hotp' : 'totp',
        });
        await openQrPreviewTabForAccountId(accounts[index].id);
        toast(tf('showQrCodeSuccess', 'QR Code generated in new tab.'));
      } catch (err) {
        toast((err && err.message) || 'Failed to generate QR image.');
      }
    }
    return;
  }
  const codeEl = e.target.closest('.otp-code');
  if(codeEl){
    const card = codeEl.closest('.card');
    const acc = accounts.find(a => String(a.id) === card.dataset.id);
    if(!acc) return;
    if(acc.type === 'hotp') await refreshDisplayCodes();
    const info = getDisplayCode(acc);
    navigator.clipboard.writeText((info && info.code) || '').then(() => toast(t('copied')));
  }
});


byId('list').addEventListener('dragstart', (e) => {
  const card = e.target.closest('.card');
  if(!card) return;
  dragAccountId = String(card.dataset.id || '');
  card.classList.add('dragging');
  if(e.dataTransfer){
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragAccountId);
  }
});

byId('list').addEventListener('dragend', (e) => {
  const card = e.target.closest('.card');
  if(card) card.classList.remove('dragging');
  dragAccountId = null;
  clearDragOverStyles();
});

byId('list').addEventListener('dragover', (e) => {
  const target = e.target.closest('.card');
  if(!target || !dragAccountId || String(target.dataset.id || '') === dragAccountId) return;
  e.preventDefault();
  if(e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  clearDragOverStyles();
  target.classList.add('drag-over');
});

byId('list').addEventListener('drop', async (e) => {
  const target = e.target.closest('.card');
  if(!target || !dragAccountId) return;
  e.preventDefault();
  target.classList.remove('drag-over');
  await reorderAccount(dragAccountId, String(target.dataset.id || ''));
});
byId('list').addEventListener('touchstart', startTouchHoldDrag, { passive:true });
byId('list').addEventListener('touchmove', moveTouchHoldDrag, { passive:false });
byId('list').addEventListener('touchend', () => { endTouchHoldDrag().catch(() => {}); });
byId('list').addEventListener('touchcancel', finishTouchDrag);
byId('btnSaveEdit').addEventListener('click', async () => {
  if(!guardVaultUnlocked()) return;
  const errEl = byId('editErr');
  errEl.style.display = 'none';
  try {
    if(!editingAccountId) throw new Error(t('noEditAccountSelected'));
    const label = byId('editLabel').value.trim();
    const issuer = byId('editIssuer').value.trim() || label;
    if(!label) throw new Error(t('accountNameRequired'));
    const idx = accounts.findIndex(a => String(a.id) === String(editingAccountId));
    if(idx < 0) throw new Error(t('accountNotExists'));
    accounts[idx].issuer = issuer;
    accounts[idx].label = label;
    accounts[idx].autofillPatterns = parseAutofillPatterns(byId('editAutofillPatterns').value);
    await persistAndRender();
    closeD('drawEdit');
    resetEditForm();
    toast(t('saveEditSuccess'));
  } catch(err){
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
});

byId('btnSaveSync').addEventListener('click', async () => {
  if(!guardVaultUnlocked()) return;
  const errEl = byId('syncErr');
  errEl.style.display = 'none';
  const enabled = byId('syncEnabled').checked;
  const sessionId = byId('syncSessionId').value.trim();
  const intervalMinutes = Math.max(1, parseInt(byId('syncInterval').value, 10) || 5);
  const useEncryptedPayload = byId('syncUseEncryptedPayload').checked;
  if(enabled && !sessionId){ errEl.textContent = t('needSessionEnable'); errEl.style.display = 'block'; return; }
  try {
    const resp = await sendMessage({ action:'saveSyncSettings', settings:{ enabled, sessionId, intervalMinutes, useEncryptedPayload } });
    syncSettings = resp.settings || syncSettings;
    updateSyncUi();
    updateSyncBadgeFromResponse(resp);
    toast(enabled ? t('syncSaved') : t('syncDisabled'));
  } catch(err){ errEl.textContent = err.message; errEl.style.display = 'block'; }
});

byId('btnSavePermission').addEventListener('click', async () => {
  if(!guardVaultUnlocked()) return;
  const errEl = byId('permissionErr');
  errEl.style.display = 'none';
  const autofillEnabled = byId('autofillEnabled').checked;
  const rightclickEnabled = byId('rightclickEnabled').checked;
  try {
    const resp = await sendMessage({ action:'saveFeatureSettings', settings:{ autofillEnabled, rightclickEnabled } });
    if(resp.settings) featureSettings = Object.assign({}, featureSettings, resp.settings);
    updateSyncUi();
    toast(tf('permissionSavedToast', 'Permission settings saved'));
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
});

byId('btnUploadSync').addEventListener('click', async () => {
  if(!guardVaultUnlocked()) return;
  const errEl = byId('syncErr'); errEl.style.display = 'none';
  try {
    const sessionId = byId('syncSessionId').value.trim();
    if(!sessionId){ errEl.textContent = t('needSession'); errEl.style.display = 'block'; return; }
    const resp = await sendMessage({ action:'uploadSyncNow', sessionId, useEncryptedPayload: byId('syncUseEncryptedPayload').checked });
    syncSettings.lastUploadedAt = resp.upload && resp.upload.updatedAt ? resp.upload.updatedAt : Date.now();
    updateSyncUi(); updateSyncBadgeFromResponse(resp); toast(t('uploadSuccess'));
  } catch(err){ errEl.textContent = err.message; errEl.style.display = 'block'; }
});

byId('btnDownloadSync').addEventListener('click', async () => {
  if(!guardVaultUnlocked()) return;
  const errEl = byId('syncErr'); errEl.style.display = 'none';
  const sessionId = byId('syncSessionId').value.trim();
  if(!sessionId){ errEl.textContent = t('needSession'); errEl.style.display = 'block'; return; }
  if(!window.confirm(t('confirmCloudOverwrite'))) return;
  try {
    const preview = await sendMessage({ action:'downloadSyncToLocal', sessionId, dryRun:true });
    const hasEncryptedHeader = !!(preview && preview.containsEncryptedHeader);
    const encryptedConfirmText = tf('confirmCloudEncryptedOverwrite', 'Downloaded cloud data contains an encrypted vault payload. Overwrite local data with encrypted payload and lock vault now?');
    if(hasEncryptedHeader && !window.confirm(encryptedConfirmText)) return;
    const resp = await sendMessage({ action:'downloadSyncToLocal', sessionId, allowEncrypted: hasEncryptedHeader });
    syncSettings.lastDownloadedAt = Date.now();
    if(resp && resp.appliedEncryptedPayload){
      await refreshVaultStatus();
      accounts = [];
      render();
      toast(tf('downloadedEncryptedCloudData', 'Downloaded encrypted cloud data and locked vault'));
    } else {
      accounts = Array.isArray(resp.accounts) ? resp.accounts : [];
      render();
      toast(t('downloadedCloudData'));
    }
    updateSyncUi();
  } catch(err){ errEl.textContent = err.message; errEl.style.display = 'block'; }
});

byId('btnApplyVault').addEventListener('click', async () => {
  const errEl = byId('vaultErr'); errEl.style.display = 'none';
  const wantEncrypt = byId('vaultEncryptionEnabled').checked;
  const passphrase = byId('vaultPassphrase').value;
  const autoLockEnabled = byId('vaultTimerEnabled').checked;
  const autoLockMinutes = Math.max(1, parseInt(byId('vaultTimerPeriod').value, 10) || 15);
  try {
    let changed = false;
    if(wantEncrypt && !vaultStatus.encryptionEnabled){
      await sendMessage({ action:'enableEncryption', passphrase });
      changed = true;
    } else if(!wantEncrypt && vaultStatus.encryptionEnabled){
      if(!window.confirm(t('confirmDisableEncryption'))) return;
      await sendMessage({ action:'disableEncryption', passphrase });
      changed = true;
    } else if(wantEncrypt && vaultStatus.encryptionEnabled && !vaultStatus.unlocked){
      await sendMessage({ action:'unlockVault', passphrase });
      toast(t('vaultUnlockedToast'));
    }
    const timerChanged = (autoLockEnabled !== !!vaultTimerSettings.autoLockEnabled)
      || (autoLockMinutes !== Math.max(1, parseInt(vaultTimerSettings.autoLockMinutes, 10) || 15));
    const timerResp = await sendMessage({ action:'saveVaultTimerSettings', settings:{ autoLockEnabled, autoLockMinutes } });
    if(timerResp && timerResp.settings){
      vaultTimerSettings = Object.assign({}, vaultTimerSettings, timerResp.settings);
    }
    if(timerChanged) changed = true;
    toast(tf(changed ? 'securitySettingChanged' : 'securitySettingUnchanged', changed ? 'Security settings updated' : 'Security settings unchanged'));
    await refreshVaultStatus();
    await refreshVaultTimerSettings();
    accounts = await loadAccounts();
    render();
  } catch(err){ errEl.textContent = err.message; errEl.style.display = 'block'; }
});

byId('btnLockVault').addEventListener('click', async () => {
  const errEl = byId('vaultErr'); errEl.style.display = 'none';
  try {
    await sendMessage({ action:'lockVault' });
    await refreshVaultStatus();
    ['drawAdd','drawImport','drawExport','drawSync','drawEdit'].forEach(closeD);
    accounts = [];
    render();
    toast(t('vaultLockedToast'));
  } catch(err){
    if(err && err.code === 'NEED_ENCRYPTION_FIRST'){
      toast(t('needEncryptBeforeLock'));
      return;
    }
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
});

byId('debugEnabled').addEventListener('change', async () => {
  const errEl = byId('debugErr');
  errEl.style.display = 'none';
  try {
    const enabled = byId('debugEnabled').checked;
    const resp = await sendMessage({ action:'setDebugEnabled', enabled });
    debugState = Object.assign({}, debugState, (resp && resp.debug) || {});
    if(!debugState.enabled){
      debugUiUnlocked = false;
    }
    updateDebugUi();
    toast(debugState.enabled ? t('debugModeOn') : t('debugModeOff'));
  } catch(err){
    byId('debugEnabled').checked = !!debugState.enabled;
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
});

byId('btnDownloadDebug').addEventListener('click', async () => {
  const errEl = byId('debugErr');
  errEl.style.display = 'none';
  try {
    const resp = await sendMessage({ action:'getDebugLogText' });
    const text = String((resp && resp.text) || '');
    if(!text){
      toast(t('debugLogEmpty'));
      return;
    }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vault2fa-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch(err){
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
});

byId('btnUnlock').addEventListener('click', () => unlockWithInput('unlockPassphrase', 'unlockErr'));
byId('unlockPassphrase').addEventListener('keydown', e => { if(e.key === 'Enter') unlockWithInput('unlockPassphrase', 'unlockErr'); });

boot().catch(err => {
  console.error(err);
  toast(t('popupLoadFailed'));
});
