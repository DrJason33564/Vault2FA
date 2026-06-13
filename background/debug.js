// SPDX-License-Identifier: MIT
'use strict';

const DEBUG_SETTINGS_KEY = 'debugSettings';
const DEBUG_LOG_KEY = 'debugInfoLog';

const defaultDebugSettings = {
  enabled: false,
};

async function getDebugSettings(){
  const result = await browser.storage.local.get(DEBUG_SETTINGS_KEY);
  return Object.assign({}, defaultDebugSettings, result[DEBUG_SETTINGS_KEY] || {});
}
async function setDebugSettings(next){
  const merged = Object.assign({}, await getDebugSettings(), next || {});
  await browser.storage.local.set({ [DEBUG_SETTINGS_KEY]: merged });
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
