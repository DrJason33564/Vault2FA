// SPDX-License-Identifier: MIT
'use strict';

function buildAutofillCodeInfo(account){
  const type = account && account.type === 'hotp' ? 'hotp' : 'totp';
  const algorithm = String((account && account.algorithm) || 'SHA1');
  const digits = Math.max(6, Number((account && account.digits) || 6));
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

function generateAccountId(){
  const rand = (crypto && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, '')
    : (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  return 'acc_' + rand;
}

function parseSecretByFormat(secretRaw, format){
  const input = String(secretRaw || '').trim();
  const normalized = input.replace(/\s+/g, '');
  switch(String(format || 'base32').toLowerCase()){
    case 'base32':
      return OTPAuth.Secret.fromBase32(normalized.toUpperCase());
    case 'base64': {
      const b64 = normalized.replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '='.repeat((4 - (b64.length % 4 || 4)) % 4);
      const bytes = Uint8Array.from(atob(padded), ch => ch.charCodeAt(0));
      return new OTPAuth.Secret({ buffer: bytes.buffer });
    }
    case 'hex':
      return OTPAuth.Secret.fromHex(normalized);
    case 'utf8':
      return OTPAuth.Secret.fromUTF8(input);
    case 'latin1':
      return OTPAuth.Secret.fromLatin1(input);
    default:
      throw new Error('Unsupported secret format.');
  }
}

function normalizeAccountPatterns(patterns){
  return (Array.isArray(patterns) ? patterns : [])
    .map(v => String(v || '').trim().toLowerCase())
    .filter(Boolean)
    .filter((v, idx, arr) => arr.indexOf(v) === idx);
}

function buildOtpAuthUriForAccount(account){
  if(!account) throw new Error('Account was not found.');
  const type = account.type === 'hotp' ? 'hotp' : 'totp';
  const secret = OTPAuth.Secret.fromBase32(String(account.secret || '').toUpperCase().replace(/\s+/g, ''));
  const opts = {
    issuer: String(account.issuer || ''),
    label: String(account.label || ''),
    secret,
    algorithm: String(account.algorithm || 'SHA1'),
    digits: Math.max(6, Number(account.digits || 6)),
  };
  const otp = type === 'hotp'
    ? new OTPAuth.HOTP(Object.assign(opts, { counter: Math.max(0, Number(account.counter || 0)) }))
    : new OTPAuth.TOTP(Object.assign(opts, { period: Math.max(1, Number(account.period || 30)) }));
  return otp.toString();
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
  const label = String(incoming && incoming.label || '').trim();
  const issuer = String(incoming && incoming.issuer || label).trim() || label;
  const secretFormat = String(incoming && incoming.secretFormat || 'base32').toLowerCase();
  const rawSecret = String(incoming && incoming.secret || '').trim();
  if(!rawSecret) throw new Error('Secret is required.');
  const secret = parseSecretByFormat(rawSecret, secretFormat).base32;
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
    autofillPatterns: normalizeAccountPatterns(incoming && incoming.autofillPatterns),
  };
  if(!account.id) account.id = generateAccountId();
  if(!account.label) throw new Error('Account label is required.');
  return account;
}

function normalizeStoredAccountRecord(incoming){
  const type = incoming && incoming.type === 'hotp' ? 'hotp' : 'totp';
  const label = String(incoming && incoming.label || '').trim();
  const issuer = String(incoming && incoming.issuer || label).trim() || label;
  const rawSecret = String(incoming && incoming.secret || '').trim();
  if(!rawSecret) throw new Error('Secret is required.');
  const secret = OTPAuth.Secret.fromBase32(rawSecret.toUpperCase().replace(/\s+/g, '')).base32;
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
    autofillPatterns: normalizeAccountPatterns(incoming && incoming.autofillPatterns),
  };
  if(!account.id) account.id = generateAccountId();
  if(!account.label) throw new Error('Account label is required.');
  return account;
}

function accountFromOtpAuthUri(uri){
  const parsed = OTPAuth.URI.parse(String(uri || '').trim());
  return normalizeImportedAccountRecord({
    id: generateAccountId(),
    type: parsed instanceof OTPAuth.TOTP ? 'totp' : 'hotp',
    issuer: parsed.issuer || '',
    label: parsed.label || '',
    secret: parsed.secret.base32,
    algorithm: parsed.algorithm || 'SHA1',
    digits: parsed.digits,
    period: parsed instanceof OTPAuth.TOTP ? parsed.period : undefined,
    counter: parsed instanceof OTPAuth.HOTP ? parsed.counter : undefined,
    autofillPatterns: [],
  });
}

function expandOtpAuthInput(value){
  const text = String(value || '').trim();
  if(!text) return [];
  if(
    window.Vault2FAGoogleMigration &&
    window.Vault2FAGoogleMigration.isGoogleMigrationUri(text)
  ){
    const decoded = window.Vault2FAGoogleMigration.decodeGoogleMigrationUri(text);
    return (decoded.accounts || []).map(item =>
      window.Vault2FAGoogleMigration.buildOtpAuthUri(item)
    );
  }
  return [text];
}

function parseJsonImportAccounts(raw){
  const parsed = JSON.parse(raw);
  const source = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.accounts) ? parsed.accounts : null);
  if(!source) throw new Error('JSON payload must contain an accounts array.');
  return source.map(normalizeImportedAccountRecord);
}

function parseUriImportAccounts(raw){
  const lines = String(raw || '').split('\n').map(s => s.trim()).filter(Boolean);
  const accounts = [];
  let fail = 0;
  for(const uri of lines){
    try {
      const expanded = expandOtpAuthInput(uri);
      for(const item of expanded){
        accounts.push(accountFromOtpAuthUri(item));
      }
    } catch (_) {
      fail++;
    }
  }
  return { accounts, fail };
}

function parseAccountsForImportData(raw){
  const input = String(raw || '').trim();
  if(!input) return { accounts: [], fail: 0, inputType: 'empty' };
  if(input.startsWith('{') || input.startsWith('[')){
    return { accounts: parseJsonImportAccounts(input), fail: 0, inputType: 'json' };
  }
  const parsed = parseUriImportAccounts(input);
  return { accounts: parsed.accounts, fail: parsed.fail, inputType: 'uri_lines' };
}
