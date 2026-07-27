// SPDX-License-Identifier: MIT
'use strict';

// Some shared scripts expose helpers on `window` when running in Firefox's
// background page. Map that name to the worker global in Chromium.
globalThis.window = globalThis;

importScripts(
  '../third-party/polyfill.min.js',
  '../third-party/otpauth.min.js',
  '../locales/i18n.js',
  'debug.js',
  'storage-vault.js',
  '../migration/google.js',
  'otp-account.js',
  'qr-background.js',
  'sync.js',
  'autofill-background.js',
  'context-menu.js',
  'background.js'
);
