// SPDX-License-Identifier: MIT
'use strict';

async function getOtpAuthUriForAccountResponse(accountIdRaw){
  const accountId = String(accountIdRaw || '').trim();
  if(!accountId) throw new Error('Account ID is required.');
  const accounts = await getLocalAccounts();
  const account = accounts.find(item => String(item && item.id || '') === accountId);
  if(!account) throw new Error('Account was not found.');
  const uri = buildOtpAuthUriForAccount(account);
  await touchVaultActivity();
  await appendDebugInfo('QR export URI generated', {
    accountId,
    account: {
      id: accountId,
      type: account.type === 'hotp' ? 'hotp' : 'totp',
      issuer: String(account.issuer || ''),
      label: String(account.label || ''),
      algorithm: String(account.algorithm || 'SHA1'),
      digits: Number(account.digits || 6),
      period: account.period != null ? Number(account.period) : undefined,
      counter: account.counter != null ? Number(account.counter) : undefined,
    },
  });
  return {
    success: true,
    uri,
    account: {
      id: accountId,
      type: account.type === 'hotp' ? 'hotp' : 'totp',
      issuer: String(account.issuer || ''),
      label: String(account.label || ''),
    },
  };
}

async function openQrPreviewForAccount(accountIdRaw){
  const accountId = String(accountIdRaw || '').trim();
  if(!accountId) throw new Error('Account ID is required.');
  const previewUrl = browser.runtime.getURL('qr/preview.html') + '#id=' + encodeURIComponent(accountId);
  await browser.tabs.create({ url: previewUrl });
  return { success: true };
}
