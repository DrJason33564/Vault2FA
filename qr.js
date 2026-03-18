// SPDX-License-Identifier: MIT
"use strict";
const OTPAuth = window.OTPAuth;
const dz       = document.getElementById('dz');
const fileInput= document.getElementById('fileInput');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const nameEl   = document.getElementById('resultName');
const errEl    = document.getElementById('err');

const QR_I18N = {
  en: {
    title: 'Vault <em>2FA</em> — QR Scanner',
    dzTitle: 'Drop a QR image here',
    dzSub: 'or click to choose a file',
    waiting: 'Waiting for a QR code image…',
    resultSub: 'Account added to Vault 2FA — you can close this tab.',
    hint: 'Tip: drag a QR image from your downloads, desktop, or any website directly onto the box above.',
    notImage: 'Please drop an image file.',
    scanning: 'Scanning…',
    qrLibFail: 'QR decoder failed to load.',
    qrEmpty: 'No QR code data was found.',
    invalidOtp: 'QR found but not a valid otpauth:// URI: ',
    addedSuffix: ' added!',
    unknownAccount: 'Account',
    scanFail: 'Could not scan QR image: ',
    addFail: 'Could not add account: ',
  },
  zh: {
    title: 'Vault <em>2FA</em> — 二维码扫描',
    dzTitle: '将二维码图片拖到这里',
    dzSub: '或点击选择文件',
    waiting: '等待二维码图片…',
    resultSub: '账号已添加到 Vault 2FA，可关闭此标签页。',
    hint: '提示：可将下载目录、桌面或网页中的二维码图片直接拖拽到上方区域。',
    notImage: '请拖入图片文件。',
    scanning: '扫描中…',
    qrLibFail: '二维码解码库加载失败。',
    qrEmpty: '未检测到二维码数据。',
    invalidOtp: '已识别二维码，但不是有效的 otpauth:// URI：',
    addedSuffix: ' 已添加！',
    unknownAccount: '账号',
    scanFail: '无法扫描二维码图片：',
    addFail: '无法添加账号：',
  },
};

let qrLang = 'en';

function applyTheme(){
  const light = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
}

function qrt(key){ return (QR_I18N[qrLang] && QR_I18N[qrLang][key]) || QR_I18N.en[key] || key; }
function applyQrI18n(){
  document.documentElement.lang = qrLang === 'zh' ? 'zh-CN' : 'en';
  document.getElementById('qrTitle').innerHTML = qrt('title');
  document.getElementById('dzTitle').textContent = qrt('dzTitle');
  document.getElementById('dzSub').textContent = qrt('dzSub');
  document.getElementById('status').textContent = qrt('waiting');
  document.getElementById('resultSub').textContent = qrt('resultSub');
  document.getElementById('qrHint').textContent = qrt('hint');
}

browser.storage.local.get('uiLanguage').then((result) => {
  qrLang = result.uiLanguage === 'zh' ? 'zh' : 'en';
  applyQrI18n();
});

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

async function imageDataFromFile(file){
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if(window.createImageBitmap){
    const bitmap = await createImageBitmap(file);
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

async function decodeQrText(file){
  if(typeof window.jsQR !== 'function') throw new Error(qrt('qrLibFail'));
  const imageData = await imageDataFromFile(file);
  const result = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
  return result && result.data ? result.data : '';
}

async function process(file){
  showStatus(qrt('scanning')); hideErr();
  try{
    const rawValue = await decodeQrText(file);
    if(!rawValue) throw new Error(qrt('qrEmpty'));

    let parsed;
    try { parsed = OTPAuth.URI.parse(rawValue); }
    catch(e){ showErr(qrt('invalidOtp') + e.message); return; }

    const acc = {
      id:        generateId(),
      type:      parsed instanceof OTPAuth.TOTP ? 'totp' : 'hotp',
      issuer:    parsed.issuer  || '',
      label:     parsed.label   || '',
      secret:    parsed.secret.base32,
      algorithm: parsed.algorithm || 'SHA1',
      digits:    parsed.digits,
      period:    parsed instanceof OTPAuth.TOTP ? parsed.period  : undefined,
      counter:   parsed instanceof OTPAuth.HOTP ? parsed.counter : undefined,
    };

    const resp = await browser.runtime.sendMessage({ action: 'addAccountFromQr', account: acc });
    if(!resp || resp.success === false){
      throw new Error((resp && resp.error) || 'Failed to add account.');
    }

    const name = [acc.issuer, acc.label].filter(Boolean).join(' — ') || qrt('unknownAccount');
    nameEl.textContent = name + qrt('addedSuffix');
    resultEl.classList.add('show');
    showStatus('');
    hideErr();
    setTimeout(() => window.close(), 2500);
  } catch(e){
    const msg = e && e.message ? e.message : String(e);
    const prefix = /add account|Vault is locked|Secret is required|Account label is required|Failed to add account/i.test(msg) ? qrt('addFail') : qrt('scanFail');
    showErr(prefix + msg);
  }
}

function generateId(){
  const rand = (crypto && crypto.randomUUID) ? crypto.randomUUID().replace(/-/g, '') : (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  return 'acc_' + rand;
}
function showStatus(msg){ statusEl.textContent = msg; }
function hideErr(){ errEl.textContent=''; errEl.classList.remove('show'); }
function showErr(msg){ errEl.textContent=msg; errEl.classList.add('show'); showStatus(''); }
