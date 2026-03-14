'use strict';

const OTPAuth = window.OTPAuth;

let accounts = [];
let visibleAccounts = [];
let activeTab = 'manual';
let globalTick = null;
let syncSettings = { enabled:false, sessionId:'', intervalMinutes:5, lastUploadedAt:null, lastDownloadedAt:null };
let vaultStatus = { encryptionEnabled:false, unlocked:true, lastUnlockedAt:null };
let uiLanguage = 'en';
let uiTheme = 'auto';

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
    importDrawerTitle: 'Import Accounts',
    importBtn: 'Import',
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
    importDrawerTitle: '导入账号',
    importBtn: '导入',
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
  },
};

const STATIC_TEXT_MAP = {
  lockTitle: 'vaultLocked', lockSub: 'vaultLockSub', btnUnlock: 'unlockVault',
  emptyTitle: 'noAccountsYet', addDrawerTitle: 'addDrawerTitle', tabManualBtn: 'tabManual', tabQrBtn: 'tabQr', tabUriBtn: 'tabUri',
  labelIssuer: 'labelIssuer', labelAccount: 'labelAccount', labelSecret: 'labelSecret', hintManualEntry: 'hintManualEntry',
  labelType: 'labelType', labelDigits: 'labelDigits', labelPeriod: 'labelPeriod', qrTabTitle: 'qrTabTitle', qrTabSub: 'qrTabSub',
  btnOpenQrTab: 'openQrTab', labelUri: 'labelUri', hintUri: 'hintUri', btnSave: 'saveAccountBtn', exportDrawerTitle: 'exportDrawerTitle',
  exportHint: 'exportHint', btnCopyExport: 'copyExportBtn', importDrawerTitle: 'importDrawerTitle', btnDoImport: 'importBtn',
  syncDrawerTitle: 'syncDrawerTitle', syncEnableText: 'syncEnableText', syncEnabledHint: 'syncEnabledHint', labelSyncSession: 'syncSessionLabel', syncSessionHint: 'syncSessionHint',
  labelSyncInterval: 'syncIntervalLabel', syncIntervalHint: 'syncIntervalHint', btnSaveSync: 'syncSaveBtn', btnUploadSync: 'syncUploadBtn',
  btnDownloadSync: 'syncDownloadBtn', syncWarnOverwrite: 'syncWarnOverwrite', vaultEnableText: 'vaultEnableText',
  vaultEnableHint: 'vaultEnableHint', labelVaultPassphrase: 'labelVaultPassphrase', btnApplyVault: 'applyVaultBtn', btnLockVault: 'lockVaultBtn',
  vaultLockedPill: 'vaultLockedPill', btnAdd: 'addAccount'
};

const PAL = ['#58a6ff','#3fb950','#d29922','#f78166','#bc8cff','#39c5cf','#ff7b72','#79c0ff'];
function pal(s){ let h=0; for(const c of s) h=(h*31+c.charCodeAt(0))>>>0; return PAL[h%PAL.length]; }
function byId(id){ return document.getElementById(id); }
function fmt(code, d){ return d===8 ? code.slice(0,4)+' '+code.slice(4) : code.slice(0,3)+' '+code.slice(3); }
function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function sid(acc){ return 'ac' + String(acc.id).replace(/\W/g,''); }
function t(key){ return (I18N[uiLanguage] && I18N[uiLanguage][key]) || I18N.en[key] || key; }
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
  const color = pal((acc.issuer || '') + (acc.label || ''));
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

  const acts = document.createElement('div');
  acts.className = 'card-acts';

  if (acc.type === 'hotp') {
    const nextBtn = document.createElement('button');
    nextBtn.className = 'act-btn';
    nextBtn.dataset.a = 'next';
    nextBtn.dataset.id = String(acc.id);
    nextBtn.title = 'Next code';
    nextBtn.type = 'button';
    nextBtn.textContent = '↻';
    acts.appendChild(nextBtn);
  }

  const delBtn = document.createElement('button');
  delBtn.className = 'act-btn del';
  delBtn.dataset.a = 'del';
  delBtn.dataset.id = String(acc.id);
  delBtn.title = 'Delete';
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
  hint.textContent = uiLanguage === 'zh' ? '点击复制' : 'click to copy';

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
  visibleAccounts = accounts.filter(a => (a.issuer||'').toLowerCase().includes(q) || (a.label||'').toLowerCase().includes(q));
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
  const sample = matches.slice(0, 3).map(m => `${m.issuer || 'Unknown'} / ${m.label || '(no label)'}`).join('\n');
  return `Found ${matches.length} account name match${matches.length > 1 ? 'es' : ''} for:\n${acc.issuer || 'Unknown'} / ${acc.label || '(no label)'}\n\n${sample}${matches.length > 3 ? '\n...' : ''}\n\nAdd it anyway?`;
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
  };
}

