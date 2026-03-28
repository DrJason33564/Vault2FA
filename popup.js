// SPDX-License-Identifier: MIT
'use strict';

const OTPAuth = window.OTPAuth;

let accounts = [];
let visibleAccounts = [];
let activeTab = 'manual';
let globalTick = null;
let syncSettings = { enabled:false, sessionId:'', intervalMinutes:5, lastUploadedAt:null, lastDownloadedAt:null };
let vaultStatus = { encryptionEnabled:false, unlocked:true, lastUnlockedAt:null };
let debugState = { enabled:false };
let debugUiUnlocked = false;
let uiLanguage = 'en';
let uiTheme = 'auto';
let editingAccountId = null;
const debugTapTimes = [];
const DEBUG_TAP_WINDOW_MS = 1600;

const I18N = {
  en: {
    localOnly: 'Local only',
    syncOn: 'Sync ON · ',
    storageModeLabel: 'Storage mode: ',
    storageModeSync: 'Local + Firefox Sync upload',
    storageModeLocal: 'Local only',
    lastUpload: 'Last upload: ',
    lastDownload: 'Last local overwrite from cloud: ',
    uploadSuccess: 'Uploaded local data',
    syncSaved: 'Sync settings saved',
    syncDisabled: 'Auto upload disabled',
    needSession: 'Please enter a sync session ID first.',
    needSessionEnable: 'Please enter a sync session ID before enabling sync.',
    noAccountsToExport: 'No accounts to export',
    copied: 'Copied!',
    addAccount: 'Add Account',
    editAccount: 'Edit Account',
    noAccountsYet: 'No accounts yet',
    emptySub: 'Add your first account using the\n+ button below.',
    vaultLocked: 'Vault Locked',
    vaultLockSub: 'This popup uses local encrypted storage. Enter your passphrase to unlock this browser session.',
    unlockVault: 'Unlock Vault',
    searchPlaceholder: 'Search accounts...',
    syncEnabledHint: 'Accounts are stored locally by default. When auto upload is on, local changes upload by interval to the session ID below.',
    syncEnableText: 'Enable Firefox Sync upload',
    syncSessionLabel: 'Sync Session ID',
    syncSessionHint: 'Each session ID is isolated. Use a different ID for each sync group.',
    syncIntervalLabel: 'Auto Upload Interval (minutes)',
    syncIntervalHint: 'When auto upload is enabled, local changes upload no more often than this interval.',
    syncSaveBtn: 'Save Sync Settings',
    syncUploadBtn: 'Upload Local Data Now',
    syncDownloadBtn: 'Download Cloud Data to Local',
    syncWarnOverwrite: 'Downloading from the cloud will overwrite your current local accounts. A confirmation dialog will appear first.',
    addDrawerTitle: 'Add Account',
    tabManual: 'Manual',
    tabQr: 'Scan QR',
    tabUri: 'URI',
    labelIssuer: 'Issuer / Service',
    labelAccount: 'Account / Email',
    labelSecret: 'Secret Key (Base32)',
    labelAutofillPatterns: 'Autofill Patterns',
    hintAutofillPatterns: 'Comma-separated. Supports * wildcard matching.',
    hintAutofillExample: 'Example: github.com, *.github.com',
    autofillMatchLabel: 'Matching',
    noAutofillRules: 'No autofill rules set',
    hintManualEntry: 'Found under "Manual entry" in the service\'s 2FA setup.',
    labelType: 'Type',
    labelDigits: 'Digits',
    labelPeriod: 'Period',
    qrTabTitle: 'Scan a QR Code',
    qrTabSub: 'A new tab will open where you can drop or pick your QR image. The account will be added automatically when scanned.',
    openQrTab: 'Open QR Scanner Tab',
    labelUri: 'otpauth:// URI',
    hintUri: 'Paste from your QR reader or another authenticator\'s export.',
    saveAccountBtn: 'Add Account',
    exportDrawerTitle: 'Export Accounts',
    exportHint: 'Keep these safe — they contain your secrets.',
    copyExportBtn: 'Copy to Clipboard',
    exportJsonBtn: 'Download JSON File',
    exportUriLabel: 'otpauth:// URIs',
    importDrawerTitle: 'Import Accounts',
    importInputLabel: 'Paste otpauth:// URIs (one per line) or JSON',
    importFileHint: 'Also supports JSON format exported by this extension.',
    importFileBtn: 'Import from JSON File',
    importBtn: 'Import',
    editDrawerTitle: 'Edit Account',
    editSaveBtn: 'Save Changes',
    deleteConfirm: 'Delete this account?',
    editBtnTitle: 'Edit',
    saveEditSuccess: 'Account updated',
    syncDrawerTitle: 'Sync & Security',
    vaultEnableText: 'Enable local encryption',
    vaultEnableHint: 'When enabled, local accounts are encrypted at rest. Unlock is required once per browser session.',
    labelVaultPassphrase: 'Vault Passphrase',
    applyVaultBtn: 'Apply Security Setting',
    lockVaultBtn: 'Lock Vault Now',
    vaultLockedPill: 'Locked',
    themeToggleTitle: 'Toggle light/dark theme',
    themeLight: 'Light mode',
    themeDark: 'Dark mode',
    vaultLockedActionBlocked: 'Unlock Vault to use this feature.',
    debugEnableText: 'Enable debug mode',
    debugHint: 'When enabled, info logs are stored locally and can be downloaded as a .txt file.',
    debugDownloadBtn: 'Download Debug Log',
    debugUnlockedToast: 'Debug switch unlocked',
    debugModeOn: 'Debug mode enabled',
    debugModeOff: 'Debug mode disabled',
    debugLogEmpty: 'No debug log available.',
    importNothing: 'Nothing to import.',
    importDuplicateConfirm: 'Detected {count} imported item(s) with similar names. Import all parsed accounts anyway?',
    importSummary: 'Imported {ok} account(s){failPart}{dupPart}',
    importFailPart: ', failed {count}',
    importDupPart: ', duplicates warned {count}',
    importedFromFile: 'Loaded import data from {filename}',
    exportJsonEmpty: 'No accounts available to export.',
    exportJsonFilename: 'vault2fa-accounts-{timestamp}.json',
    nextCodeTitle: 'Next code',
    deleteBtnTitle: 'Delete',
    clickToCopy: 'click to copy',
    unknown: 'Unknown',
    noLabel: '(no label)',
  },
  zh: {
    localOnly: '仅本地',
    syncOn: '同步已开 · ',
    storageModeLabel: '存储模式：',
    storageModeSync: '本地 + Firefox 同步上传',
    storageModeLocal: '仅本地',
    lastUpload: '上次上传：',
    lastDownload: '上次从云端覆盖本地：',
    uploadSuccess: '已上传本地数据',
    syncSaved: '同步设置已保存',
    syncDisabled: '已关闭自动上传',
    needSession: '请先输入同步会话 ID。',
    needSessionEnable: '启用自动上传前请先输入同步会话 ID。',
    noAccountsToExport: '没有可导出的账号',
    copied: '已复制！',
    addAccount: '添加账号',
    editAccount: '编辑账号',
    noAccountsYet: '还没有账号',
    emptySub: '点击下方 + 按钮\n添加第一个账号。',
    vaultLocked: '保险库已锁定',
    vaultLockSub: '此弹窗使用本地加密存储。请输入口令以解锁当前浏览器会话。',
    unlockVault: '解锁保险库',
    searchPlaceholder: '搜索账号...',
    syncEnabledHint: '默认仅本地保存。开启自动上传后，本地改动会按设定间隔上传到下方会话 ID。',
    syncEnableText: '启用 Firefox 同步上传',
    syncSessionLabel: '同步会话 ID',
    syncSessionHint: '每个会话 ID 相互隔离。不同同步组请使用不同 ID。',
    syncIntervalLabel: '自动上传间隔（分钟）',
    syncIntervalHint: '开启自动上传后，本地更改最短按该间隔上传一次。',
    syncSaveBtn: '保存同步设置',
    syncUploadBtn: '立即上传本地数据',
    syncDownloadBtn: '下载云端数据到本地',
    syncWarnOverwrite: '从云端下载会覆盖当前本地账号，操作前会弹出确认。',
    addDrawerTitle: '添加账号',
    tabManual: '手动录入',
    tabQr: '扫描二维码',
    tabUri: 'URI',
    labelIssuer: '发行方 / 服务',
    labelAccount: '账号 / 邮箱',
    labelSecret: '密钥（Base32）',
    labelAutofillPatterns: '自动填充域名规则',
    hintAutofillPatterns: '使用英文逗号分隔，支持 * 通配符模糊匹配。',
    hintAutofillExample: '示例：github.com, *.github.com',
    autofillMatchLabel: '自动填充',
    noAutofillRules: '未设置自动填充规则',
    hintManualEntry: '可在服务 2FA 设置中的“手动输入”处找到。',
    labelType: '类型',
    labelDigits: '位数',
    labelPeriod: '周期',
    qrTabTitle: '扫描二维码',
    qrTabSub: '将打开新标签页，你可以拖放或选择二维码图片。扫描成功后账号会自动添加。',
    openQrTab: '打开二维码扫描页',
    labelUri: 'otpauth:// URI',
    hintUri: '从二维码识别工具或其他验证器导出中粘贴。',
    saveAccountBtn: '添加账号',
    exportDrawerTitle: '导出账号',
    exportHint: '请妥善保存——其中包含你的密钥。',
    copyExportBtn: '复制到剪贴板',
    exportJsonBtn: '下载 JSON 文件',
    exportUriLabel: 'otpauth:// URI',
    importDrawerTitle: '导入账号',
    importInputLabel: '粘贴 otpauth:// URI（每行一个）或 JSON',
    importFileHint: '也支持本扩展导出的 JSON 格式。',
    importFileBtn: '从 JSON 文件导入',
    importBtn: '导入',
    editDrawerTitle: '编辑账号',
    editSaveBtn: '保存修改',
    deleteConfirm: '确认删除该账号吗？',
    editBtnTitle: '修改',
    saveEditSuccess: '账号信息已更新',
    syncDrawerTitle: '同步与安全',
    vaultEnableText: '启用本地加密',
    vaultEnableHint: '启用后，本地账号将以加密形式存储。每个浏览器会话需解锁一次。',
    labelVaultPassphrase: '保险库口令',
    applyVaultBtn: '应用安全设置',
    lockVaultBtn: '立即锁定保险库',
    vaultLockedPill: '已锁定',
    themeToggleTitle: '切换深浅色主题',
    themeLight: '浅色模式',
    themeDark: '深色模式',
    vaultLockedActionBlocked: '请先解锁保险库再使用该功能。',
    debugEnableText: '启用调试模式',
    debugHint: '启用后会在本地记录 info 日志，并可下载为 .txt 文件。',
    debugDownloadBtn: '下载调试日志',
    debugUnlockedToast: '已解锁调试开关',
    debugModeOn: '已启用调试模式',
    debugModeOff: '已关闭调试模式',
    debugLogEmpty: '暂无可下载的调试日志。',
    importNothing: '没有可导入的内容。',
    importDuplicateConfirm: '检测到 {count} 个导入项存在相似名称。仍要导入全部已解析账号吗？',
    importSummary: '已导入 {ok} 个账号{failPart}{dupPart}',
    importFailPart: '，失败 {count} 个',
    importDupPart: '，重复提醒 {count} 个',
    importedFromFile: '已从 {filename} 加载导入数据',
    exportJsonEmpty: '没有可导出的账号。',
    exportJsonFilename: 'vault2fa-账号-{timestamp}.json',
    nextCodeTitle: '下一个验证码',
    deleteBtnTitle: '删除',
    clickToCopy: '点击复制',
    unknown: '未知',
    noLabel: '（无名称）',
  },
};

