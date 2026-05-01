// SPDX-License-Identifier: MIT
'use strict';

const ACCOUNTS_KEY = 'accounts';
const ENCRYPTED_ACCOUNTS_KEY = 'accountsEncrypted';
const SYNC_SETTINGS_KEY = 'syncSettings';
const VAULT_SETTINGS_KEY = 'vaultSettings';
const DEBUG_SETTINGS_KEY = 'debugSettings';
const FEATURE_SETTINGS_KEY = 'featureSettings';
const DEBUG_LOG_KEY = 'debugInfoLog';
const SYNC_PREFIX = 'session:';

const defaultSyncSettings = {
  enabled: false,
  sessionId: '',
  intervalMinutes: 5,
  lastUploadedAt: null,
  lastDownloadedAt: null,
  useEncryptedPayload: false,
};

const defaultVaultSettings = {
  encryptionEnabled: false,
  salt: null,
  lastUnlockedAt: null,
  autoLockEnabled: false,
  autoLockMinutes: 15,
};
const defaultDebugSettings = {
  enabled: false,
};
const defaultFeatureSettings = {
  autofillEnabled: true,
  rightclickEnabled: true,
};
const SYNC_MAX_ITEM_BYTES = 8192;
const SYNC_SAFE_ITEM_BYTES = 7000;
const SYNC_MAX_TOTAL_BYTES = 102400;
const KDF_ALGO = 'PBKDF2-HMAC-SHA256';
const KDF_ITERATIONS = 250000;
const KDF_KEY_LENGTH = 256;
const CIPHER_ALGO = 'AES-GCM';
const ENCRYPTED_PAYLOAD_VERSION = 1;
const MENU_I18N = {};
const DEFAULT_LOCALE_ID = window.Vault2FALocales ? window.Vault2FALocales.DEFAULT_LOCALE_ID : 'en-US';

let unlockedCrypto = null; // { salt, key }
const SESSION_UNLOCKED_CRYPTO_KEY = 'sessionUnlockedCrypto';
const VAULT_AUTO_LOCK_ALARM = 'vaultAutoLock';
let autoUploadTimer = null;
const AUTO_UPLOAD_TICK_MS = 60 * 1000;

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
  const vault = await getVaultSettings();
  if(!vault.encryptionEnabled || !vault.autoLockEnabled) return;
  const unlocked = await loadSessionUnlockState();
  if(!unlocked) return;
  await scheduleVaultAutoLock();
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

