// SPDX-License-Identifier: MIT
"use strict";
const dz       = document.getElementById('dz');
const fileInput= document.getElementById('fileInput');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const nameEl   = document.getElementById('resultName');
const errEl    = document.getElementById('err');

const QR_I18N = {};
const DEFAULT_LOCALE_ID = window.Vault2FALocales ? window.Vault2FALocales.DEFAULT_LOCALE_ID : 'en-US';
const QR_FALLBACK = {
  title: 'Vault <em>2FA</em> — QR Scanner',
  dzTitle: 'Drop a QR image here',
  dzSub: 'or click to choose a file',
  waiting: 'Waiting for a QR code image…',
  resultSub: 'Account added to Vault 2FA — you can close this tab.',
  hint: 'Tip: you can scan a QR code from webpage directly through right-clicking on it.',
  notImage: 'Please drop an image file.',
  scanning: 'Scanning…',
  qrLibFail: 'QR decoder failed to load.',
  qrEmpty: 'No QR code data was found.',
  invalidOtp: 'QR found but not a URI Vault2FA can parse: ',
  addedSuffix: ' added!',
  unknownAccount: 'Account',
  scanFail: 'Could not scan QR image: ',
  addFail: 'Could not add account: ',
  loadingFromImage: 'Loading image from web page…',
  loadImageFail: 'Could not load the selected image: ',
  migrationAccountsAdded: 'Account imported from third-party source - you can close this tab.',
};
let qrLang = DEFAULT_LOCALE_ID;
let qrStatusBusy = false;

async function loadQrLocale(localeId){
  if(!window.Vault2FALocales) return;
  const targetLocaleId = resolveLocaleId(localeId);
  const section = await window.Vault2FALocales.getSection('qr-scanner', targetLocaleId);
  QR_I18N[targetLocaleId] = Object.assign({}, QR_I18N[targetLocaleId] || {}, section || {});
}


function applyTheme(){
  const light = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
}

function resolveLocaleId(value){
  return window.Vault2FALocales ? window.Vault2FALocales.localeIdFromLanguage(value) : DEFAULT_LOCALE_ID;
}
function qrt(key){
  return (QR_I18N[qrLang] && QR_I18N[qrLang][key])
    || (QR_I18N[DEFAULT_LOCALE_ID] && QR_I18N[DEFAULT_LOCALE_ID][key])
    || QR_FALLBACK[key]
    || key;
}
function qrtFmt(key, values = {}){
  const template = qrt(key);
  return String(template).replace(/\{(\w+)\}/g, (_, name) => {
    return Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : '';
  });
}
function renderQrTitle(){
  const titleEl = document.getElementById('qrTitle');
  if(!titleEl) return;
  const title = String(qrt('title') || '');
  const marker = '<em>2FA</em>';
  const markerIndex = title.indexOf(marker);
  if(markerIndex < 0){
    titleEl.textContent = title.replace(/<\/?em>/g, '');
    return;
  }
  const before = title.slice(0, markerIndex);
  const after = title.slice(markerIndex + marker.length);
  const accent = document.createElement('em');
  accent.textContent = '2FA';
  titleEl.replaceChildren(
    document.createTextNode(before),
    accent,
    document.createTextNode(after)
  );
}
function applyQrI18n(){
  document.documentElement.lang = qrLang;
  renderQrTitle();
  document.getElementById('dzTitle').textContent = qrt('dzTitle');
  document.getElementById('dzSub').textContent = qrt('dzSub');
  if(!qrStatusBusy && !resultEl.classList.contains('show') && !errEl.classList.contains('show')){
    document.getElementById('status').textContent = qrt('waiting');
  }
  document.getElementById('resultSub').textContent = qrt('resultSub');
  document.getElementById('qrHint').textContent = qrt('hint');
}

const qrLocaleReady = (async () => {
  try {
    const result = await browser.storage.local.get('uiLanguage');
    qrLang = resolveLocaleId(result.uiLanguage);
  } catch (_) {
    qrLang = DEFAULT_LOCALE_ID;
  }
  await loadQrLocale(qrLang);
  applyQrI18n();
})();