const STATIC_TEXT_MAP = {
  lockTitle: 'vaultLocked', lockSub: 'vaultLockSub', btnUnlock: 'unlockVault',
  emptyTitle: 'noAccountsYet', addDrawerTitle: 'addDrawerTitle', tabManualBtn: 'tabManual', tabQrBtn: 'tabQr', tabUriBtn: 'tabUri',
  labelIssuer: 'labelIssuer', labelAccount: 'labelAccount', labelSecret: 'labelSecret', labelAutofillPatterns: 'labelAutofillPatterns', editLabelAutofillPatterns: 'labelAutofillPatterns', hintManualEntry: 'hintManualEntry',
  hintAutofillPatterns: 'hintAutofillPatterns', editHintAutofillPatterns: 'hintAutofillPatterns',
  labelType: 'labelType', labelDigits: 'labelDigits', labelPeriod: 'labelPeriod', qrTabTitle: 'qrTabTitle', qrTabSub: 'qrTabSub',
  btnOpenQrTab: 'openQrTab', labelUri: 'labelUri', hintUri: 'hintUri', btnSave: 'saveAccountBtn', exportDrawerTitle: 'exportDrawerTitle',
  exportHint: 'exportHint', btnCopyExport: 'copyExportBtn', btnDownloadExportJson: 'exportJsonBtn', exportUriLabel: 'exportUriLabel', importDrawerTitle: 'importDrawerTitle', importInputLabel: 'importInputLabel', importFileHint: 'importFileHint', btnImportFile: 'importFileBtn', btnDoImport: 'importBtn',
  editDrawerTitle: 'editDrawerTitle', editLabelIssuer: 'labelIssuer', editLabelAccount: 'labelAccount', btnSaveEdit: 'editSaveBtn',
  syncDrawerTitle: 'syncDrawerTitle', syncEnableText: 'syncEnableText', syncEnabledHint: 'syncEnabledHint', labelSyncSession: 'syncSessionLabel', syncSessionHint: 'syncSessionHint',
  labelSyncInterval: 'syncIntervalLabel', syncIntervalHint: 'syncIntervalHint', btnSaveSync: 'syncSaveBtn', btnUploadSync: 'syncUploadBtn',
  btnDownloadSync: 'syncDownloadBtn', syncWarnOverwrite: 'syncWarnOverwrite', vaultEnableText: 'vaultEnableText',
  vaultEnableHint: 'vaultEnableHint', labelVaultPassphrase: 'labelVaultPassphrase', btnApplyVault: 'applyVaultBtn', btnLockVault: 'lockVaultBtn',
  vaultLockedPill: 'vaultLockedPill', btnAdd: 'addAccount', debugEnableText: 'debugEnableText',
  debugHint: 'debugHint', btnDownloadDebug: 'debugDownloadBtn'
};