function normalizeAutofillPattern(pattern){
  return String(pattern || '').trim().toLowerCase();
}
function escapeRegex(text){
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function wildcardToRegex(pattern){
  const normalized = normalizeAutofillPattern(pattern);
  if(!normalized) return null;
  const escaped = normalized.split('*').map(escapeRegex).join('.*');
  return new RegExp(`^${escaped}$`, 'i');
}
function getAccountPatterns(account){
  if(Array.isArray(account && account.autofillPatterns)){
    return account.autofillPatterns.map(normalizeAutofillPattern).filter(Boolean);
  }
  if(account && typeof account.domain === 'string'){
    const legacy = normalizeAutofillPattern(account.domain);
    return legacy ? [legacy] : [];
  }
  return [];
}
function matchHostname(hostname, pattern){
  const normalizedHost = normalizeAutofillPattern(hostname);
  const normalizedPattern = normalizeAutofillPattern(pattern);
  if(!normalizedHost || !normalizedPattern) return false;
  const direct = wildcardToRegex(normalizedPattern);
  if(direct && direct.test(normalizedHost)) return true;
  if(!normalizedPattern.includes('*')){
    return normalizedHost === normalizedPattern || normalizedHost.endsWith('.' + normalizedPattern);
  }
  return false;
}
function shouldSkipInjectionUrl(url){
  const value = String(url || '').trim();
  if(!value) return true;
  return !/^https?:\/\//i.test(value);
}
function extractHostnameFromUrl(url){
  try {
    const parsed = new URL(String(url || ''));
    return String(parsed.hostname || '').trim().toLowerCase();
  } catch (_) {
    return '';
  }
}
async function shouldInjectAutofillForHostname(hostname){
  const target = String(hostname || '').trim().toLowerCase();
  if(!target) return false;
  let accounts = [];
  try {
    accounts = await getLocalAccounts();
  } catch (err) {
    if(err && err.code === 'NEED_UNLOCK') return false;
    throw err;
  }
  return accounts.some(account => getAccountPatterns(account).some(pattern => matchHostname(target, pattern)));
}
async function injectAutofillAssets(tabId){
  await browser.scripting.insertCSS({
    target: { tabId, allFrames: false },
    files: ['autofill/autofill.css'],
  });
  await browser.scripting.executeScript({
    target: { tabId, allFrames: false },
    files: ['locales/i18n.js', 'autofill/autofill-content.js'],
  });
}
async function maybeInjectAutofillForTab(tabId, url){
  if(typeof browser.scripting === 'undefined' || !browser.scripting || typeof browser.scripting.executeScript !== 'function'){
    return;
  }
  const featureSettings = await getFeatureSettings();
  if(featureSettings.autofillEnabled === false) return;
  if(shouldSkipInjectionUrl(url)) return;
  const hostname = extractHostnameFromUrl(url);
  if(!hostname) return;
  const matched = await shouldInjectAutofillForHostname(hostname);
  if(!matched) return;
  await injectAutofillAssets(tabId);
}
async function refreshAutofillInjectionForOpenTabs(){
  if(typeof browser.tabs === 'undefined' || !browser.tabs || typeof browser.tabs.query !== 'function') return;
  const tabs = await browser.tabs.query({});
  for(const tab of tabs){
    if(!tab || typeof tab.id !== 'number') continue;
    const tabUrl = String(tab.url || '');
    try {
      await maybeInjectAutofillForTab(tab.id, tabUrl);
    } catch (_) {}
  }
}
const QR_CONTEXT_MENU_ID = 'vault2fa-scan-qr-image';
function resolveLocaleId(value){
  return window.Vault2FALocales ? window.Vault2FALocales.localeIdFromLanguage(value) : DEFAULT_LOCALE_ID;
}
async function loadBackgroundLocales(){
  if(!window.Vault2FALocales) return;
  const localeIds = await window.Vault2FALocales.discoverLocaleIds();
  for(const localeId of localeIds){
    const section = await window.Vault2FALocales.getSection('background', localeId);
    MENU_I18N[localeId] = Object.assign({}, MENU_I18N[localeId] || {}, section || {});
  }
}

function getContextMenuTitle(language){
  const localeId = resolveLocaleId(language);
  return (MENU_I18N[localeId] && MENU_I18N[localeId].scanQrFromImage)
    || (MENU_I18N[DEFAULT_LOCALE_ID] && MENU_I18N[DEFAULT_LOCALE_ID].scanQrFromImage)
    || 'Scan QR code';
}
async function resolveContextMenuLanguage(){
  try {
    const settings = await browser.storage.local.get('uiLanguage');
    if(settings && settings.uiLanguage) return resolveLocaleId(settings.uiLanguage);
  } catch (_) {}
  try {
    if(browser.i18n && typeof browser.i18n.getUILanguage === 'function'){
      return resolveLocaleId(browser.i18n.getUILanguage());
    }
  } catch (_) {}
  return DEFAULT_LOCALE_ID;
}
async function setupContextMenus(){
  await loadBackgroundLocales();
  if(!browser.contextMenus || typeof browser.contextMenus.create !== 'function') return;
  const featureSettings = await getFeatureSettings();
  const language = await resolveContextMenuLanguage();
  try {
    await browser.contextMenus.remove(QR_CONTEXT_MENU_ID);
  } catch (_) {}
  if(featureSettings.rightclickEnabled === false) return;
  try {
    browser.contextMenus.create({
      id: QR_CONTEXT_MENU_ID,
      title: getContextMenuTitle(language),
      contexts: ['image'],
    });
  } catch (_) {}
}
async function openQrScannerForImageUrl(imageUrl){
  const source = String(imageUrl || '').trim();
  if(!source) return;
  const pageUrl = browser.runtime.getURL(`qr/qr.html?imageUrl=${encodeURIComponent(source)}`);
  await browser.tabs.create({ url: pageUrl });
}
function buildAutofillCodeInfo(account){
  const type = account && account.type === 'hotp' ? 'hotp' : 'totp';
  const digits = Math.max(6, Number((account && account.digits) || 6));
  const algorithm = String((account && account.algorithm) || 'SHA1');
  const secret = String((account && account.secret) || '').trim();
  if(!secret) throw new Error('Secret is required.');
  const normalizedSecret = secret.toUpperCase().replace(/\s+/g, '');
  const otpSecret = OTPAuth.Secret.fromBase32(normalizedSecret);
  if(type === 'hotp'){
    const counter = Math.max(0, Number((account && account.counter) || 0));
    const code = OTPAuth.HOTP.generate({ secret: otpSecret, algorithm, digits, counter });
    return { code, type, digits, algorithm, counter, period: null, remaining: null };
  }
  const period = Math.max(1, Number((account && account.period) || 30));
  const otp = new OTPAuth.TOTP({ secret: otpSecret, algorithm, digits, period });
  const code = otp.generate();
  const nowSeconds = Date.now() / 1000;
  const remaining = Math.max(0, Math.ceil(period - (nowSeconds % period)) % period || period);
  return { code, type, digits, algorithm, counter: null, period, remaining };
}

function buildDisplayCodeInfo(account){
  const id = String(account && account.id || '');
  const generatedAt = Date.now();
  try {
    const info = buildAutofillCodeInfo(account);
    return {
      id,
      code: info.code,
      baseRemaining: info.remaining,
      remaining: info.remaining,
      period: info.period,
      counter: info.counter != null ? Number(info.counter) : undefined,
      type: info.type,
      digits: info.digits,
      generatedAt,
      nextRefreshAt: info.type === 'totp' && info.remaining != null
        ? generatedAt + Math.max(1, Number(info.remaining || 1)) * 1000
        : null,
    };
  } catch (_) {
    const isHotp = account && account.type === 'hotp';
    const fallbackPeriod = Math.max(1, Number((account && account.period) || 30));
    return {
      id,
      code: '------',
      baseRemaining: isHotp ? null : fallbackPeriod,
      remaining: isHotp ? null : fallbackPeriod,
      period: isHotp ? null : fallbackPeriod,
      type: isHotp ? 'hotp' : 'totp',
      digits: Math.max(6, Number((account && account.digits) || 6)),
      generatedAt,
      nextRefreshAt: isHotp ? null : generatedAt + fallbackPeriod * 1000,
    };
  }
}

function normalizeImportedAccountRecord(incoming){
  const type = incoming && incoming.type === 'hotp' ? 'hotp' : 'totp';
  const secret = String(incoming && incoming.secret || '').toUpperCase().replace(/\s+/g, '');
  const label = String(incoming && incoming.label || '').trim();
  const issuer = String(incoming && incoming.issuer || label).trim() || label;
  const account = {
    id: String(incoming && incoming.id || ''),
    type,
    issuer,
    label,
    secret,
    algorithm: String(incoming && incoming.algorithm || 'SHA1').toUpperCase(),
    digits: Math.max(6, Number(incoming && incoming.digits || 6)),
    period: type === 'hotp' ? undefined : Math.max(1, Number(incoming && incoming.period || 30)),
    counter: type === 'hotp' ? Math.max(0, Number(incoming && incoming.counter || 0)) : undefined,
    autofillPatterns: Array.isArray(incoming && incoming.autofillPatterns)
      ? incoming.autofillPatterns.map(v => String(v || '').trim().toLowerCase()).filter(Boolean).filter((v, idx, arr) => arr.indexOf(v) === idx)
      : [],
  };
  if(!account.id){
    const rand = (crypto && crypto.randomUUID)
      ? crypto.randomUUID().replace(/-/g, '')
      : (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
    account.id = 'acc_' + rand;
  }
  if(!account.secret) throw new Error('Secret is required.');
  if(!account.label) throw new Error('Account label is required.');
  OTPAuth.Secret.fromBase32(account.secret);
  return account;
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
async function getDebugSettings(){
  const result = await browser.storage.local.get(DEBUG_SETTINGS_KEY);
  return Object.assign({}, defaultDebugSettings, result[DEBUG_SETTINGS_KEY] || {});
}
async function setDebugSettings(next){
  const merged = Object.assign({}, await getDebugSettings(), next || {});
  await browser.storage.local.set({ [DEBUG_SETTINGS_KEY]: merged });
  return merged;
}
async function getFeatureSettings(){
  const result = await browser.storage.local.get(FEATURE_SETTINGS_KEY);
  return Object.assign({}, defaultFeatureSettings, result[FEATURE_SETTINGS_KEY] || {});
}
async function setFeatureSettings(next){
  const merged = Object.assign({}, await getFeatureSettings(), next || {});
  await browser.storage.local.set({ [FEATURE_SETTINGS_KEY]: merged });
  return merged;
}
function maskSecretValue(value){
  const str = String(value || '');
  if(!str) return '';
  if(str.length <= 6) return `${str.slice(0, 1)}***`;
  return `${str.slice(0, 4)}***${str.slice(-2)}`;
}
function redactStringSecrets(text){
  const source = String(text || '');
  if(!source) return '';
  return source
    .replace(/([?&]secret=)([^&\s]+)/ig, (_, prefix, secret) => `${prefix}${maskSecretValue(secret)}`)
    .replace(/("secret"\s*:\s*")([^"]+)(")/ig, (_, before, secret, after) => `${before}${maskSecretValue(secret)}${after}`)
    .replace(/(secret\s*[:=]\s*)([A-Z2-7]{6,})/ig, (_, prefix, secret) => `${prefix}${maskSecretValue(secret)}`);
}
function redactSecrets(value){
  if(value == null) return value;
  if(typeof value === 'string') return redactStringSecrets(value);
  if(Array.isArray(value)) return value.map(redactSecrets);
  if(typeof value !== 'object') return value;
  const out = {};
  for(const [key, raw] of Object.entries(value)){
    if(/^secret$/i.test(key)){
      out[key] = maskSecretValue(raw);
      continue;
    }
    out[key] = redactSecrets(raw);
  }
  return out;
}
async function appendDebugInfo(message, context){
  const debug = await getDebugSettings();
  if(!debug.enabled) return;
  const stamp = new Date().toISOString();
  let suffix = '';
  const safeMessage = redactStringSecrets(String(message));
  if(context !== undefined){
    try {
      suffix = ` ${JSON.stringify(redactSecrets(context))}`;
    } catch (_) {
      suffix = ` ${JSON.stringify({ note: 'context_not_serializable', contextType: typeof context })}`;
    }
  }
  const line = `[${stamp}] INFO ${safeMessage}${suffix}\n`;
  const current = await browser.storage.local.get(DEBUG_LOG_KEY);
  const prev = String(current[DEBUG_LOG_KEY] || '');
  await browser.storage.local.set({ [DEBUG_LOG_KEY]: prev + line });
}
async function setDebugEnabled(enabled){
  const next = await setDebugSettings({ enabled: !!enabled });
  if(!next.enabled){
    await browser.storage.local.remove(DEBUG_LOG_KEY);
    return next;
  }
  await appendDebugInfo('Debug mode enabled');
  return next;
}
async function getDebugLogText(){
  const result = await browser.storage.local.get(DEBUG_LOG_KEY);
  return String(result[DEBUG_LOG_KEY] || '');
}

function getSyncKey(sessionId){
  return SYNC_PREFIX + String(sessionId || '').trim();
}
function getSyncChunkKey(baseKey, index){
  return `${baseKey}:chunk:${index}`;
}
function estimateSyncItemBytes(key, value){
  return String(key).length + JSON.stringify(value).length;
}
function splitAccountsForSync(accounts, baseKey){
  const chunks = [];
  let current = [];
  for(const account of accounts){
    const candidate = current.concat([account]);
    const candidateBytes = estimateSyncItemBytes(getSyncChunkKey(baseKey, chunks.length), candidate);
    if(candidateBytes > SYNC_SAFE_ITEM_BYTES){
      if(current.length === 0){
        throw new Error('One account entry is too large to sync.');
      }
      chunks.push(current);
      current = [account];
      const singleBytes = estimateSyncItemBytes(getSyncChunkKey(baseKey, chunks.length), current);
      if(singleBytes > SYNC_SAFE_ITEM_BYTES){
        throw new Error('One account entry is too large to sync.');
      }
      continue;
    }
    current = candidate;
  }
  if(current.length) chunks.push(current);
  return chunks;
}

function splitStringForSync(value, baseKey){
  const source = String(value || '');
  if(!source) return [''];
  const chunks = [];
  let cursor = 0;
  while(cursor < source.length){
    let nextCursor = Math.min(source.length, cursor + SYNC_SAFE_ITEM_BYTES);
    let candidate = source.slice(cursor, nextCursor);
    while(candidate && estimateSyncItemBytes(getSyncChunkKey(baseKey, chunks.length), candidate) > SYNC_SAFE_ITEM_BYTES){
      nextCursor -= 1;
      candidate = source.slice(cursor, nextCursor);
    }
    if(!candidate){
      throw new Error('Encrypted payload is too large to sync.');
    }
    chunks.push(candidate);
    cursor = nextCursor;
  }
  return chunks;
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

async function uploadToSync(accounts, settings, options = {}){
  const useEncryptedPayload = !!options.useEncryptedPayload;
  await appendDebugInfo('Sync upload requested', {
    sessionId: settings.sessionId,
    count: Array.isArray(accounts) ? accounts.length : 0,
    fullAccounts: Array.isArray(accounts) ? accounts : [],
    settings,
    useEncryptedPayload,
  });
  if(!settings.sessionId) return { skipped: true };
  const baseKey = getSyncKey(settings.sessionId);
  let mode = 'plainAccounts';
  let payloadCount = Array.isArray(accounts) ? accounts.length : 0;
  let chunkedAccounts = [];
  let chunkedEncryptedPayload = [];
  if(useEncryptedPayload){
    const vault = await getVaultSettings();
    if(!vault.encryptionEnabled){
      throw new Error('Enable local encryption before uploading encrypted payload.');
    }
    const encryptedPayload = await getEncryptedPayload();
    if(!encryptedPayload){
      throw new Error('Encrypted local payload was not found.');
    }
    mode = 'encryptedPayload';
    payloadCount = 0;
    chunkedEncryptedPayload = splitStringForSync(JSON.stringify(encryptedPayload), baseKey);
  } else {
    chunkedAccounts = splitAccountsForSync(Array.isArray(accounts) ? accounts : [], baseKey);
  }
  const payload = {
    version: 3,
    sessionId: settings.sessionId,
    updatedAt: Date.now(),
    count: payloadCount,
    mode,
    chunkCount: mode === 'encryptedPayload' ? chunkedEncryptedPayload.length : chunkedAccounts.length,
  };
  if(estimateSyncItemBytes(baseKey, payload) > SYNC_MAX_ITEM_BYTES){
    throw new Error('Sync metadata is too large.');
  }
  const previous = await browser.storage.sync.get(baseKey);
  await appendDebugInfo('Sync upload previous metadata loaded', { baseKey, previous });
  const previousPayload = previous[baseKey];
  const previousChunkCount = previousPayload && (previousPayload.version === 2 || previousPayload.version === 3)
    ? Math.max(0, Number(previousPayload.chunkCount) || 0)
    : 0;

  const nextItems = { [baseKey]: payload };
  let totalBytes = estimateSyncItemBytes(baseKey, payload);
  const activeChunks = mode === 'encryptedPayload' ? chunkedEncryptedPayload : chunkedAccounts;
  activeChunks.forEach((chunk, idx) => {
    const chunkKey = getSyncChunkKey(baseKey, idx);
    const itemBytes = estimateSyncItemBytes(chunkKey, chunk);
    if(itemBytes > SYNC_MAX_ITEM_BYTES){
      throw new Error('Sync data exceeds per-item storage limit.');
    }
    totalBytes += itemBytes;
    nextItems[chunkKey] = chunk;
  });
  if(totalBytes > SYNC_MAX_TOTAL_BYTES){
    throw new Error('Sync data exceeds browser sync storage limit. Reduce account count or use local storage.');
  }

  await appendDebugInfo('Sync upload request payload prepared', {
    baseKey,
    payload,
    chunkedAccounts,
    chunkedEncryptedPayload,
    nextItems,
    totalBytes,
  });

  try {
    await browser.storage.sync.set(nextItems);
    await appendDebugInfo('Sync upload storage.sync.set success', {
      baseKey,
      itemKeys: Object.keys(nextItems),
      chunkCount: activeChunks.length,
      totalBytes,
    });
  } catch (err) {
    await appendDebugInfo('Sync upload storage.sync.set failed', {
      baseKey,
      requestItems: nextItems,
      error: err && err.message ? err.message : String(err),
    });
    throw err;
  }

  const verify = await browser.storage.sync.get(Object.keys(nextItems));
  await appendDebugInfo('Sync upload verification fetch result', {
    requestedKeys: Object.keys(nextItems),
    response: verify,
  });

  if(previousChunkCount > activeChunks.length){
    const staleChunkKeys = [];
    for(let i = activeChunks.length; i < previousChunkCount; i += 1){
      staleChunkKeys.push(getSyncChunkKey(baseKey, i));
    }
    if(staleChunkKeys.length){
      await browser.storage.sync.remove(staleChunkKeys);
      await appendDebugInfo('Sync upload stale chunks removed', { staleChunkKeys });
    }
  }
  await setSyncSettings({ lastUploadedAt: payload.updatedAt });
  const result = { success: true, updatedAt: payload.updatedAt, count: payload.count, mode };
  await appendDebugInfo('Sync upload completed', result);
  return result;
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
  let accounts = [];
  if(!settings.useEncryptedPayload){
    try {
      accounts = await getLocalAccounts();
    } catch (err) {
      if(err && err.code === 'NEED_UNLOCK') return { skipped: true, reason: 'vault_locked' };
      throw err;
    }
  }
  return uploadToSync(accounts, settings, { useEncryptedPayload: !!settings.useEncryptedPayload });
}

function startAutoUploadScheduler(){
  if(autoUploadTimer !== null) return;
  runAutoUploadTick(true).catch(() => {});
  autoUploadTimer = setInterval(() => {
    runAutoUploadTick(false).catch(() => {});
  }, AUTO_UPLOAD_TICK_MS);
}

async function downloadFromSync(sessionId, options = {}){
  const apply = options.apply !== false;
  const allowEncrypted = !!options.allowEncrypted;
  await appendDebugInfo('Sync download requested', { sessionId });
  const sid = String(sessionId || '').trim();
  if(!sid) throw new Error('Sync session ID is required.');
  const baseKey = getSyncKey(sid);
  const result = await browser.storage.sync.get(baseKey);
  await appendDebugInfo('Sync download metadata response', { baseKey, response: result });
  const payload = result[baseKey];
  if(!payload) {
    throw new Error('No synced data was found for this session ID.');
  }

  let mode = payload.version === 3 ? String(payload.mode || 'plainAccounts') : 'plainAccounts';
  let accounts = [];
  let encryptedPayload = null;
  const chunkCount = Math.max(0, Number(payload.chunkCount) || 0);
  if(payload.version === 3){
    const chunkKeys = [];
    for(let i = 0; i < chunkCount; i += 1){
      chunkKeys.push(getSyncChunkKey(baseKey, i));
    }
    const chunkData = chunkKeys.length ? await browser.storage.sync.get(chunkKeys) : {};
    await appendDebugInfo('Sync download chunk response', { chunkKeys, chunkData, mode });
    if(mode === 'encryptedPayload'){
      const textChunks = [];
      for(const key of chunkKeys){
        const chunk = chunkData[key];
        if(typeof chunk !== 'string'){
          throw new Error('Synced encrypted payload is incomplete. Try uploading again from another device.');
        }
        textChunks.push(chunk);
      }
      const encryptedText = textChunks.join('');
      if(!encryptedText){
        throw new Error('Synced encrypted payload is empty.');
      }
      encryptedPayload = JSON.parse(encryptedText);
      if(!encryptedPayload || typeof encryptedPayload !== 'object' || !encryptedPayload.iv || !encryptedPayload.data){
        throw new Error('Synced encrypted payload is invalid.');
      }
    } else {
      accounts = [];
      for(const key of chunkKeys){
        const chunk = chunkData[key];
        if(!Array.isArray(chunk)){
          throw new Error('Synced data is incomplete. Try uploading again from another device.');
        }
        accounts.push(...chunk);
      }
    }
  } else if(payload.version === 2){
    mode = 'plainAccounts';
    if(chunkCount === 0){
      accounts = [];
    } else {
      const chunkKeys = [];
      for(let i = 0; i < chunkCount; i += 1){
        chunkKeys.push(getSyncChunkKey(baseKey, i));
      }
      const chunkData = await browser.storage.sync.get(chunkKeys);
      await appendDebugInfo('Sync download chunk response', { chunkKeys, chunkData, mode });
      accounts = [];
      for(const key of chunkKeys){
        const chunk = chunkData[key];
        if(!Array.isArray(chunk)){
          throw new Error('Synced data is incomplete. Try uploading again from another device.');
        }
        accounts.push(...chunk);
      }
    }
  } else if(Array.isArray(payload.accounts)) {
    mode = 'plainAccounts';
    accounts = payload.accounts;
  } else {
    throw new Error('No synced data was found for this session ID.');
  }

  const containsEncryptedHeader = mode === 'encryptedPayload' && hasPayloadHeaderFields(encryptedPayload);
  if(!apply){
    return {
      success: true,
      updatedAt: payload.updatedAt || null,
      count: mode === 'plainAccounts' ? accounts.length : 0,
      mode,
      containsEncryptedHeader,
      requiresEncryptedConfirmation: containsEncryptedHeader,
    };
  }

  if(mode === 'encryptedPayload'){
    if(containsEncryptedHeader && !allowEncrypted){
      const err = new Error('Synced cloud payload is encrypted. Confirm encrypted overwrite first.');
      err.code = 'NEED_ENCRYPTED_CONFIRM';
      throw err;
    }
    await setEncryptedPayload(encryptedPayload);
    await clearPlainAccounts();
    await persistSessionUnlockState(null);
    await clearVaultAutoLockAlarm();
    await setVaultSettings({ encryptionEnabled: true, salt: null, lastUnlockedAt: null });
  } else {
    await setLocalAccounts(accounts);
  }
  await setSyncSettings({ lastDownloadedAt: Date.now() });
  await appendDebugInfo('Sync download applied to local storage', {
    sessionId: sid,
    count: accounts.length,
    fullAccounts: accounts,
    mode,
    containsEncryptedHeader,
    sourcePayload: payload,
  });
  const resultPayload = {
    success: true,
    accounts,
    updatedAt: payload.updatedAt || null,
    count: accounts.length,
    mode,
    containsEncryptedHeader,
    appliedEncryptedPayload: mode === 'encryptedPayload',
  };
  await appendDebugInfo('Sync download completed', resultPayload);
  return resultPayload;
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

async function lockVault(){
  const vault = await getVaultSettings();
  if(!vault.encryptionEnabled){
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
  return { success: true, unlocked: false, encryptionEnabled: true };
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch(message.action){
      case 'getAccounts': {
        const accounts = await getLocalAccounts();
        await touchVaultActivity();
        sendResponse({ success: true, accounts });
        return;
      }
      case 'saveAccounts': {
        const accounts = Array.isArray(message.accounts) ? message.accounts : [];
        await setLocalAccounts(accounts);
        await touchVaultActivity();
        await appendDebugInfo('Accounts saved locally', { count: accounts.length });
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
          useEncryptedPayload: !!incoming.useEncryptedPayload,
        });
        await appendDebugInfo('Sync settings updated', {
          enabled: settings.enabled,
          sessionId: settings.sessionId,
          intervalMinutes: settings.intervalMinutes,
          useEncryptedPayload: settings.useEncryptedPayload,
        });
        sendResponse({ success: true, settings, upload: { skipped: true } });
        return;
      }
      case 'getFeatureSettings': {
        sendResponse({ success: true, settings: await getFeatureSettings() });
        return;
      }
      case 'saveFeatureSettings': {
        const incoming = message.settings || {};
        const settings = await setFeatureSettings({
          autofillEnabled: incoming.autofillEnabled !== false,
          rightclickEnabled: incoming.rightclickEnabled !== false,
        });
        sendResponse({ success: true, settings });
        return;
      }
      case 'uploadSyncNow': {
        const settings = await getSyncSettings();
        const sessionId = String(message.sessionId || settings.sessionId || '').trim();
        if(!sessionId) throw new Error('Set a sync session ID first.');
        const useEncryptedPayload = message.useEncryptedPayload == null
          ? !!settings.useEncryptedPayload
          : !!message.useEncryptedPayload;
        const accounts = useEncryptedPayload ? [] : await getLocalAccounts();
        const upload = await uploadToSync(accounts, Object.assign({}, settings, { sessionId }), { useEncryptedPayload });
        await appendDebugInfo('uploadSyncNow response', { upload });
        sendResponse({ success: true, upload, settings: await getSyncSettings() });
        return;
      }

      case 'addAccountFromQr': {
        const incoming = message.account || {};
        await appendDebugInfo('addAccountFromQr request received', {
          account: {
            id: String(incoming.id || ''),
            type: incoming.type === 'hotp' ? 'hotp' : 'totp',
            issuer: String(incoming.issuer || ''),
            label: String(incoming.label || ''),
            algorithm: String(incoming.algorithm || 'SHA1'),
            digits: Number(incoming.digits || 6),
            period: incoming.period != null ? Number(incoming.period) : undefined,
            counter: incoming.counter != null ? Number(incoming.counter) : undefined,
            autofillPatterns: Array.isArray(incoming.autofillPatterns) ? incoming.autofillPatterns : [],
            secretLength: String(incoming.secret || '').length,
          },
        });
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
          autofillPatterns: Array.isArray(incoming.autofillPatterns) ? incoming.autofillPatterns.map(v => String(v || '').trim().toLowerCase()).filter(Boolean) : [],
        };
        if(!account.secret) throw new Error('Secret is required.');
        if(!account.label) throw new Error('Account label is required.');

        const accounts = await getLocalAccounts();
        accounts.push(account);
        await setLocalAccounts(accounts);
        await touchVaultActivity();

        const sync = { skipped: true, reason: 'timer_only' };
        await appendDebugInfo('addAccountFromQr stored successfully', {
          accountId: account.id,
          label: account.label,
          issuer: account.issuer,
          totalAccounts: accounts.length,
        });
        sendResponse({ success: true, account, sync, settings: await getSyncSettings() });
        return;
      }
      case 'importAccountsFromJson': {
        const encryptedPayload = message && message.encryptedPayload;
        if(hasPayloadHeaderFields(encryptedPayload) && typeof encryptedPayload.data === 'string' && encryptedPayload.data){
          await setEncryptedPayload(encryptedPayload);
          await clearPlainAccounts();
          unlockedCrypto = null;
          await setVaultSettings({ encryptionEnabled: true, salt: null, lastUnlockedAt: null });
          await refreshAutofillInjectionForOpenTabs();
          await appendDebugInfo('importAccountsFromJson stored encrypted payload and locked vault', {
            header: getPayloadHeaderForLog(encryptedPayload),
          });
          sendResponse({
            success: true,
            importedEncrypted: true,
            importedCount: 0,
            totalAccounts: 0,
            settings: await getSyncSettings(),
          });
          return;
        }
        const source = Array.isArray(message.accounts) ? message.accounts : [];
        if(!source.length) throw new Error('No accounts provided.');
        const normalized = source.map(normalizeImportedAccountRecord);
        const existing = await getLocalAccounts();
        const merged = existing.concat(normalized);
        await setLocalAccounts(merged);
        await appendDebugInfo('importAccountsFromJson stored successfully', {
          importedCount: normalized.length,
          totalAccounts: merged.length,
        });
        sendResponse({ success: true, importedEncrypted: false, importedCount: normalized.length, totalAccounts: merged.length, settings: await getSyncSettings() });
        return;
      }
      case 'getEncryptedPayloadForExport': {
        const payload = await getEncryptedPayload();
        await appendDebugInfo('getEncryptedPayloadForExport requested', {
          hasPayload: !!payload,
          header: getPayloadHeaderForLog(payload),
        });
        sendResponse({ success: true, payload });
        return;
      }


      case 'getAccountsForAutofill': {
        const hostname = String(message.hostname || '').trim().toLowerCase();
        let accounts = [];
        try {
          accounts = await getLocalAccounts();
        } catch (err) {
          if(err && err.code === 'NEED_UNLOCK'){
            sendResponse({ success: true, accounts: [], locked: true });
            return;
          }
          throw err;
        }
        const matches = accounts
          .filter(account => getAccountPatterns(account).some(pattern => matchHostname(hostname, pattern)))
          .map(account => {
            const codeInfo = buildAutofillCodeInfo(account);
            return {
              id: account.id,
              issuer: account.issuer || '',
              label: account.label || '',
              type: account.type === 'hotp' ? 'hotp' : 'totp',
              digits: Number(account.digits || 6),
              period: account.period != null ? Number(account.period) : undefined,
              counter: account.counter != null ? Number(account.counter) : undefined,
              autofillPatterns: getAccountPatterns(account),
              currentCode: codeInfo.code,
              remaining: codeInfo.remaining,
              codePeriod: codeInfo.period,
            };
          });
        sendResponse({ success: true, accounts: matches, locked: false });
        return;
      }
      case 'generateCodeForAutofillById': {
        const id = String(message.id || '');
        if(!id) throw new Error('Account ID is required.');
        const hostname = String(message.hostname || '').trim().toLowerCase();
        const accounts = await getLocalAccounts();
        const account = accounts.find(item => String(item.id) === id);
        if(!account) throw new Error('Account not found.');
        const patterns = getAccountPatterns(account);
        if(hostname && patterns.length && !patterns.some(pattern => matchHostname(hostname, pattern))){
          throw new Error('Account does not match this host.');
        }
        const info = buildAutofillCodeInfo(account);
        sendResponse({
          success: true,
          id,
          code: info.code,
          remaining: info.remaining,
          period: info.period,
        });
        return;
      }
      case 'generateCodesForDisplay': {
        const ids = Array.isArray(message.ids) ? message.ids.map(v => String(v || '')).filter(Boolean) : [];
        if(!ids.length){
          sendResponse({ success: true, items: [] });
          return;
        }
        const idSet = new Set(ids);
        const accounts = await getLocalAccounts();
        const byId = new Map(accounts.map(acc => [String(acc.id || ''), acc]));
        const items = [];
        for(const id of ids){
          if(!idSet.has(id)) continue;
          const account = byId.get(id);
          if(!account) continue;
          items.push(buildDisplayCodeInfo(account));
        }
        sendResponse({ success: true, items });
        return;
      }
      case 'generateCodeForAutofill': {
        const secret = String(message.secret || '').trim();
        const type = message.type === 'hotp' ? 'hotp' : 'totp';
        const digits = Math.max(6, Number(message.digits || 6));
        if(!secret) throw new Error('Secret is required.');
        const normalizedSecret = secret.toUpperCase().replace(/\s+/g, '');
        const otpSecret = OTPAuth.Secret.fromBase32(normalizedSecret);
        if(type === 'hotp'){
          const counter = Math.max(0, Number(message.counter || 0));
          const code = OTPAuth.HOTP.generate({
            secret: otpSecret,
            algorithm: String(message.algorithm || 'SHA1'),
            digits,
            counter,
          });
          sendResponse({ success: true, code });
          return;
        }
        const otp = new OTPAuth.TOTP({
          secret: otpSecret,
          algorithm: String(message.algorithm || 'SHA1'),
          digits,
          period: Math.max(1, Number(message.period || 30)),
        });
        sendResponse({ success: true, code: otp.generate() });
        return;
      }
      case 'downloadSyncToLocal': {
        const settings = await getSyncSettings();
        const sessionId = String(message.sessionId || settings.sessionId || '').trim();
        const data = await downloadFromSync(sessionId, {
          apply: !message.dryRun,
          allowEncrypted: !!message.allowEncrypted,
        });
        await appendDebugInfo('downloadSyncToLocal response', { data });
        sendResponse(data);
        return;
      }
      case 'getDebugState': {
        sendResponse({ success: true, debug: await getDebugSettings() });
        return;
      }
      case 'setDebugEnabled': {
        const debug = await setDebugEnabled(!!message.enabled);
        sendResponse({ success: true, debug });
        return;
      }
      case 'appendDebugInfo': {
        await appendDebugInfo(String(message.message || ''), message.context);
        sendResponse({ success: true });
        return;
      }
      case 'getDebugLogText': {
        sendResponse({ success: true, text: await getDebugLogText() });
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
        sendResponse(await lockVault());
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
      case 'getVaultTimerSettings': {
        const vault = await getVaultSettings();
        sendResponse({ success: true, settings: { autoLockEnabled: !!vault.autoLockEnabled, autoLockMinutes: normalizeAutoLockMinutes(vault.autoLockMinutes) } });
        return;
      }
      case 'saveVaultTimerSettings': {
        const incoming = message.settings || {};
        const settings = await setVaultSettings({
          autoLockEnabled: !!incoming.autoLockEnabled,
          autoLockMinutes: normalizeAutoLockMinutes(incoming.autoLockMinutes),
        });
        await scheduleVaultAutoLock();
        sendResponse({ success: true, settings: { autoLockEnabled: !!settings.autoLockEnabled, autoLockMinutes: normalizeAutoLockMinutes(settings.autoLockMinutes) } });
        return;
      }
      default:
        sendResponse({ success: false, error: 'Unknown action.' });
    }
  })().catch(async err => {
    await appendDebugInfo('Background message handler error', {
      action: message && message.action ? message.action : '(unknown)',
      error: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack : null,
      request: message,
    });
    sendResponse({ success: false, error: err && err.message ? err.message : String(err), code: err && err.code ? err.code : undefined });
  });
  return true;
});

if(browser.tabs && typeof browser.tabs.onUpdated !== 'undefined'){
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const url = String((changeInfo && changeInfo.url) || (tab && tab.url) || '');
    if(!url) return;
    maybeInjectAutofillForTab(tabId, url).catch(() => {});
  });
}