applyTheme();
if(window.matchMedia){
  const qrThemeMedia = window.matchMedia('(prefers-color-scheme: light)');
  if(qrThemeMedia.addEventListener){
    qrThemeMedia.addEventListener('change', applyTheme);
  } else if(qrThemeMedia.addListener){
    qrThemeMedia.addListener(applyTheme);
  }
}

dz.addEventListener('dragenter', e => { e.preventDefault(); dz.classList.add('drag-over'); });
dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag-over'); });
dz.addEventListener('dragleave', e => { if(!dz.contains(e.relatedTarget)) dz.classList.remove('drag-over'); });
dz.addEventListener('drop', async e => {
  e.preventDefault(); dz.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if(!f || !f.type.startsWith('image/')){ showErr(qrt('notImage')); return; }
  await process(f);
});

fileInput.addEventListener('change', async e => {
  if(e.target.files[0]) await process(e.target.files[0]);
});

async function processImageUrlFromQuery(){
  const params = new URLSearchParams(window.location.search || '');
  const imageUrl = String(params.get('imageUrl') || '').trim();
  if(!imageUrl) return;
  const safeImageUrl = maskContextImageUrl(imageUrl);
  showStatus(qrt('loadingFromImage'));
  hideErr();
  await debugInfo('QR image URL received from context menu', { imageUrl: safeImageUrl });
  try {
    const responsePromise = fetch(imageUrl);
    await qrLocaleReady.catch(() => {});
    const response = await responsePromise;
    if(!response || !response.ok) throw new Error(`HTTP ${response ? response.status : 'ERR'}`);
    const blob = await response.blob();
    if(!blob || !(blob.type || '').startsWith('image/')) throw new Error('Not an image resource.');
    const file = new File([blob], 'context-menu-image', { type: blob.type || 'image/png' });
    await process(file);
  } catch (error) {
    const msg = error && error.message ? error.message : String(error);
    await debugInfo('QR image URL load failed', { imageUrl: safeImageUrl, error: toDebugEnglishMessage(msg) });
    showErr(qrt('loadImageFail') + msg);
  }
}

async function imageDataFromFile(file){
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if(window.createImageBitmap){
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (_) {
      bitmap = await createImageBitmap(file);
    }
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.drawImage(bitmap, 0, 0);
    if(bitmap.close) bitmap.close();
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image load failed.'));
      el.src = url;
    });
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function buildDecodeCandidates(imageData){
  const maxDimension = Math.max(imageData.width, imageData.height);
  const isLargeImage = maxDimension > 2000;
  // 对高像素相机图片先扫描较小候选图，避免在原图正反色解码上浪费时间。
  const targetMaxDimensions = isLargeImage ? [1200, 1600, 900, 700, 500, 'full'] : ['full', 1600, 1200, 900, 700, 500];
  const seenSizes = new Set();

  return targetMaxDimensions.reduce((candidates, targetMaxDimension) => {
    const ratio = targetMaxDimension === 'full' ? 1 : Math.min(1, targetMaxDimension / maxDimension);
    const width = Math.max(1, Math.round(imageData.width * ratio));
    const height = Math.max(1, Math.round(imageData.height * ratio));
    const sizeKey = `${width}x${height}`;
    if(seenSizes.has(sizeKey)) return candidates;
    seenSizes.add(sizeKey);
    candidates.push({
      name: ratio === 1 ? 'full' : `scaled-${width}x${height}`,
      width,
      height,
      data: resizeImageData(imageData, width, height),
    });
    return candidates;
  }, []);
}

