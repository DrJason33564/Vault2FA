// SPDX-License-Identifier: MIT
'use strict';

(() => {
  const browserApi = typeof browser !== 'undefined' ? browser : chrome;
  const state = {
    dropdown: null,
    activeInput: null,
    accounts: [],
    timer: null,
    theme: 'auto',
    language: 'en',
    locked: false,
  };
  const OTP_HINTS = ['otp','2fa','totp','token','code','verification','authenticator','mfa','one-time','one time','two-factor','2-step','two step'];
  const I18N = {
    en: {
      titleMain: 'Vault',
      titleAccent: '2FA',
      subtitle: 'Select a code to autofill',
      accountFallback: 'Account',
      hotp: 'Counter-based (HOTP)',
      locked: '🔒Vault2FA is locked.',
    },
    zh: {
      titleMain: 'Vault',
      titleAccent: '2FA',
      subtitle: '选择验证码进行自动填充',
      accountFallback: '账号',
      hotp: '计数器模式（HOTP）',
      locked: '🔒Vault2FA已锁定',
    },
  };

  function byId(id){ return document.getElementById(id); }
  function t(key){ return (I18N[state.language] && I18N[state.language][key]) || I18N.en[key] || key; }
  function currentTheme(){
    if(state.theme === 'light' || state.theme === 'dark') return state.theme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function timerLevel(remaining){
    if(remaining == null) return '';
    if(remaining <= 5) return 'urgent';
    if(remaining <= 10) return 'warn';
    return '';
  }
  function setNodeState(el, baseClass, stateClass){
    if(!el) return;
    const value = (baseClass + (stateClass ? ' ' + stateClass : '')).trim();
    if(typeof el.className === 'string') el.className = value;
    else el.setAttribute('class', value);
  }
  function normalizeLanguage(value){ return value === 'zh' ? 'zh' : 'en'; }
  async function loadPreferences(){
    try {
      const result = await browserApi.storage.local.get(['uiTheme', 'uiLanguage']);
      state.theme = result.uiTheme || 'auto';
      state.language = normalizeLanguage(result.uiLanguage);
      if(state.dropdown){
        state.dropdown.dataset.theme = currentTheme();
        if(state.dropdown.style.display === 'block') renderDropdown();
      }
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
  async function tick(){
    if(!state.dropdown || state.dropdown.style.display !== 'block' || !state.activeInput) return;
    await refreshVisibleAccounts();
    updateItemTimers();
  }
  function startTimer(){
    stopTimer();
    state.timer = setInterval(() => { tick().catch(() => {}); }, 1000);
  }
  function hideDropdown(){
    if(state.dropdown) state.dropdown.style.display = 'none';
    state.activeInput = null;
    state.accounts = [];
    state.locked = false;
    stopTimer();
  }
  async function requestCode(account){
    const response = await browserApi.runtime.sendMessage({
      action: 'generateCodeForAutofillById',
      id: account.id,
      hostname: window.location.hostname || '',
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
    if(!state.activeInput) return;
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
    title.innerHTML = `${t('titleMain')} <em>${t('titleAccent')}</em>`;
    const sub = document.createElement('div');
    sub.className = 'vault2fa-autofill__sub';
    sub.textContent = t('subtitle');
    const left = document.createElement('div');
    left.append(title, sub);
    header.append(left);
    return header;
  }
  function accountLabel(account){
    return [account.issuer || '', account.label || ''].filter(Boolean).join(' · ');
  }
  function itemTimerTemplate(account){
    if(account.type === 'hotp'){
      const text = document.createElement('span');
      text.className = 'vault2fa-autofill__hotp';
      text.textContent = t('hotp');
      return text;
    }
    const wrap = document.createElement('div');
    wrap.className = 'vault2fa-autofill__timer';
    wrap.dataset.accountId = String(account.id);
    const ringId = `vault2fa-autofill-timer-ring-${String(account.id).replace(/\W/g, '_')}`;
    const textId = `vault2fa-autofill-timer-text-${String(account.id).replace(/\W/g, '_')}`;
    wrap.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="vault2fa-autofill__timer-bg" cx="12" cy="12" r="10"></circle><circle id="${ringId}" class="vault2fa-autofill__timer-ring" cx="12" cy="12" r="10"></circle></svg><span id="${textId}">30</span>`;
    return wrap;
  }
  function updateItemTimers(){
    for(const account of state.accounts){
      if(account.type === 'hotp') continue;
      const timer = state.dropdown && state.dropdown.querySelector(`.vault2fa-autofill__timer[data-account-id="${CSS.escape(String(account.id))}"]`);
      if(!timer) continue;
      const text = timer.querySelector('span');
      const ring = timer.querySelector('.vault2fa-autofill__timer-ring');
      const remaining = Number(account.remaining || 0);
      const period = Math.max(1, Number(account.codePeriod || account.period || 30));
      const level = timerLevel(remaining);
      const circumference = 2 * Math.PI * 10;
      if(text) text.textContent = String(remaining);
      if(ring){
        ring.style.strokeDashoffset = String(circumference * (1 - remaining / period));
        setNodeState(ring, 'vault2fa-autofill__timer-ring', level);
      }
    }
  }
  function showLockedDropdown(input){
    const dd = ensureDropdown();
    dd.replaceChildren();
    dd.dataset.theme = currentTheme();
    const header = buildHeader();
    const locked = document.createElement('div');
    locked.className = 'vault2fa-autofill__locked';
    locked.textContent = t('locked');
    dd.append(header, locked);
    state.activeInput = input;
    state.accounts = [];
    state.locked = true;
    positionDropdown(input);
    dd.style.display = 'block';
    stopTimer();
  }
  function renderDropdown(){
    if(!state.activeInput) return;
    if(state.locked) return showLockedDropdown(state.activeInput);
    const accounts = state.accounts;
    if(!accounts.length) return hideDropdown();
    const dd = ensureDropdown();
    dd.replaceChildren();
    dd.dataset.theme = currentTheme();
    dd.appendChild(buildHeader());
    for(const account of accounts){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vault2fa-autofill__item';

      const body = document.createElement('div');
      body.className = 'vault2fa-autofill__item-body';
      const textWrap = document.createElement('div');
      textWrap.className = 'vault2fa-autofill__item-text';
      const title = document.createElement('span');
      title.className = 'vault2fa-autofill__item-title';
      title.textContent = account.label || account.issuer || t('accountFallback');
      const sub = document.createElement('span');
      sub.className = 'vault2fa-autofill__item-sub';
      const patterns = Array.isArray(account.autofillPatterns) ? account.autofillPatterns : [];
      sub.textContent = patterns.length ? `${account.issuer || ''}${account.issuer ? ' · ' : ''}${patterns.join(', ')}` : accountLabel(account);
      textWrap.append(title, sub);
      body.append(textWrap, itemTimerTemplate(account));
      btn.append(body);

      btn.addEventListener('mousedown', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        fillAccount(account).catch(() => hideDropdown());
      });
      dd.appendChild(btn);
    }
    positionDropdown(state.activeInput);
    dd.style.display = 'block';
    updateItemTimers();
    startTimer();
  }
  async function lookupAccounts(hostname){
    const response = await browserApi.runtime.sendMessage({ action: 'getAccountsForAutofill', hostname });
    return {
      locked: !!(response && response.locked),
      accounts: response && Array.isArray(response.accounts) ? response.accounts : [],
    };
  }
  async function refreshVisibleAccounts(){
    if(!state.activeInput || !state.dropdown || state.dropdown.style.display !== 'block') return;
    const hostname = window.location.hostname || '';
    const response = await lookupAccounts(hostname);
    if(response.locked){
      state.locked = true;
      state.accounts = [];
      renderDropdown();
      return;
    }
    state.locked = false;
    state.accounts = response.accounts;
    if(!state.accounts.length){
      hideDropdown();
      return;
    }
    const idSet = new Set(Array.from(state.dropdown.querySelectorAll('.vault2fa-autofill__timer[data-account-id]')).map(el => el.dataset.accountId));
    const shouldRerender = idSet.size !== state.accounts.filter(acc => acc.type !== 'hotp').length;
    if(shouldRerender) renderDropdown();
  }
  async function onFocusIn(event){
    const input = event.target;
    if(!isOtpInput(input)) return;
    state.activeInput = input;
    try {
      const response = await lookupAccounts(window.location.hostname || '');
      if(response.locked){
        showLockedDropdown(input);
        return;
      }
      state.locked = false;
      state.accounts = response.accounts;
      if(state.accounts.length) renderDropdown();
      else hideDropdown();
    } catch(_) { hideDropdown(); }
  }
  function onDocClick(event){
    if(!state.dropdown || state.dropdown.style.display !== 'block') return;
    if(state.dropdown.contains(event.target) || event.target === state.activeInput) return;
    hideDropdown();
  }
  function onReposition(){ if(state.dropdown && state.activeInput && state.dropdown.style.display === 'block') positionDropdown(state.activeInput); }

  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('click', onDocClick, true);
  window.addEventListener('scroll', onReposition, true);
  window.addEventListener('resize', onReposition);
  if(browserApi.storage && browserApi.storage.onChanged){
    browserApi.storage.onChanged.addListener((changes, area) => {
      if(area !== 'local') return;
      let changed = false;
      if(changes.uiTheme){
        state.theme = changes.uiTheme.newValue || 'auto';
        changed = true;
      }
      if(changes.uiLanguage){
        state.language = normalizeLanguage(changes.uiLanguage.newValue);
        changed = true;
      }
      if(changed && state.dropdown && state.dropdown.style.display === 'block') renderDropdown();
    });
  }
  if(window.matchMedia){
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onTheme = () => {
      if(state.dropdown) state.dropdown.dataset.theme = currentTheme();
    };
    if(media.addEventListener) media.addEventListener('change', onTheme); else if(media.addListener) media.addListener(onTheme);
  }
  loadPreferences();
})();
