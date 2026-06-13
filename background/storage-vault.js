// SPDX-License-Identifier: MIT
'use strict';

const ACCOUNTS_KEY = 'accounts';
const ENCRYPTED_ACCOUNTS_KEY = 'accountsEncrypted';
const VAULT_SETTINGS_KEY = 'vaultSettings';

const defaultVaultSettings = {
  encryptionEnabled: false,
  salt: null,
  lastUnlockedAt: null,
  autoLockEnabled: false,
  autoLockMinutes: 15,
};
const KDF_ALGO = 'PBKDF2-HMAC-SHA256';
const KDF_ITERATIONS = 250000;
const KDF_KEY_LENGTH = 256;
const CIPHER_ALGO = 'AES-GCM';
const ENCRYPTED_PAYLOAD_VERSION = 1;

let unlockedCrypto = null; // { salt, key }
const SESSION_UNLOCKED_CRYPTO_KEY = 'sessionUnlockedCrypto';
const VAULT_AUTO_LOCK_ALARM = 'vaultAutoLock';

async function loadSessionUnlockState(){
  if(unlockedCrypto && unlockedCrypto.salt && unlockedCrypto.key) return unlockedCrypto;
  if(!browser.storage || !browser.storage.session) return null;
  const data = await browser.storage.session.get(SESSION_UNLOCKED_CRYPTO_KEY);
  const state = data && data[SESSION_UNLOCKED_CRYPTO_KEY];
  if(!state || !state.salt || !state.keyJwk) return null;
  try {
    const key = await crypto.subtle.importKey('jwk', state.keyJwk, { name: CIPHER_ALGO }, false, ['encrypt', 'decrypt']);
    unlockedCrypto = { salt: state.salt, key };
    return unlockedCrypto;
  } catch (_) {
    await browser.storage.session.remove(SESSION_UNLOCKED_CRYPTO_KEY);
    return null;
  }
}

async function persistSessionUnlockState(state){
  unlockedCrypto = state && state.salt && state.key ? state : null;
  if(!browser.storage || !browser.storage.session) return;
  if(!unlockedCrypto){
    await browser.storage.session.remove(SESSION_UNLOCKED_CRYPTO_KEY);
    return;
  }
  const keyJwk = await crypto.subtle.exportKey('jwk', unlockedCrypto.key);
  await browser.storage.session.set({ [SESSION_UNLOCKED_CRYPTO_KEY]: { salt: unlockedCrypto.salt, keyJwk } });
}

function normalizeAutoLockMinutes(value){
  return Math.max(1, parseInt(value, 10) || 15);
}

async function clearVaultAutoLockAlarm(){
  if(browser.alarms && typeof browser.alarms.clear === 'function') await browser.alarms.clear(VAULT_AUTO_LOCK_ALARM);
}

async function scheduleVaultAutoLock(){
  const vault = await getVaultSettings();
  const unlocked = await loadSessionUnlockState();
  if(!vault.encryptionEnabled || !vault.autoLockEnabled || !unlocked){
    await clearVaultAutoLockAlarm();
    return;
  }
  const delayMinutes = normalizeAutoLockMinutes(vault.autoLockMinutes);
  if(browser.alarms && typeof browser.alarms.create === 'function'){
    browser.alarms.create(VAULT_AUTO_LOCK_ALARM, { delayInMinutes: delayMinutes });
  }
}


async function touchVaultActivity(){
  // Auto-lock countdown is anchored to unlock time and must not be reset by activity.
}

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

async function getVaultSettings(){
  const result = await browser.storage.local.get(VAULT_SETTINGS_KEY);
  return Object.assign({}, defaultVaultSettings, result[VAULT_SETTINGS_KEY] || {});
}
async function setVaultSettings(next){
  const merged = Object.assign({}, await getVaultSettings(), next || {});
  await browser.storage.local.set({ [VAULT_SETTINGS_KEY]: merged });
  return merged;
}