function resizeImageData(imageData, width, height){
  if(width === imageData.width && height === imageData.height) return imageData.data;
  const src = imageData.data;
  const dst = new Uint8ClampedArray(width * height * 4);
  const xRatio = imageData.width / width;
  const yRatio = imageData.height / height;
  for(let y = 0; y < height; y++){
    const sy = Math.min(imageData.height - 1, Math.floor(y * yRatio));
    for(let x = 0; x < width; x++){
      const sx = Math.min(imageData.width - 1, Math.floor(x * xRatio));
      const sIdx = (sy * imageData.width + sx) * 4;
      const dIdx = (y * width + x) * 4;
      dst[dIdx] = src[sIdx];
      dst[dIdx + 1] = src[sIdx + 1];
      dst[dIdx + 2] = src[sIdx + 2];
      dst[dIdx + 3] = src[sIdx + 3];
    }
  }
  return dst;
}

async function decodeQrText(file){
  if(typeof window.jsQR !== 'function') throw new Error(qrt('qrLibFail'));
  const imageData = await imageDataFromFile(file);
  await debugInfo('QR image payload prepared for decoder', {
    width: imageData.width,
    height: imageData.height,
    pixelBytes: imageData.data ? imageData.data.length : 0,
    pixelSha256: await sha256Hex(imageData.data),
  });
  const candidates = buildDecodeCandidates(imageData);
  const inversionAttempts = ['dontInvert', 'onlyInvert'];
  for(const candidate of candidates){
    for(const inversionAttempt of inversionAttempts){
      const startedAt = Date.now();
      const result = window.jsQR(candidate.data, candidate.width, candidate.height, { inversionAttempts: inversionAttempt });
      await debugInfo('QR decode attempt', {
        candidate: candidate.name,
        inversionAttempt,
        width: candidate.width,
        height: candidate.height,
        elapsedMs: Date.now() - startedAt,
        hasValue: !!(result && result.data),
      });
      if(result && result.data) return result.data;
    }
  }
  return '';
}

async function process(file){
  showStatus(qrt('scanning')); hideErr();
  await debugInfo('QR scan started', {
    fileName: file && file.name ? file.name : '',
    fileType: file && file.type ? file.type : '',
    fileSize: file && typeof file.size === 'number' ? file.size : null,
  });
  try{
    const rawValue = await decodeQrText(file);
    const rawText = rawValue ? String(rawValue) : '';
    const isMigrationUri = /^otpauth-migration:\/\//i.test(rawText);
    await debugInfo('QR decode result', {
      hasValue: !!rawValue,
      rawLength: rawText.length,
      rawPreview: buildSafeQrPreview(rawText),
      isOtpAuth: !!(rawText.startsWith('otpauth://') || isMigrationUri),
    });
    if(!rawValue) throw new Error(qrt('qrEmpty'));

    const isStandardOtpAuthUri = rawText.startsWith('otpauth://');
    const isNonOtpAuthQrPayload = !isStandardOtpAuthUri;
    await debugInfo('QR -> background request', {
      action: 'addAccountsFromQrPayload',
      rawLength: rawText.length,
      rawPreview: buildSafeQrPreview(rawText),
    });
    const resp = await browser.runtime.sendMessage({ action: 'addAccountsFromQrPayload', payload: rawText });
    await debugInfo('QR <- background response', {
      success: !!(resp && resp.success),
      error: resp && resp.error ? toDebugEnglishMessage(String(resp.error)) : undefined,
      importedCount: resp && resp.importedCount,
      failedCount: resp && resp.failedCount,
      accounts: resp && Array.isArray(resp.accounts) ? resp.accounts.map(summarizeAccount) : [],
      sync: resp && resp.sync ? resp.sync : undefined,
    });
    if(!resp || resp.success === false){
      throw new Error((resp && resp.error) || 'Failed to add account.');
    }

    const addedAccounts = Array.isArray(resp.accounts) ? resp.accounts : [];
    if(!addedAccounts.length) throw new Error(qrt('qrEmpty'));
    const first = addedAccounts[0] || null;
    const name = (isNonOtpAuthQrPayload || addedAccounts.length > 1)
      ? qrtFmt('migrationAccountsAdded', { count: addedAccounts.length })
      : ([first.issuer, first.label].filter(Boolean).join(' — ') || qrt('unknownAccount')) + qrt('addedSuffix');

    nameEl.textContent = name;
    resultEl.classList.add('show');
    showStatus('');
    hideErr();
  } catch(e){
    await debugInfo('QR processing failed', {
      error: toDebugEnglishMessage(e && e.message ? e.message : String(e)),
      stack: e && e.stack ? e.stack : null,
    });
    const msg = e && e.message ? e.message : String(e);
    const prefix = /add account|Vault is locked|Secret is required|Account label is required|Failed to add account/i.test(msg) ? qrt('addFail') : qrt('scanFail');
    showErr(prefix + msg);
  }
}

