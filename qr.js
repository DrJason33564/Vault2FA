"use strict";
const OTPAuth = window.OTPAuth;
const dz       = document.getElementById('dz');
const fileInput= document.getElementById('fileInput');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const nameEl   = document.getElementById('resultName');
const errEl    = document.getElementById('err');

if(window.QrScanner){
  QrScanner.WORKER_PATH = browser.runtime.getURL('qr-scanner-worker.min.js');
}

dz.addEventListener('dragenter', e => { e.preventDefault(); dz.classList.add('drag-over'); });
dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag-over'); });
dz.addEventListener('dragleave', e => { if(!dz.contains(e.relatedTarget)) dz.classList.remove('drag-over'); });
dz.addEventListener('drop', async e => {
  e.preventDefault(); dz.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if(!f || !f.type.startsWith('image/')){ showErr('Please drop an image file.'); return; }
  await process(f);
});
fileInput.addEventListener('change', async e => {
  if(e.target.files[0]) await process(e.target.files[0]);
});

async function process(file){
  showStatus('Scanning…'); hideErr();
  try{
    if(!window.QrScanner){
      throw new Error('QR scanner library failed to load.');
    }
    const scan = await QrScanner.scanImage(file, {
      returnDetailedScanResult: true,
      alsoTryWithoutScanRegion: true,
    });
    const rawValue = typeof scan === 'string' ? scan : scan.data;
    if(!rawValue){
      throw new Error('No QR code data was found.');
    }
    let parsed;
    try{ parsed = OTPAuth.URI.parse(rawValue); }
    catch(e){ showErr('QR found but not a valid otpauth:// URI: ' + e.message); return; }

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

    await browser.storage.local.set({pendingQrAccount: acc});

    const name = [acc.issuer, acc.label].filter(Boolean).join(' — ') || 'Account';
    nameEl.textContent = name + ' added!';
    resultEl.classList.add('show');
    showStatus('');
    hideErr();
    setTimeout(() => window.close(), 2500);
  } catch(e){
    showErr('Could not scan QR image: ' + e.message);
  }
}

function generateId(){
  const rand = (crypto && crypto.randomUUID) ? crypto.randomUUID().replace(/-/g, '') : (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  return 'acc_' + rand;
}
function showStatus(msg){ statusEl.textContent = msg; }
function hideErr(){ errEl.textContent=''; errEl.classList.remove('show'); }
function showErr(msg){ errEl.textContent=msg; errEl.classList.add('show'); showStatus(''); }
