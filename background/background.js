// SPDX-License-Identifier: MIT
'use strict';

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const autofillDenied = await guardAutofillMessage(message, sender);
    if(autofillDenied){
      sendResponse(autofillDenied);
      return;
    }

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
          intervalMinutes: normalizeSyncIntervalMinutes(incoming.intervalMinutes),
          useEncryptedPayload: !!incoming.useEncryptedPayload,
        });
        await appendDebugInfo('Sync settings updated', {
          enabled: settings.enabled,
          sessionId: settings.sessionId,
          intervalMinutes: settings.intervalMinutes,
          useEncryptedPayload: settings.useEncryptedPayload,
        });
        await scheduleNextSyncAutoUploadAlarm(settings);
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
        let upload;
        try {
          upload = await uploadToSync(accounts, Object.assign({}, settings, { sessionId }), { useEncryptedPayload });
        } finally {
          await scheduleNextSyncAutoUploadAlarm(await getSyncSettings());
        }
        await appendDebugInfo('uploadSyncNow response', { upload });
        sendResponse({ success: true, upload, settings: await getSyncSettings() });
        return;
      }

      case 'openQrPreviewForAccount': {
        sendResponse(await openQrPreviewForAccount(message.id));
        return;
      }

      case 'getOtpAuthUriForAccount': {
        sendResponse(await getOtpAuthUriForAccountResponse(message.id));
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
        sendResponse(await lockVault('manual'));
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
    ensureSyncAutoUploadAlarm().catch(() => {});
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
    if(!alarm) return;
    if(alarm.name === VAULT_AUTO_LOCK_ALARM){
      lockVault('auto_timer_expired').catch(() => {});
      return;
    }
    if(alarm.name === SYNC_AUTO_UPLOAD_ALARM){
      (async () => {
        try {
          await runAutoUploadTick();
        } catch (err) {
          await appendDebugInfo('Sync auto upload alarm failed', {
            error: err && err.message ? err.message : String(err),
          });
        } finally {
          await scheduleNextSyncAutoUploadAlarm();
        }
      })().catch(() => {});
    }
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

ensureSyncAutoUploadAlarm().catch(() => {});
scheduleVaultAutoLock().catch(() => {});
refreshAutofillInjectionForOpenTabs().catch(() => {});