async function pushAccount(acc, opts = {}){
  const item = Object.assign({}, acc, { id: acc.id || nextAccountId() });
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
  ['fIssuer','fLabel','fSecret','fUri'].forEach(id => { const el = byId(id); if(el) el.value = ''; });
  byId('addErr').style.display = 'none';
  byId('dupHint').style.display = 'none';
  byId('fType').value = 'totp';
  byId('fDigits').value = '6';
  byId('fPeriod').value = '30';
  setQrStatus('', false);
  if(resetForm.qrPollInterval){ clearInterval(resetForm.qrPollInterval); resetForm.qrPollInterval = null; }
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
  return resp.accounts || [];
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

async function loadSyncSettings(){
  const resp = await sendMessage({ action:'getSyncSettings' });
  if(resp.settings) syncSettings = Object.assign({}, syncSettings, resp.settings);
  updateSyncUi();
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
  if(vaultStatus.encryptionEnabled && !vaultStatus.unlocked){
    accounts = [];
    render();
    return;
  }
  accounts = await loadAccounts();
  render();
}

byId('btnAdd').addEventListener('click', () => openD('drawAdd'));
byId('btnTheme').addEventListener('click', () => setTheme((document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark'));
byId('btnLang').addEventListener('click', () => setLanguage(uiLanguage === 'zh' ? 'en' : 'zh'));
byId('closeAdd').addEventListener('click', () => { closeD('drawAdd'); resetForm(); });
byId('drawAdd').addEventListener('click', function(e){ if(e.target===this){ closeD('drawAdd'); resetForm(); } });
byId('btnSync').addEventListener('click', () => openD('drawSync'));
byId('closeSync').addEventListener('click', () => closeD('drawSync'));
byId('drawSync').addEventListener('click', function(e){ if(e.target===this) closeD('drawSync'); });
byId('closeExport').addEventListener('click', () => closeD('drawExport'));
byId('drawExport').addEventListener('click', function(e){ if(e.target===this) closeD('drawExport'); });
byId('btnImport').addEventListener('click', () => openD('drawImport'));
byId('closeImport').addEventListener('click', () => closeD('drawImport'));
byId('drawImport').addEventListener('click', function(e){ if(e.target===this) closeD('drawImport'); });

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
      };
    }
    const added = await pushAccount(acc);
    if(added){ closeD('drawAdd'); resetForm(); toast(uiLanguage === 'zh' ? '账号已添加！' : 'Account added!'); }
  } catch(e){ errEl.textContent = e.message; errEl.style.display = 'block'; }
});

byId('btnExport').addEventListener('click', () => {
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
byId('btnCopyExport').addEventListener('click', () => navigator.clipboard.writeText(byId('exportData').value).then(() => toast(t('copied'))));

byId('btnDoImport').addEventListener('click', async () => {
  const errEl = byId('importErr');
  errEl.style.display = 'none';
  const lines = byId('importData').value.split('\n').map(s => s.trim()).filter(Boolean);
  if(!lines.length){ errEl.textContent = 'Nothing to import.'; errEl.style.display = 'block'; return; }
  const parsed = [];
  let fail = 0;
  for(const uri of lines){
    try { parsed.push(fromParsed(OTPAuth.URI.parse(uri))); } catch(e){ fail++; }
  }
  const duplicateCount = parsed.reduce((n, acc) => n + (findPotentialDuplicates(acc, accounts.concat(parsed)).length ? 1 : 0), 0);
  if(duplicateCount){
    const ok = window.confirm(`Detected ${duplicateCount} imported item(s) with similar names. Import all parsed accounts anyway?`);
    if(!ok) return;
  }
  accounts = accounts.concat(parsed.map(acc => Object.assign({}, acc, { id: acc.id || nextAccountId() })));
  await persistAndRender();
  closeD('drawImport');
  byId('importData').value = '';
  toast(`Imported ${parsed.length} account${parsed.length !== 1 ? 's' : ''}${fail ? `, failed ${fail}` : ''}${duplicateCount ? `, duplicates warned ${duplicateCount}` : ''}`);
});

byId('search').addEventListener('input', render);
byId('fIssuer').addEventListener('input', updateDuplicateHint);
byId('fLabel').addEventListener('input', updateDuplicateHint);

byId('list').addEventListener('click', async e => {
  const actionBtn = e.target.closest('[data-a]');
  if(actionBtn){
    const index = accounts.findIndex(a => String(a.id) === String(actionBtn.dataset.id));
    if(index < 0) return;
    if(actionBtn.dataset.a === 'del'){
      accounts.splice(index, 1);
      await persistAndRender();
    }
    if(actionBtn.dataset.a === 'next'){
      accounts[index].counter = (accounts[index].counter || 0) + 1;
      await persistAndRender();
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

byId('btnSaveSync').addEventListener('click', async () => {
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
    accounts = [];
    render();
    toast(uiLanguage === 'zh' ? '保险库已锁定' : 'Vault locked');
  } catch(err){ errEl.textContent = err.message; errEl.style.display = 'block'; }
});

byId('btnUnlock').addEventListener('click', () => unlockWithInput('unlockPassphrase', 'unlockErr'));
byId('unlockPassphrase').addEventListener('keydown', e => { if(e.key === 'Enter') unlockWithInput('unlockPassphrase', 'unlockErr'); });

boot().catch(err => {
  console.error(err);
  toast(uiLanguage === 'zh' ? '弹窗加载失败' : 'Failed to load popup');
});