const PAL = ['#58a6ff','#3fb950','#d29922','#f78166','#bc8cff','#39c5cf','#ff7b72','#79c0ff'];
function pal(s){ let h=0; for(const c of s) h=(h*31+c.charCodeAt(0))>>>0; return PAL[h%PAL.length]; }
function byId(id){ return document.getElementById(id); }
function fmt(code, d){ return d===8 ? code.slice(0,4)+' '+code.slice(4) : code.slice(0,3)+' '+code.slice(3); }
function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function sid(acc){ return 'ac' + String(acc.id).replace(/\W/g,''); }
function t(key){ return (I18N[uiLanguage] && I18N[uiLanguage][key]) || I18N.en[key] || key; }
function tFmt(key, values = {}){
  return String(t(key)).replace(/\{(\w+)\}/g, (_, name) => values[name] == null ? '' : String(values[name]));
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
    if(id === 'btnAdd'){
      el.textContent = '＋ ' + t(key);
      continue;
    }
    el.textContent = t(key);
  }
  byId('btnImport').title = uiLanguage === 'zh' ? '导入账号' : 'Import accounts';
  byId('btnExport').title = uiLanguage === 'zh' ? '导出账号' : 'Export accounts';
  byId('btnSync').title = uiLanguage === 'zh' ? '同步与安全' : 'Sync and security';
  byId('btnLang').title = uiLanguage === 'zh' ? '切换语言' : 'Switch language';
  byId('btnTheme').title = t('themeToggleTitle');
  byId('search').placeholder = t('searchPlaceholder');
  byId('unlockPassphrase').placeholder = uiLanguage === 'zh' ? '口令' : 'Passphrase';
  byId('vaultPassphrase').placeholder = uiLanguage === 'zh' ? '至少 6 个字符' : 'At least 6 characters';
  setMultilineText(byId('emptySub'), t('emptySub'));
}
function setLanguage(next){
  uiLanguage = next === 'zh' ? 'zh' : 'en';
  document.documentElement.lang = uiLanguage === 'zh' ? 'zh-CN' : 'en';
  byId('btnLang').textContent = uiLanguage === 'zh' ? '中/EN' : 'EN/中';
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

function compareAccountOrder(a, b){
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

async function sendMessage(payload){
  const resp = await browser.runtime.sendMessage(payload);
  if(!resp || resp.success === false){
    const err = new Error((resp && resp.error) || 'Request failed.');
    err.code = resp && resp.code;
    throw err;
  }
  return resp;
}

function getToken(acc){
  const period = acc.period || 30;
  try {
    if(acc.type === 'hotp'){
      const otp = new OTPAuth.HOTP({
        algorithm: acc.algorithm || 'SHA1',
        digits: acc.digits || 6,
        counter: acc.counter || 0,
        secret: OTPAuth.Secret.fromBase32(acc.secret.toUpperCase().replace(/\s+/g,'')),
      });
      const code = OTPAuth.HOTP.generate({
        secret: otp.secret, algorithm: otp.algorithm, digits: otp.digits, counter: acc.counter || 0,
      });
      return { code, remaining: null, period: null };
    }
    const otp = new OTPAuth.TOTP({
      algorithm: acc.algorithm || 'SHA1',
      digits: acc.digits || 6,
      period,
      secret: OTPAuth.Secret.fromBase32(acc.secret.toUpperCase().replace(/\s+/g,'')),
    });
    const code = otp.generate();
    const remaining = Math.max(0, Math.ceil(period - ((Date.now() / 1000) % period)) % period || period);
    return { code, remaining, period };
  } catch(e) {
    return { code:'------', remaining: acc.type!=='hotp' ? (acc.period||30) : null, period: acc.type!=='hotp' ? (acc.period||30) : null };
  }
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
  globalTick = setInterval(updateVisibleCodes, 1000);
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

function updateVisibleCodes(){
  for(const acc of visibleAccounts){
    if(acc.type === 'hotp') continue;
    const id = sid(acc);
    const codeEl = byId('code-' + id);
    if(!codeEl) continue;
    const ringEl = byId('rfg-' + id);
    const textEl = byId('rtxt-' + id);
    const { code, remaining, period } = getToken(acc);
    const level = remaining <= 5 ? 'urgent' : remaining <= 10 ? 'warn' : '';
    const pretty = fmt(code, acc.digits || 6);
    if(codeEl.textContent !== pretty) codeEl.textContent = pretty;
    setNodeState(codeEl, 'otp-code', level);
    if(textEl) textEl.textContent = String(remaining);
    if(ringEl){
      ringEl.style.strokeDashoffset = (2 * Math.PI * 13 * (1 - remaining / period)).toFixed(2);
      setNodeState(ringEl, 'ring-fg', level);
    }
  }
}

function buildCard(acc){
  const { code, remaining, period } = getToken(acc);
  const color = pal(acc.issuer || '');
  const level =
    remaining !== null && remaining <= 5 ? 'urgent' :
    remaining !== null && remaining <= 10 ? 'warn' : '';

  const da = 2 * Math.PI * 13;
  const doff = remaining !== null ? (da * (1 - remaining / period)).toFixed(2) : '0';
  const id = sid(acc);

  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = String(acc.id);

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

  if (acc.type !== 'hotp') {
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
    num.textContent = String(remaining);

    wrap.appendChild(svg);
    wrap.appendChild(num);
    otp.appendChild(wrap);
  }

  card.appendChild(top);
  card.appendChild(otp);

  return card;
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
  updateVisibleCodes();
}

function toast(msg){
  const t = byId('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._tmr);
  toast._tmr = setTimeout(() => t.classList.remove('show'), 1800);
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

function getExportRecords(){
  return accounts.map(acc => normalizeAccountRecord({
    id: acc.id,
    type: acc.type === 'hotp' ? 'hotp' : 'totp',
    issuer: acc.issuer || '',
    label: acc.label || '',
    secret: String(acc.secret || '').toUpperCase().replace(/\s+/g, ''),
    algorithm: acc.algorithm || 'SHA1',
    digits: acc.digits || 6,
    period: acc.type === 'hotp' ? undefined : (acc.period || 30),
    counter: acc.type === 'hotp' ? (acc.counter || 0) : undefined,
    autofillPatterns: Array.isArray(acc.autofillPatterns) ? acc.autofillPatterns : [],
  }));
}

function buildJsonExportPayload(){
  return {
    format: 'vault2fa-accounts',
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts: getExportRecords(),
  };
}

function buildImportSummaryText(parsedCount, failCount, duplicateCount){
  const failPart = failCount ? tFmt('importFailPart', { count: failCount }) : '';
  const dupPart = duplicateCount ? tFmt('importDupPart', { count: duplicateCount }) : '';
  return tFmt('importSummary', { ok: parsedCount, failPart, dupPart });
}

function parseJsonImportData(raw){
  const parsed = JSON.parse(raw);
  const source = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.accounts) ? parsed.accounts : null);
  if(!source) throw new Error(uiLanguage === 'zh' ? 'JSON 格式不正确，缺少 accounts 数组。' : 'Invalid JSON format: missing accounts array.');
  const list = [];
  for(const item of source){
    const secret = String(item && item.secret || '').toUpperCase().replace(/\s+/g, '');
    const label = String(item && item.label || '').trim();
    if(!secret || !label) throw new Error(uiLanguage === 'zh' ? 'JSON 中存在缺少密钥或账号名称的条目。' : 'JSON contains item(s) without secret or account label.');
    OTPAuth.Secret.fromBase32(secret);
    const type = item && item.type === 'hotp' ? 'hotp' : 'totp';
    list.push(normalizeAccountRecord({
      id: nextAccountId(),
      type,
      issuer: String(item.issuer || label).trim() || label,
      label,
      secret,
      algorithm: String(item.algorithm || 'SHA1').toUpperCase(),
      digits: Math.max(6, Number(item.digits) || 6),
      period: type === 'hotp' ? undefined : Math.max(1, Number(item.period) || 30),
      counter: type === 'hotp' ? Math.max(0, Number(item.counter) || 0) : undefined,
      autofillPatterns: Array.isArray(item.autofillPatterns) ? item.autofillPatterns : [],
    }));
  }
  return list;
}

function parseUriImportData(raw){
  const lines = String(raw || '').split('\n').map(s => s.trim()).filter(Boolean);
  const parsed = [];
  let fail = 0;
  for(const uri of lines){
    try { parsed.push(fromParsed(OTPAuth.URI.parse(uri))); } catch(e){ fail++; }
  }
  return { parsed, fail };
}

function parseImportData(raw){
  const input = String(raw || '').trim();
  if(!input) return { parsed: [], fail: 0 };
  if(input.startsWith('{') || input.startsWith('[')){
    return { parsed: parseJsonImportData(input), fail: 0 };
  }
  return parseUriImportData(input);
}

async function saveAccounts(){
  const resp = await sendMessage({ action:'saveAccounts', accounts });
  updateSyncBadgeFromResponse(resp);
}

async function persistAndRender(){
  await saveAccounts();
  render();
}

function fromParsed(p){
  return {
    id: nextAccountId(),
    type: p instanceof OTPAuth.TOTP ? 'totp' : 'hotp',
    issuer: p.issuer,
    label: p.label,
    secret: p.secret.base32,
    algorithm: p.algorithm || 'SHA1',
    digits: p.digits,
    period: p instanceof OTPAuth.TOTP ? p.period : undefined,
    counter: p instanceof OTPAuth.HOTP ? p.counter : undefined,
    autofillPatterns: [],
  };
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
  hint.textContent = uiLanguage === 'zh'
    ? `警告：发现 ${matches.length} 个相似账号名称。添加前会要求确认。`
    : `Warning: found ${matches.length} similar account name${matches.length > 1 ? 's' : ''}. You will be asked to confirm before adding.`;
  hint.style.display = 'block';
}

async function loadAccounts(){
  const resp = await sendMessage({ action:'getAccounts' });
  return (resp.accounts || []).map(normalizeAccountRecord);
}

function fmtTs(ts){ return ts ? new Date(ts).toLocaleString() : (uiLanguage === 'zh' ? '从未' : 'Never'); }

function updateSyncUi(){
  byId('syncEnabled').checked = !!syncSettings.enabled;
  byId('syncSessionId').value = syncSettings.sessionId || '';
  byId('syncInterval').value = syncSettings.intervalMinutes || 5;
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
    (uiLanguage === 'zh' ? '本地加密：' : 'Local encryption: ') + (vaultStatus.encryptionEnabled ? (uiLanguage === 'zh' ? '已启用' : 'Enabled') : (uiLanguage === 'zh' ? '已禁用' : 'Disabled')),
    (uiLanguage === 'zh' ? '保险库状态：' : 'Vault state: ') + (vaultStatus.encryptionEnabled ? (vaultStatus.unlocked ? (uiLanguage === 'zh' ? '已解锁' : 'Unlocked') : (uiLanguage === 'zh' ? '已锁定' : 'Locked')) : (uiLanguage === 'zh' ? '无需解锁' : 'Not required')),
    (uiLanguage === 'zh' ? '上次解锁：' : 'Last unlock: ') + fmtTs(vaultStatus.lastUnlockedAt),
  ].join('\n');
  byId('vaultLockedPill').style.display = vaultStatus.encryptionEnabled && !vaultStatus.unlocked ? 'inline-flex' : 'none';
  byId('lockScreen').style.display = vaultStatus.encryptionEnabled && !vaultStatus.unlocked ? 'flex' : 'none';

  const locked = isVaultLocked();
  const gatedIds = ['btnAdd','btnImport','btnExport','btnSync'];
  for(const id of gatedIds){
    const el = byId(id);
    if(!el) continue;
    el.disabled = locked;
    el.classList.toggle('is-disabled', locked);
    el.setAttribute('aria-disabled', locked ? 'true' : 'false');
  }
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
    toast(uiLanguage === 'zh' ? '保险库已解锁' : 'Vault unlocked');
  } catch(err){
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
}

async function boot(){
  const prefs = await browser.storage.local.get(['uiLanguage','uiTheme']);
  uiTheme = prefs.uiTheme || 'auto';
  setLanguage(prefs.uiLanguage || 'en');
  applyTheme();
  
  await refreshVaultStatus();
  await loadSyncSettings();
  await loadDebugState();
  if(vaultStatus.encryptionEnabled && !vaultStatus.unlocked){
    accounts = [];
    render();
    return;
  }
  accounts = await loadAccounts();
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

byId('btnAdd').addEventListener('click', () => {
  if(!guardVaultUnlocked()) return;
  openD('drawAdd');
});
byId('hdrLogo').addEventListener('click', handleDebugLogoTap);
byId('btnTheme').addEventListener('click', () => setTheme((document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark'));
byId('btnLang').addEventListener('click', () => setLanguage(uiLanguage === 'zh' ? 'en' : 'zh'));
byId('closeAdd').addEventListener('click', () => { closeD('drawAdd'); resetForm(); });
byId('drawAdd').addEventListener('click', function(e){ if(e.target===this){ closeD('drawAdd'); resetForm(); } });
byId('btnSync').addEventListener('click', () => {
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
  browser.tabs.create({ url: browser.runtime.getURL('qr.html') });
setQrStatus(uiLanguage === 'zh' ? '二维码扫描页已打开，请在新页扫描。此弹窗会自动更新。' : 'QR scanner tab opened — scan your code there. This popup will update automatically.', false);
  if(resetForm.qrPollInterval) clearInterval(resetForm.qrPollInterval);
  resetForm.qrPollInterval = setInterval(async () => {
    const result = await browser.storage.local.get('pendingQrAccount');
    if(!result.pendingQrAccount) return;
    clearInterval(resetForm.qrPollInterval);
    resetForm.qrPollInterval = null;
    await browser.storage.local.remove('pendingQrAccount');
    const added = await pushAccount(result.pendingQrAccount);
    if(added){ closeD('drawAdd'); resetForm(); toast(uiLanguage === 'zh' ? '已添加二维码账号！' : 'QR account added!'); }
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
      if(!uri) throw new Error(uiLanguage === 'zh' ? '请输入 otpauth:// URI。' : 'Please enter an otpauth:// URI.');
      acc = fromParsed(OTPAuth.URI.parse(uri));
    } else if(activeTab === 'qr'){
      throw new Error(uiLanguage === 'zh' ? '请使用上方“打开二维码扫描页”按钮。' : 'Use the "Open QR Scanner Tab" button above.');
    } else {
      const secret = byId('fSecret').value.trim();
      const label = byId('fLabel').value.trim();
      if(!secret) throw new Error(uiLanguage === 'zh' ? '密钥不能为空。' : 'Secret key is required.');
      if(!label) throw new Error(uiLanguage === 'zh' ? '账号名称不能为空。' : 'Account name is required.');
      OTPAuth.Secret.fromBase32(secret.toUpperCase().replace(/\s+/g,''));
      acc = {
        id: nextAccountId(),
        type: byId('fType').value,
        issuer: byId('fIssuer').value.trim() || label,
        label,
        secret: secret.toUpperCase().replace(/\s+/g,''),
        algorithm: 'SHA1',
        digits: parseInt(byId('fDigits').value, 10),
        period: parseInt(byId('fPeriod').value, 10),
        counter: 0,
        autofillPatterns: parseAutofillPatterns(byId('fAutofillPatterns').value),
      };
    }
    const added = await pushAccount(acc);
    if(added){ closeD('drawAdd'); resetForm(); toast(uiLanguage === 'zh' ? '账号已添加！' : 'Account added!'); }
  } catch(e){ errEl.textContent = e.message; errEl.style.display = 'block'; }
});

byId('btnExport').addEventListener('click', () => {
  if(!guardVaultUnlocked()) return;
  if(!accounts.length){ toast(t('noAccountsToExport')); return; }
  const lines = accounts.map(acc => {
    try {
      const s = OTPAuth.Secret.fromBase32(acc.secret);
      const o = acc.type === 'hotp'
        ? new OTPAuth.HOTP({ issuer:acc.issuer, label:acc.label, secret:s, algorithm:acc.algorithm||'SHA1', digits:acc.digits, counter:acc.counter||0 })
        : new OTPAuth.TOTP({ issuer:acc.issuer, label:acc.label, secret:s, algorithm:acc.algorithm||'SHA1', digits:acc.digits, period:acc.period });
      return OTPAuth.URI.stringify(o);
    } catch(e){ return null; }
  }).filter(Boolean);
  byId('exportData').value = lines.join('\n');
  openD('drawExport');
});
byId('btnCopyExport').addEventListener('click', () => {
  if(!guardVaultUnlocked()) return;
  navigator.clipboard.writeText(byId('exportData').value).then(() => toast(t('copied')));
});
byId('btnDownloadExportJson').addEventListener('click', () => {
  if(!guardVaultUnlocked()) return;
  if(!accounts.length){ toast(t('exportJsonEmpty')); return; }
  const payload = buildJsonExportPayload();
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
});

async function applyImportRawText(rawText){
  const errEl = byId('importErr');
  errEl.style.display = 'none';
  try {
    const { parsed, fail } = parseImportData(rawText);
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
    closeD('drawImport');
    byId('importData').value = '';
    toast(buildImportSummaryText(parsed.length, fail, duplicateCount));
  } catch(err){
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
}

byId('btnImportFile').addEventListener('click', () => {
  if(!guardVaultUnlocked()) return;
  byId('importFileInput').click();
});

byId('importFileInput').addEventListener('change', async (event) => {
  if(!guardVaultUnlocked()) return;
  const file = event.target.files && event.target.files[0];
  if(!file) return;
  try {
    const text = await file.text();
    byId('importData').value = text;
    toast(tFmt('importedFromFile', { filename: file.name }));
  } catch(err){
    const errEl = byId('importErr');
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    event.target.value = '';
  }
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
    return;
  }
  const codeEl = e.target.closest('.otp-code');
  if(codeEl){
    const card = codeEl.closest('.card');
    const acc = accounts.find(a => String(a.id) === card.dataset.id);
    if(acc) navigator.clipboard.writeText(getToken(acc).code).then(() => toast(t('copied')));
  }
});

byId('btnSaveEdit').addEventListener('click', async () => {
  if(!guardVaultUnlocked()) return;
  const errEl = byId('editErr');
  errEl.style.display = 'none';
  try {
    if(!editingAccountId) throw new Error(uiLanguage === 'zh' ? '未找到要编辑的账号。' : 'No account selected for editing.');
    const label = byId('editLabel').value.trim();
    const issuer = byId('editIssuer').value.trim() || label;
    if(!label) throw new Error(uiLanguage === 'zh' ? '账号名称不能为空。' : 'Account name is required.');
    const idx = accounts.findIndex(a => String(a.id) === String(editingAccountId));
    if(idx < 0) throw new Error(uiLanguage === 'zh' ? '账号不存在或已被删除。' : 'Account no longer exists.');
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
  if(enabled && !sessionId){ errEl.textContent = t('needSessionEnable'); errEl.style.display = 'block'; return; }
  try {
    const resp = await sendMessage({ action:'saveSyncSettings', settings:{ enabled, sessionId, intervalMinutes } });
    syncSettings = resp.settings || syncSettings;
    updateSyncUi();
    updateSyncBadgeFromResponse(resp);
    toast(enabled ? t('syncSaved') : t('syncDisabled'));
  } catch(err){ errEl.textContent = err.message; errEl.style.display = 'block'; }
});

byId('btnUploadSync').addEventListener('click', async () => {
  if(!guardVaultUnlocked()) return;
  const errEl = byId('syncErr'); errEl.style.display = 'none';
  try {
    const sessionId = byId('syncSessionId').value.trim();
    if(!sessionId){ errEl.textContent = t('needSession'); errEl.style.display = 'block'; return; }
    const resp = await sendMessage({ action:'uploadSyncNow', sessionId });
    syncSettings.lastUploadedAt = resp.upload && resp.upload.updatedAt ? resp.upload.updatedAt : Date.now();
    updateSyncUi(); updateSyncBadgeFromResponse(resp); toast(t('uploadSuccess'));
  } catch(err){ errEl.textContent = err.message; errEl.style.display = 'block'; }
});

byId('btnDownloadSync').addEventListener('click', async () => {
  if(!guardVaultUnlocked()) return;
  const errEl = byId('syncErr'); errEl.style.display = 'none';
  const sessionId = byId('syncSessionId').value.trim();
  if(!sessionId){ errEl.textContent = t('needSession'); errEl.style.display = 'block'; return; }
  if(!window.confirm(uiLanguage === 'zh' ? '云端数据将覆盖当前本地账号，是否继续？' : 'Cloud data will overwrite your current local accounts. Continue?')) return;
  try {
    const resp = await sendMessage({ action:'downloadSyncToLocal', sessionId });
    accounts = Array.isArray(resp.accounts) ? resp.accounts : [];
    syncSettings.lastDownloadedAt = Date.now();
    render(); updateSyncUi(); toast(uiLanguage === 'zh' ? '已下载云端数据' : 'Downloaded cloud data');
  } catch(err){ errEl.textContent = err.message; errEl.style.display = 'block'; }
});

byId('btnApplyVault').addEventListener('click', async () => {
  const errEl = byId('vaultErr'); errEl.style.display = 'none';
  const wantEncrypt = byId('vaultEncryptionEnabled').checked;
  const passphrase = byId('vaultPassphrase').value;
  try {
    if(wantEncrypt && !vaultStatus.encryptionEnabled){
      await sendMessage({ action:'enableEncryption', passphrase });
      toast(uiLanguage === 'zh' ? '已启用本地加密' : 'Local encryption enabled');
    } else if(!wantEncrypt && vaultStatus.encryptionEnabled){
      if(!window.confirm(uiLanguage === 'zh' ? '确认关闭本地加密并以明文存储本地数据？' : 'Disable local encryption and store data locally without encryption?')) return;
      await sendMessage({ action:'disableEncryption', passphrase });
      toast(uiLanguage === 'zh' ? '已关闭本地加密' : 'Local encryption disabled');
    } else if(wantEncrypt && vaultStatus.encryptionEnabled && !vaultStatus.unlocked){
      await sendMessage({ action:'unlockVault', passphrase });
      toast(uiLanguage === 'zh' ? '保险库已解锁' : 'Vault unlocked');
    } else {
      toast(uiLanguage === 'zh' ? '无需安全设置变更' : 'No security change needed');
    }
    await refreshVaultStatus();
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
    toast(uiLanguage === 'zh' ? '保险库已锁定' : 'Vault locked');
  } catch(err){ errEl.textContent = err.message; errEl.style.display = 'block'; }
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
  toast(uiLanguage === 'zh' ? '弹窗加载失败' : 'Failed to load popup');
});