setupContextMenus().catch(() => {});
if(browser.runtime && browser.runtime.onInstalled){
  browser.runtime.onInstalled.addListener(() => {
    setupContextMenus().catch(() => {});
    refreshAutofillInjectionForOpenTabs().catch(() => {});
  });
}
if(browser.runtime && browser.runtime.onStartup){
  browser.runtime.onStartup.addListener(() => {
    refreshAutofillInjectionForOpenTabs().catch(() => {});
    scheduleVaultAutoLock().catch(() => {});
  });
}
if(browser.contextMenus && browser.contextMenus.onClicked){
  browser.contextMenus.onClicked.addListener((info) => {
    if(!info || info.menuItemId !== QR_CONTEXT_MENU_ID) return;
    openQrScannerForImageUrl(info.srcUrl).catch(() => {});
  });
}
if(browser.alarms && browser.alarms.onAlarm){
  browser.alarms.onAlarm.addListener((alarm) => {
    if(!alarm || alarm.name !== VAULT_AUTO_LOCK_ALARM) return;
    lockVault().catch(() => {});
  });
}

if(browser.storage && browser.storage.onChanged){
  browser.storage.onChanged.addListener((changes, areaName) => {
    if(areaName !== 'local') return;
    if(!changes) return;
    if(changes.uiLanguage || changes[FEATURE_SETTINGS_KEY]){
      setupContextMenus().catch(() => {});
    }
    if(changes[FEATURE_SETTINGS_KEY]){
      refreshAutofillInjectionForOpenTabs().catch(() => {});
    }
  });
}

startAutoUploadScheduler();
scheduleVaultAutoLock().catch(() => {});
refreshAutofillInjectionForOpenTabs().catch(() => {});
