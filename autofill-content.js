// SPDX-License-Identifier: MIT
'use strict';

(() => {
  const browserApi = typeof browser !== 'undefined' ? browser : chrome;
  const state = {
    dropdown: null,
    activeInput: null,
    accounts: [],
    vaultLocked: false,
    timer: null,
    theme: 'auto',
    language: 'en',
  };
  const OTP_HINTS = ['otp','2fa','totp','token','code','verification','authenticator','mfa','one-time','one time','two-factor','2-step','two step'];
  const I18N = {
    en: {
      popupTitle: 'Vault2FA',
      popupSubtitle: 'Select a code to autofill',
      locked: '🔒Vault is locked',
      noRules: 'No autofill rules',
      fallbackAccount: 'Account',
    },
    zh: {
      popupTitle: 'Vault2FA',
      popupSubtitle: '选择验证码自动填充',
      locked: '🔒密码库未解锁',
      noRules: '未设置自动填充规则',
      fallbackAccount: '账号',
    },
  };

  function byId(id){ return document.getElementById(id); }
  function t(key){ return (I18N[state.language] && I18N[state.language][key]) || I18N.en[key] || key; }
  function setStateClass(el, base, level){ if(el) el.className = level ? `${base} ${level}` : base; }
  function getRemaining(period){ const p = Math.max(1, Number(period || 30)); const now = Date.now() / 1000; return Math.max(0, Math.ceil(p - (now % p)) % p || p); }
  function levelByRemaining(remaining){ return remaining <= 5 ? 'urgent' : remaining <= 10 ? 'warn' : ''; }
  function currentTheme(){
    if(state.theme === 'light' || state.theme === 'dark') return state.theme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  async function loadUiPrefs(){
    try {
      const result = await browserApi.storage.local.get(['uiTheme', 'uiLanguage']);
      state.theme = result.uiTheme || 'auto';
      state.language = result.uiLanguage === 'zh' ? 'zh' : 'en';
      if(state.dropdown) state.dropdown.dataset.theme = currentTheme();
    } catch(_) {}
  }

  function isOtpInput(input){
    if(!input || input.tagName !== 'INPUT') return false;
    if(['hidden','submit','button','checkbox','radio'].includes(String(input.type || '').toLowerCase())) return false;
    const parts = [input.name, input.id, input.placeholder, input.className, input.getAttribute('aria-label'), input.getAttribute('autocomplete')]
      .filter(Boolean).join(' ').toLowerCase();
    if(OTP_HINTS.some(token => parts.includes(token))) return true;
    const labels = [];
    if(input.id){
      const forLabel = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if(forLabel) labels.push(forLabel.textContent || '');
    }
    let parent = input.parentElement;
    while(parent && labels.length < 2){
      if(parent.tagName === 'LABEL') labels.push(parent.textContent || '');
      parent = parent.parentElement;
    }
    const labelText = labels.join(' ').toLowerCase();
    return OTP_HINTS.some(token => labelText.includes(token));
  }

  function ensureDropdown(){
    if(state.dropdown) return state.dropdown;
    const root = document.createElement('div');
    root.id = 'vault2fa-autofill';
    root.className = 'vault2fa-autofill';
    root.dataset.theme = currentTheme();
    root.style.display = 'none';
    document.documentElement.appendChild(root);
    state.dropdown = root;
    return root;
  }

  function positionDropdown(input){
    const dd = ensureDropdown();
    const rect = input.getBoundingClientRect();
    dd.style.top = `${window.scrollY + rect.bottom + 6}px`;
    dd.style.left = `${window.scrollX + rect.left}px`;
    dd.style.minWidth = `${Math.max(220, rect.width)}px`;
  }

  function stopTimer(){ if(state.timer){ clearInterval(state.timer); state.timer = null; } }

  function updateItemTimers(){
    if(!state.dropdown || state.dropdown.style.display !== 'block' || state.vaultLocked) return;
    const rows = state.dropdown.querySelectorAll('.vault2fa-autofill__item[data-period]');
    rows.forEach(row => {
      const period = Math.max(1, Number(row.dataset.period || 30));
      const ring = row.querySelector('.vault2fa-autofill__item-ring');
      const text = row.querySelector('.vault2fa-autofill__item-timer-text');
      if(!ring || !text) return;
      const remaining = getRemaining(period);
      const level = levelByRemaining(remaining);
      const circumference = 2 * Math.PI * 10;
      text.textContent = String(remaining);
      ring.style.strokeDashoffset = String(circumference * (1 - remaining / period));
      setStateClass(ring, 'vault2fa-autofill__item-ring', level);
      setStateClass(text, 'vault2fa-autofill__item-timer-text', level);
    });
  }

  function startTimer(){ stopTimer(); updateItemTimers(); state.timer = setInterval(updateItemTimers, 1000); }

  function hideDropdown(){
    if(state.dropdown) state.dropdown.style.display = 'none';
    state.activeInput = null;
    state.accounts = [];
    state.vaultLocked = false;
    stopTimer();
  }

  async function requestCode(account){
    const response = await browserApi.runtime.sendMessage({
      action: 'generateCodeForAutofill',
      secret: account.secret,
      type: account.type,
      digits: account.digits,
      period: account.period,
      counter: account.counter,
      algorithm: account.algorithm,
    });
    if(!response || !response.code) throw new Error('Failed to generate code.');
    return response.code;
  }

  function setNativeInputValue(input, value){
    const proto = input && input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if(descriptor && typeof descriptor.set === 'function') descriptor.set.call(input, value);
    else input.value = value;
  }

  function fireInputEvents(input){
    try {
      input.dispatchEvent(new InputEvent('beforeinput', { bubbles:true, cancelable:true, inputType:'insertText', data:String(input.value || '') }));
    } catch(_) {}
    input.dispatchEvent(new Event('input', { bubbles:true, composed:true }));
    input.dispatchEvent(new Event('change', { bubbles:true, composed:true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles:true, composed:true, key:'Enter' }));
  }

  async function fillAccount(account){
    if(!state.activeInput || state.vaultLocked) return;
    const input = state.activeInput;
    const code = await requestCode(account);
    input.focus();
    setNativeInputValue(input, code);
    fireInputEvents(input);
    hideDropdown();
  }

  function buildHeader(){
    const header = document.createElement('div');
    header.className = 'vault2fa-autofill__header';

    const title = document.createElement('div');
    title.className = 'vault2fa-autofill__title';
    title.textContent = t('popupTitle');

    const sub = document.createElement('div');
    sub.className = 'vault2fa-autofill__sub';
    sub.textContent = t('popupSubtitle');

    const left = document.createElement('div');
    left.append(title, sub);
    header.appendChild(left);
    return header;
  }

  function accountLabel(account){
    return [account.issuer || '', account.label || ''].filter(Boolean).join(' · ');
  }

  function buildLockedItem(){
    const item = document.createElement('div');
    item.className = 'vault2fa-autofill__locked';
    item.textContent = t('locked');
    return item;
  }

  function buildAccountItem(account){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vault2fa-autofill__item';

    const title = document.createElement('span');
    title.className = 'vault2fa-autofill__item-title';
    title.textContent = account.label || account.issuer || t('fallbackAccount');

    const sub = document.createElement('span');
    sub.className = 'vault2fa-autofill__item-sub';
    const patterns = Array.isArray(account.autofillPatterns) ? account.autofillPatterns : [];
    sub.textContent = patterns.length ? `${account.issuer || ''}${account.issuer ? ' · ' : ''}${patterns.join(', ')}` : (accountLabel(account) || t('noRules'));

    const timer = document.createElement('span');
    timer.className = 'vault2fa-autofill__item-timer';
    timer.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="vault2fa-autofill__item-ring-bg" cx="12" cy="12" r="10"></circle><circle class="vault2fa-autofill__item-ring" cx="12" cy="12" r="10"></circle></svg><span class="vault2fa-autofill__item-timer-text">--</span>';

    const period = Math.max(1, Number(account.period || 30));
    btn.dataset.period = String(period);
    btn.append(title, sub, timer);
    btn.addEventListener('mousedown', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      fillAccount(account).catch(() => hideDropdown());
    });
    return btn;
  }

  function renderDropdown(){
    if(!state.activeInput) return hideDropdown();
    const dd = ensureDropdown();
    dd.replaceChildren();
    dd.dataset.theme = currentTheme();
    dd.appendChild(buildHeader());

    if(state.vaultLocked){
      dd.appendChild(buildLockedItem());
      positionDropdown(state.activeInput);
      dd.style.display = 'block';
      stopTimer();
      return;
    }

    if(!state.accounts.length) return hideDropdown();

    for(const account of state.accounts){
      if(account.type === 'hotp') continue;
      dd.appendChild(buildAccountItem(account));
    }

    if(dd.children.length <= 1) return hideDropdown();
    positionDropdown(state.activeInput);
    dd.style.display = 'block';
    if(dd.querySelector('.vault2fa-autofill__item[data-period]')) startTimer();
    else stopTimer();
  }

  async function lookupAutofill(pageInfo){
    const response = await browserApi.runtime.sendMessage({
      action: 'getAccountsForAutofill',
      hostname: pageInfo && pageInfo.hostname ? pageInfo.hostname : '',
      url: pageInfo && pageInfo.url ? pageInfo.url : '',
    });
    return {
      accounts: response && Array.isArray(response.accounts) ? response.accounts : [],
      vaultLocked: !!(response && response.vaultLocked),
    };
  }

  async function onFocusIn(event){
    const input = event.target;
    if(!isOtpInput(input)) return;
    try {
      const result = await lookupAutofill({
        hostname: window.location.hostname || '',
        url: window.location.href || '',
      });
      state.activeInput = input;
      state.accounts = result.accounts;
      state.vaultLocked = result.vaultLocked;
      renderDropdown();
    } catch(_) {
      hideDropdown();
    }
  }

  function onDocClick(event){
    if(!state.dropdown || state.dropdown.style.display !== 'block') return;
    if(state.dropdown.contains(event.target) || event.target === state.activeInput) return;
    hideDropdown();
  }

  function onReposition(){
    if(state.dropdown && state.activeInput && state.dropdown.style.display === 'block') positionDropdown(state.activeInput);
  }

  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('click', onDocClick, true);
  window.addEventListener('scroll', onReposition, true);
  window.addEventListener('resize', onReposition);

  if(browserApi.storage && browserApi.storage.onChanged){
    browserApi.storage.onChanged.addListener((changes, areaName) => {
      if(areaName !== 'local') return;
      let shouldRerender = false;
      if(changes.uiTheme){
        state.theme = changes.uiTheme.newValue || 'auto';
        shouldRerender = true;
      }
      if(changes.uiLanguage){
        state.language = changes.uiLanguage.newValue === 'zh' ? 'zh' : 'en';
        shouldRerender = true;
      }
      if(shouldRerender && state.dropdown && state.dropdown.style.display === 'block') renderDropdown();
    });
  }

  if(window.matchMedia){
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onTheme = () => { if(state.dropdown) state.dropdown.dataset.theme = currentTheme(); };
    if(media.addEventListener) media.addEventListener('change', onTheme); else if(media.addListener) media.addListener(onTheme);
  }

  loadUiPrefs();
})();