function maskTail(value, keepHead = 4, keepTail = 2){
  const text = String(value || '');
  if(!text) return '';
  if(text.length <= keepHead + keepTail) return `${text.slice(0, 1)}***`;
  return `${text.slice(0, keepHead)}***${text.slice(-keepTail)}`;
}
function maskOtpUriSecrets(input){
  return String(input || '').replace(/([?&]secret=)([^&#]+)/i, (_, prefix, secret) => `${prefix}${maskTail(secret)}`);
}
function maskMigrationData(input){
  return String(input || '').replace(/([?&]data=)([^&#]+)/i, (_, prefix) => `${prefix}***`);
}
function maskContextImageUrl(input){
  const text = String(input || '');
  if(!text) return '';
  if(!/^data:/i.test(text)) return text;
  const commaIndex = text.indexOf(',');
  if(commaIndex === -1) return 'data:***';
  const head = text.slice(0, Math.min(commaIndex + 1, 80));
  return `${head}***`;
}
function buildSafeQrPreview(rawText){
  const text = String(rawText || '');
  if(!text) return '';
  const isMigration = /^otpauth-migration:\/\//i.test(text);
  const masked = isMigration ? maskMigrationData(text) : maskOtpUriSecrets(text);
  return masked.slice(0, 120);
}
function maskSecret(secret){
  const value = String(secret || '');
  if(!value) return '';
  if(value.length <= 6) return `${value.slice(0, 1)}***`;
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}
function toDebugEnglishMessage(message){
  const raw = String(message == null ? '' : message);
  if(!raw) return raw;
  const langPack = QR_I18N[qrLang] || {};
  const basePack = QR_I18N[DEFAULT_LOCALE_ID] || {};
  for(const [key, value] of Object.entries(langPack)){
    if(String(value) === raw && basePack[key]) return String(basePack[key]);
  }
  return raw;
}

function summarizeAccount(account){
  const acc = account || {};
  return {
    id: String(acc.id || ''),
    type: acc.type === 'hotp' ? 'hotp' : 'totp',
    issuer: String(acc.issuer || ''),
    label: String(acc.label || ''),
    algorithm: String(acc.algorithm || 'SHA1'),
    digits: Number(acc.digits || 6),
    period: acc.period != null ? Number(acc.period) : undefined,
    counter: acc.counter != null ? Number(acc.counter) : undefined,
    secretLength: String(acc.secret || '').length,
    secretMasked: maskSecret(acc.secret),
  };
}
async function debugInfo(message, context){
  try {
    await browser.runtime.sendMessage({ action: 'appendDebugInfo', message, context });
  } catch (_) {
    // Ignore debug logging errors to keep QR flow unaffected.
  }
}
async function sha256Hex(bytes){
  try {
    if(!bytes || !bytes.buffer) return '';
    const hash = await crypto.subtle.digest('SHA-256', bytes.buffer);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (_) {
    return '';
  }
}
function showStatus(msg){
  statusEl.textContent = msg;
  qrStatusBusy = !!msg && msg !== qrt('waiting');
}
function hideErr(){ errEl.textContent=''; errEl.classList.remove('show'); }
function showErr(msg){ errEl.textContent=msg; errEl.classList.add('show'); showStatus(''); }

processImageUrlFromQuery().catch(() => {});
