'use strict';

const ACCOUNTS_KEY = 'accounts';
const ENCRYPTED_ACCOUNTS_KEY = 'accountsEncrypted';
const SYNC_SETTINGS_KEY = 'syncSettings';
const VAULT_SETTINGS_KEY = 'vaultSettings';
const SYNC_PREFIX = 'session:';

const defaultSyncSettings = {
  enabled: false,
  sessionId: '',
  intervalMinutes: 5,
  lastUploadedAt: null,
  lastDownloadedAt: null,
};

const defaultVaultSettings = {
  encryptionEnabled: false,
  salt: null,
  lastUnlockedAt: null,
};

let unlockedCrypto = null; // { passphrase, salt, key }
let autoUploadTimer = null;
const AUTO_UPLOAD_TICK_MS = 60 * 1000;

function enc(str){ return new TextEncoder().encode(str); }
function dec(buf){ return new TextDecoder().decode(buf); }
function b64FromBytes(bytes){
  let bin = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for(const b of arr) bin += String.fromCharCode(b);
  return btoa(bin);
}
function bytesFromB64(b64){
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
  return out;
}
function randomBytes(n){
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

async function getSyncSettings(){
  const result = await browser.storage.local.get(SYNC_SETTINGS_KEY);
  return Object.assign({}, defaultSyncSettings, result[SYNC_SETTINGS_KEY] || {});
}
async function setSyncSettings(next){
  const merged = Object.assign({}, await getSyncSettings(), next || {});
  await browser.storage.local.set({ [SYNC_SETTINGS_KEY]: merged });
  return merged;
}
async function getVaultSettings(){
  const result = await browser.storage.local.get(VAULT_SETTINGS_KEY);
  return Object.assign({}, defaultVaultSettings, result[VAULT_SETTINGS_KEY] || {});
}
async function setVaultSettings(next){
  const merged = Object.assign({}, await getVaultSettings(), next || {});
  await browser.storage.local.set({ [VAULT_SETTINGS_KEY]: merged });
  return merged;
}

function getSyncKey(sessionId){
  return SYNC_PREFIX + String(sessionId || '').trim();
}

async function deriveKey(passphrase, saltB64){
  const salt = bytesFromB64(saltB64);
  const baseKey = await crypto.subtle.importKey('raw', enc(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptJson(value, key){
  const iv = randomBytes(12);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc(JSON.stringify(value)));
  return {
    version: 1,
    iv: b64FromBytes(iv),
    data: b64FromBytes(new Uint8Array(cipher)),
  };
}

async function decryptJson(payload, key){
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytesFromB64(payload.iv) },
    key,
    bytesFromB64(payload.data)
  );
  return JSON.parse(dec(plain));
}

async function getPlainAccounts(){
  const result = await browser.storage.local.get(ACCOUNTS_KEY);
  return Array.isArray(result[ACCOUNTS_KEY]) ? result[ACCOUNTS_KEY] : [];
}

async function getEncryptedPayload(){
  const result = await browser.storage.local.get(ENCRYPTED_ACCOUNTS_KEY);
  return result[ENCRYPTED_ACCOUNTS_KEY] || null;
}

async function setPlainAccounts(accounts){
  await browser.storage.local.set({ [ACCOUNTS_KEY]: Array.isArray(accounts) ? accounts : [] });
}

async function setEncryptedPayload(payload){
  await browser.storage.local.set({ [ENCRYPTED_ACCOUNTS_KEY]: payload });
}

async function clearPlainAccounts(){
  await browser.storage.local.remove(ACCOUNTS_KEY);
}

async function clearEncryptedPayload(){
  await browser.storage.local.remove(ENCRYPTED_ACCOUNTS_KEY);
}

async function requireUnlockedCrypto(){
  const vault = await getVaultSettings();
  if(!vault.encryptionEnabled) return null;
  if(!unlockedCrypto || unlockedCrypto.salt !== vault.salt || !unlockedCrypto.key){
    const err = new Error('Vault is locked. Unlock it first.');
    err.code = 'NEED_UNLOCK';
    throw err;
  }
  return unlockedCrypto;
}

async function getLocalAccounts(){
  const vault = await getVaultSettings();
  if(!vault.encryptionEnabled) return getPlainAccounts();
  const state = await requireUnlockedCrypto();
  const payload = await getEncryptedPayload();
  if(!payload) return [];
  return decryptJson(payload, state.key);
}

async function setLocalAccounts(accounts){
  const vault = await getVaultSettings();
  const list = Array.isArray(accounts) ? accounts : [];
  if(!vault.encryptionEnabled){
    await setPlainAccounts(list);
    return;
  }
  const state = await requireUnlockedCrypto();
  const payload = await encryptJson(list, state.key);
  await setEncryptedPayload(payload);
}

async function uploadToSync(accounts, settings){
  if(!settings.sessionId) return { skipped: true };
  const key = getSyncKey(settings.sessionId);
  const payload = {
    version: 1,
    sessionId: settings.sessionId,
    updatedAt: Date.now(),
    accounts: Array.isArray(accounts) ? accounts : [],
  };
  await browser.storage.sync.set({ [key]: payload });
  await setSyncSettings({ lastUploadedAt: payload.updatedAt });
  return { success: true, updatedAt: payload.updatedAt, count: payload.accounts.length };
}

function shouldAutoUpload(settings){
  if(!settings.enabled || !settings.sessionId) return false;
  const interval = Math.max(1, parseInt(settings.intervalMinutes, 10) || 1);
  if(!settings.lastUploadedAt) return true;
  return (Date.now() - settings.lastUploadedAt) >= interval * 60 * 1000;
}


async function runAutoUploadTick(force){
  const settings = await getSyncSettings();
  if(!settings.enabled || !settings.sessionId) return { skipped: true, reason: 'disabled' };
  if(!force && !shouldAutoUpload(settings)) return { skipped: true, reason: 'interval' };
  let accounts;
  try {
    accounts = await getLocalAccounts();
  } catch (err) {
    if(err && err.code === 'NEED_UNLOCK') return { skipped: true, reason: 'vault_locked' };
    throw err;
  }
  return uploadToSync(accounts, settings);
}

function startAutoUploadScheduler(){
  if(autoUploadTimer !== null) return;
  runAutoUploadTick(true).catch(() => {});
  autoUploadTimer = setInterval(() => {
    runAutoUploadTick(false).catch(() => {});
  }, AUTO_UPLOAD_TICK_MS);
}

async function downloadFromSync(sessionId){
  const sid = String(sessionId || '').trim();
  if(!sid) throw new Error('Sync session ID is required.');
  const key = getSyncKey(sid);
  const result = await browser.storage.sync.get(key);
  const payload = result[key];
  if(!payload || !Array.isArray(payload.accounts) || payload.accounts.length === 0) {
    throw new Error('No synced data was found for this session ID.');
  }
  await setLocalAccounts(payload.accounts);
  await setSyncSettings({ lastDownloadedAt: Date.now() });
  return { success: true, accounts: payload.accounts, updatedAt: payload.updatedAt || null, count: payload.accounts.length };
}

async function unlockVault(passphrase){
  const vault = await getVaultSettings();
  if(!vault.encryptionEnabled) return { success: true, unlocked: true, encryptionEnabled: false };
  if(!passphrase) throw new Error('Passphrase is required.');
  const key = await deriveKey(passphrase, vault.salt);
  const payload = await getEncryptedPayload();
  if(payload){
    await decryptJson(payload, key);
  }
  unlockedCrypto = { passphrase, salt: vault.salt, key };
  await setVaultSettings({ lastUnlockedAt: Date.now() });
  return { success: true, unlocked: true, encryptionEnabled: true };
}

async function enableEncryption(passphrase){
  if(!passphrase || String(passphrase).length < 6){
    throw new Error('Use a passphrase with at least 6 characters.');
  }
  const vault = await getVaultSettings();
  if(vault.encryptionEnabled){
    return unlockVault(passphrase);
  }
  const accounts = await getPlainAccounts();
  const salt = b64FromBytes(randomBytes(16));
  const key = await deriveKey(passphrase, salt);
  unlockedCrypto = { passphrase, salt, key };
  const payload = await encryptJson(accounts, key);
  await setEncryptedPayload(payload);
  await clearPlainAccounts();
  await setVaultSettings({ encryptionEnabled: true, salt, lastUnlockedAt: Date.now() });
  return { success: true, encryptionEnabled: true, unlocked: true };
}

async function disableEncryption(passphrase){
  const vault = await getVaultSettings();
  if(!vault.encryptionEnabled) return { success: true, encryptionEnabled: false, unlocked: true };
  if(passphrase){
    await unlockVault(passphrase);
  } else {
    await requireUnlockedCrypto();
  }
  const accounts = await getLocalAccounts();
  await setPlainAccounts(accounts);
  await clearEncryptedPayload();
  unlockedCrypto = null;
  await setVaultSettings({ encryptionEnabled: false, salt: null, lastUnlockedAt: null });
  return { success: true, encryptionEnabled: false, unlocked: true };
}

async function getVaultStatus(){
  const vault = await getVaultSettings();
  return {
    success: true,
    encryptionEnabled: !!vault.encryptionEnabled,
    unlocked: !vault.encryptionEnabled || !!(unlockedCrypto && unlockedCrypto.salt === vault.salt),
    lastUnlockedAt: vault.lastUnlockedAt || null,
  };
}

function lockVault(){
  unlockedCrypto = null;
  return { success: true, unlocked: false };
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch(message.action){
      case 'getAccounts': {
        const accounts = await getLocalAccounts();
        sendResponse({ success: true, accounts });
        return;
      }
      case 'saveAccounts': {
        const accounts = Array.isArray(message.accounts) ? message.accounts : [];
        await setLocalAccounts(accounts);
        const sync = { skipped: true, reason: 'timer_only' };
        sendResponse({ success: true, sync, settings: await getSyncSettings() });
        return;
      }
      case 'getSyncSettings': {
        sendResponse({ success: true, settings: await getSyncSettings() });
        return;
      }
      case 'saveSyncSettings': {
        const incoming = message.settings || {};
        const settings = await setSyncSettings({
          enabled: !!incoming.enabled,
          sessionId: String(incoming.sessionId || '').trim(),
          intervalMinutes: Math.max(1, parseInt(incoming.intervalMinutes, 10) || 5),
        });
        sendResponse({ success: true, settings, upload: { skipped: true } });
        return;
      }
      case 'uploadSyncNow': {
        const settings = await getSyncSettings();
        const sessionId = String(message.sessionId || settings.sessionId || '').trim();
        if(!sessionId) throw new Error('Set a sync session ID first.');
        const accounts = await getLocalAccounts();
        const upload = await uploadToSync(accounts, Object.assign({}, settings, { sessionId }));
        sendResponse({ success: true, upload, settings: await getSyncSettings() });
        return;
      }

      case 'addAccountFromQr': {
        const incoming = message.account || {};
        const account = {
          id: String(incoming.id || ''),
          type: incoming.type === 'hotp' ? 'hotp' : 'totp',
          issuer: String(incoming.issuer || ''),
          label: String(incoming.label || ''),
          secret: String(incoming.secret || ''),
          algorithm: String(incoming.algorithm || 'SHA1'),
          digits: Number(incoming.digits || 6),
          period: incoming.period != null ? Number(incoming.period) : undefined,
          counter: incoming.counter != null ? Number(incoming.counter) : undefined,
        };
        if(!account.secret) throw new Error('Secret is required.');
        if(!account.label) throw new Error('Account label is required.');

        const accounts = await getLocalAccounts();
        accounts.push(account);
        await setLocalAccounts(accounts);

        const sync = { skipped: true, reason: 'timer_only' };
        sendResponse({ success: true, account, sync, settings: await getSyncSettings() });
        return;
      }

      case 'downloadSyncToLocal': {
        const settings = await getSyncSettings();
        const sessionId = String(message.sessionId || settings.sessionId || '').trim();
        const data = await downloadFromSync(sessionId);
        sendResponse(data);
        return;
      }
      case 'getVaultStatus': {
        sendResponse(await getVaultStatus());
        return;
      }
      case 'unlockVault': {
        sendResponse(await unlockVault(String(message.passphrase || '')));
        return;
      }
      case 'lockVault': {
        sendResponse(lockVault());
        return;
      }
      case 'enableEncryption': {
        sendResponse(await enableEncryption(String(message.passphrase || '')));
        return;
      }
      case 'disableEncryption': {
        sendResponse(await disableEncryption(String(message.passphrase || '')));
        return;
      }
      default:
        sendResponse({ success: false, error: 'Unknown action.' });
    }
  })().catch(err => {
    sendResponse({ success: false, error: err && err.message ? err.message : String(err), code: err && err.code ? err.code : undefined });
  });
  return true;
});

startAutoUploadScheduler();
