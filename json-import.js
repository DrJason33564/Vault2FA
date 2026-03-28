// SPDX-License-Identifier: MIT
'use strict';

const dz = document.getElementById('dz');
const fileInput = document.getElementById('fileInput');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const resultNameEl = document.getElementById('resultName');
const errEl = document.getElementById('err');

const I18N = {
  en: {
    title: 'Vault <em>2FA</em> — JSON Import',
    dzTitle: 'Drop a JSON file here',
    dzSub: 'or click to choose a file',
    waiting: 'Waiting for a JSON file…',
    importing: 'Importing…',
    resultSub: 'Accounts imported — you can close this tab.',
    hint: 'Supports either { accounts: [...] } or a raw account array JSON.',
    importedSummary: 'Imported {count} account(s)',
    notJsonFile: 'Please select a JSON file.',
    invalidJson: 'Invalid JSON file format.',
    missingAccounts: 'JSON must be an array or contain an accounts array.',
    importFailed: 'Import failed: ',
    lockedHint: 'Vault may be locked. Unlock it in popup and retry.',
  },
  zh: {
    title: 'Vault <em>2FA</em> — JSON 导入',
    dzTitle: '将 JSON 文件拖到这里',
    dzSub: '或点击选择文件',
    waiting: '等待 JSON 文件…',
    importing: '导入中…',
    resultSub: '账号已导入，可关闭此标签页。',
    hint: '支持 { accounts: [...] } 或直接账号数组 JSON',
    importedSummary: '已导入 {count} 个账号',
    notJsonFile: '请选择 JSON 文件',
    invalidJson: 'JSON 文件格式无效',
    missingAccounts: 'JSON 必须是数组或包含 accounts 数组',
    importFailed: '导入失败：',
    lockedHint: '保险库可能已锁定，请在弹窗中解锁后重试',
  },
};

let lang = 'en';
function t(key){ return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key; }
function tFmt(key, values = {}){
  return String(t(key)).replace(/\{(\w+)\}/g, (_, name) => values[name] == null ? '' : String(values[name]));
}

function applyTheme(){
  const light = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
}

function applyI18n(){
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  const pageTitle = document.getElementById('pageTitle');
  if(pageTitle){
    pageTitle.replaceChildren();
    pageTitle.appendChild(document.createTextNode('Vault '));
    const accent = document.createElement('em');
    accent.textContent = '2FA';
    pageTitle.appendChild(accent);
    pageTitle.appendChild(document.createTextNode(lang === 'zh' ? ' — JSON 导入' : ' — JSON Import'));
  }
  document.getElementById('dzTitle').textContent = t('dzTitle');
  document.getElementById('dzSub').textContent = t('dzSub');
  document.getElementById('status').textContent = t('waiting');
  document.getElementById('resultSub').textContent = t('resultSub');
  document.getElementById('pageHint').textContent = t('hint');
}

function showStatus(msg){ statusEl.textContent = msg; }
function hideErr(){ errEl.textContent = ''; errEl.classList.remove('show'); }
function showErr(msg){ errEl.textContent = msg; errEl.classList.add('show'); showStatus(''); }
async function debugInfo(message, context){
  try {
    await browser.runtime.sendMessage({ action:'appendDebugInfo', message, context });
  } catch (_) {
    // Ignore debug logging failures.
  }
}

function parseJsonText(text){
  let parsed;
  try {
    parsed = JSON.parse(String(text || ''));
  } catch(_) {
    throw new Error(t('invalidJson'));
  }
  const format = Array.isArray(parsed) ? 'array' : 'object_with_accounts';
  const accounts = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.accounts) ? parsed.accounts : null);
  if(!accounts) throw new Error(t('missingAccounts'));
  return { accounts, format };
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
    const parsed = parseJsonText(text);
    await debugInfo('JSON import parsed payload', {
      accountCount: parsed.accounts.length,
      format: parsed.format,
    });
    const resp = await browser.runtime.sendMessage({ action:'importAccountsFromJson', accounts: parsed.accounts });
    if(!resp || resp.success === false){
      throw new Error((resp && resp.error) || 'Unknown error');
    }
    await debugInfo('JSON import persisted via background', {
      importedCount: resp.importedCount || parsed.accounts.length,
      totalAccounts: resp.totalAccounts,
    });
    resultNameEl.textContent = tFmt('importedSummary', { count: resp.importedCount || parsed.accounts.length });
    resultEl.classList.add('show');
    showStatus('');
  } catch(err){
    const msg = String((err && err.message) || err);
    const extra = /Vault is locked|unlock/i.test(msg) ? ` ${t('lockedHint')}` : '';
    await debugInfo('JSON import failed', {
      error: msg,
      vaultLockedHintShown: !!extra,
    });
    showErr(t('importFailed') + msg + extra);
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

browser.storage.local.get('uiLanguage').then((result) => {
  lang = result.uiLanguage === 'zh' ? 'zh' : 'en';
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
