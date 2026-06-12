// SPDX-License-Identifier: MIT
'use strict';

const SYNC_SETTINGS_KEY = 'syncSettings';
const SYNC_PREFIX = 'session:';

const defaultSyncSettings = {
  enabled: false,
  sessionId: '',
  intervalMinutes: 5,
  lastUploadedAt: null,
  lastDownloadedAt: null,
  useEncryptedPayload: false,
};

const SYNC_MAX_ITEM_BYTES = 8192;
const SYNC_SAFE_ITEM_BYTES = 7000;
const SYNC_MAX_TOTAL_BYTES = 102400;
const SYNC_AUTO_UPLOAD_ALARM = 'syncAutoUpload';

function normalizeSyncIntervalMinutes(value){
  return Math.max(1, parseInt(value, 10) || 5);
}

async function clearSyncAutoUploadAlarm(){
  if(browser.alarms && typeof browser.alarms.clear === 'function') await browser.alarms.clear(SYNC_AUTO_UPLOAD_ALARM);
}

async function scheduleNextSyncAutoUploadAlarm(settings){
  const sync = settings || await getSyncSettings();
  if(!sync.enabled || !sync.sessionId){
    await clearSyncAutoUploadAlarm();
    return;
  }
  const delayMinutes = normalizeSyncIntervalMinutes(sync.intervalMinutes);
  if(browser.alarms && typeof browser.alarms.create === 'function'){
    browser.alarms.create(SYNC_AUTO_UPLOAD_ALARM, { delayInMinutes: delayMinutes });
  }
}

async function ensureSyncAutoUploadAlarm(){
  const settings = await getSyncSettings();
  if(!settings.enabled || !settings.sessionId){
    await clearSyncAutoUploadAlarm();
    return;
  }
  if(!browser.alarms || typeof browser.alarms.get !== 'function'){
    await runAutoUploadTick();
    return;
  }
  const alarm = await browser.alarms.get(SYNC_AUTO_UPLOAD_ALARM);
  if(alarm) return;
  try {
    await runAutoUploadTick();
  } finally {
    await scheduleNextSyncAutoUploadAlarm(settings);
  }
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

async function runAutoUploadTick(){
  const settings = await getSyncSettings();
  if(!settings.enabled || !settings.sessionId) return { skipped: true, reason: 'disabled' };
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