async function deriveKey(passphrase, saltB64){
  const salt = bytesFromB64(saltB64);
  const baseKey = await crypto.subtle.importKey('raw', enc(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: CIPHER_ALGO, length: KDF_KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

function resolvePayloadSalt(payload, fallbackSalt){
  if(payload && typeof payload === 'object' && typeof payload.salt === 'string' && payload.salt){
    return payload.salt;
  }
  return fallbackSalt || null;
}
function hasVersionedPayloadHeader(payload){
  if(!payload || typeof payload !== 'object') return false;
  return (
    payload.kdf === KDF_ALGO &&
    Number(payload.iterations) === KDF_ITERATIONS &&
    typeof payload.salt === 'string' && !!payload.salt &&
    Number(payload.keyLength) === KDF_KEY_LENGTH &&
    payload.cipher === CIPHER_ALGO &&
    Number(payload.version) === ENCRYPTED_PAYLOAD_VERSION &&
    typeof payload.iv === 'string' && !!payload.iv
  );
}
function hasPayloadHeaderFields(payload){
  if(!payload || typeof payload !== 'object') return false;
  return (
    typeof payload.kdf === 'string' &&
    Number.isFinite(Number(payload.iterations)) &&
    typeof payload.salt === 'string' && !!payload.salt &&
    Number.isFinite(Number(payload.keyLength)) &&
    typeof payload.cipher === 'string' &&
    Number.isFinite(Number(payload.version)) &&
    typeof payload.iv === 'string' && !!payload.iv
  );
}
function getPayloadHeaderForLog(payload){
  if(!payload || typeof payload !== 'object') return null;
  const hasHeader = hasPayloadHeaderFields(payload) || hasVersionedPayloadHeader(payload);
  if(!hasHeader) return null;
  return {
    kdf: payload.kdf,
    iterations: Number(payload.iterations),
    salt: payload.salt,
    keyLength: Number(payload.keyLength),
    cipher: payload.cipher,
    version: Number(payload.version),
    iv: payload.iv,
  };
}
function getMigrationReason(payload){
  if(!payload || typeof payload !== 'object') return null;
  if(!hasPayloadHeaderFields(payload)) return 'legacy_without_header';
  if(Number(payload.version) < ENCRYPTED_PAYLOAD_VERSION) return 'header_version_upgrade';
  return null;
}
function isLegacyEncryptedPayload(payload){
  if(!payload || typeof payload !== 'object') return false;
  return !hasVersionedPayloadHeader(payload);
}

async function encryptJson(value, key, saltB64){
  if(!saltB64) throw new Error('Missing KDF salt for encryption.');
  const iv = randomBytes(12);
  const cipher = await crypto.subtle.encrypt({ name: CIPHER_ALGO, iv }, key, enc(JSON.stringify(value)));
  return {
    kdf: KDF_ALGO,
    iterations: KDF_ITERATIONS,
    salt: saltB64,
    keyLength: KDF_KEY_LENGTH,
    cipher: CIPHER_ALGO,
    version: ENCRYPTED_PAYLOAD_VERSION,
    iv: b64FromBytes(iv),
    data: b64FromBytes(new Uint8Array(cipher)),
  };
}

async function decryptJson(payload, key, expectedSalt){
  if(!payload || typeof payload !== 'object'){
    throw new Error('Encrypted payload is invalid.');
  }
  if(hasVersionedPayloadHeader(payload)){
    if(payload.cipher !== CIPHER_ALGO) throw new Error('Unsupported cipher algorithm.');
    if(payload.kdf !== KDF_ALGO) throw new Error('Unsupported KDF algorithm.');
    if(Number(payload.iterations) !== KDF_ITERATIONS) throw new Error('Unsupported KDF iterations.');
    if(Number(payload.keyLength) !== KDF_KEY_LENGTH) throw new Error('Unsupported KDF key length.');
  }
  const payloadSalt = resolvePayloadSalt(payload, null);
  if(expectedSalt && payloadSalt && expectedSalt !== payloadSalt){
    throw new Error('Vault salt mismatch.');
  }
  const plain = await crypto.subtle.decrypt(
    { name: CIPHER_ALGO, iv: bytesFromB64(payload.iv) },
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
  const activeUnlockedState = await loadSessionUnlockState();
  if(!activeUnlockedState || !activeUnlockedState.salt || !activeUnlockedState.key){
    const err = new Error('Vault is locked. Unlock it first.');
    err.code = 'NEED_UNLOCK';
    throw err;
  }
  return activeUnlockedState;
}

async function getLocalAccounts(){
  const vault = await getVaultSettings();
  if(!vault.encryptionEnabled) return getPlainAccounts();
  const state = await requireUnlockedCrypto();
  const payload = await getEncryptedPayload();
  if(!payload) return [];
  return decryptJson(payload, state.key, state.salt);
}

async function setLocalAccounts(accounts){
  const vault = await getVaultSettings();
  const list = Array.isArray(accounts) ? accounts : [];
  if(!vault.encryptionEnabled){
    await setPlainAccounts(list);
    await refreshAutofillInjectionForOpenTabs();
    return;
  }
  const state = await requireUnlockedCrypto();
  const salt = state.salt || vault.salt;
  const payload = await encryptJson(list, state.key, salt);
  await setEncryptedPayload(payload);
  await appendDebugInfo('Vault payload encrypted and stored', {
    trigger: 'setLocalAccounts',
    accountCount: list.length,
    header: getPayloadHeaderForLog(payload),
  });
  await refreshAutofillInjectionForOpenTabs();
}

async function unlockVault(passphrase){
  const vault = await getVaultSettings();
  if(!vault.encryptionEnabled) return { success: true, unlocked: true, encryptionEnabled: false };
  if(!passphrase) throw new Error('Passphrase is required.');
  const payload = await getEncryptedPayload();
  const activeSalt = resolvePayloadSalt(payload, vault.salt);
  if(!activeSalt) throw new Error('Vault salt is missing.');
  const key = await deriveKey(passphrase, activeSalt);
  let decryptedAccounts = null;
  if(payload){
    decryptedAccounts = await decryptJson(payload, key, activeSalt);
    const migrationReason = getMigrationReason(payload);
    if(migrationReason){
      const migratedPayload = await encryptJson(decryptedAccounts, key, activeSalt);
      await setEncryptedPayload(migratedPayload);
      await setVaultSettings({ salt: null });
      await appendDebugInfo('Vault payload migrated to latest header', {
        migrationReason,
        fromHeader: getPayloadHeaderForLog(payload),
        toHeader: getPayloadHeaderForLog(migratedPayload),
        accountCount: Array.isArray(decryptedAccounts) ? decryptedAccounts.length : 0,
      });
    } else if(isLegacyEncryptedPayload(payload)){
      await appendDebugInfo('Vault payload legacy detected but not migrated', {
        note: 'legacy payload does not match supported migration paths',
      });
    }
  }
  await persistSessionUnlockState({ salt: activeSalt, key });
  await setVaultSettings({ lastUnlockedAt: Date.now() });
  await scheduleVaultAutoLock();
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
  await persistSessionUnlockState({ salt, key });
  const payload = await encryptJson(accounts, key, salt);
  await setEncryptedPayload(payload);
  await appendDebugInfo('Vault encryption enabled and payload stored', {
    trigger: 'enableEncryption',
    accountCount: accounts.length,
    header: getPayloadHeaderForLog(payload),
    migratedFromPlain: true,
  });
  await clearPlainAccounts();
  await setVaultSettings({ encryptionEnabled: true, salt: null, lastUnlockedAt: Date.now() });
  await scheduleVaultAutoLock();
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
  await persistSessionUnlockState(null);
  await clearVaultAutoLockAlarm();
  await setVaultSettings({ encryptionEnabled: false, salt: null, lastUnlockedAt: null });
  return { success: true, encryptionEnabled: false, unlocked: true };
}

async function getVaultStatus(){
  const vault = await getVaultSettings();
  return {
    success: true,
    encryptionEnabled: !!vault.encryptionEnabled,
    unlocked: !vault.encryptionEnabled || !!(await loadSessionUnlockState()),
    lastUnlockedAt: vault.lastUnlockedAt || null,
  };
}

async function lockVault(trigger = 'manual'){
  const vault = await getVaultSettings();
  if(!vault.encryptionEnabled){
    await appendDebugInfo('Vault lock requested but encryption is disabled', { trigger });
    return {
      success: false,
      code: 'NEED_ENCRYPTION_FIRST',
      error: 'You need to encrypt the vault first.',
      unlocked: true,
      encryptionEnabled: false,
    };
  }
  await persistSessionUnlockState(null);
  await clearVaultAutoLockAlarm();
  await appendDebugInfo('Vault locked', { trigger });
  return { success: true, unlocked: false, encryptionEnabled: true };
}
