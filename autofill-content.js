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
  };
  const OTP_HINTS = ['otp','2fa','totp','token','code','verification','authenticator','mfa','one-time','one time','two-factor','2-step','two step'];

  function byId(id){ return document.getElementById(id); }
  function getRemaining(){ const now = Math.floor(Date.now() / 1000); return 30 - (now % 30) || 30; }
  function currentTheme(){
    if(state.theme === 'light' || state.theme === 'dark') return state.theme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  async function loadTheme(){
    try {
      const result = await browserApi.storage.local.get('uiTheme');
      state.theme = result.uiTheme || 'auto';
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
    return labels.join(' ').toLowerCase().split(/\s+/).some((_,i,arr)=>OTP_HINTS.some(token=>labels.join(' ').toLowerCase().includes(token)));
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
  function updateTimer(){
    const text = byId('vault2fa-autofill-timer-text');
    const ring = byId('vault2fa-autofill-timer-ring');
    if(!text || !ring) return;
    const remaining = getRemaining();
    const circumference = 2 * Math.PI * 10;
    text.textContent = String(remaining);
    ring.style.strokeDashoffset = String(circumference * (1 - remaining / 30));
  }
  function startTimer(){ stopTimer(); updateTimer(); state.timer = setInterval(updateTimer, 1000); }
  function hideDropdown(){
    if(state.dropdown) state.dropdown.style.display = 'none';
    state.activeInput = null;
    state.accounts = [];
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
    title.textContent = 'Vault2FA';
    const sub = document.createElement('div');
    sub.className = 'vault2fa-autofill__sub';
    sub.textContent = 'Select a code to autofill';
    const left = document.createElement('div');
    left.append(title, sub);
    const timer = document.createElement('div');
    timer.className = 'vault2fa-autofill__timer';
    timer.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="vault2fa-autofill__timer-bg" cx="12" cy="12" r="10"></circle><circle id="vault2fa-autofill-timer-ring" class="vault2fa-autofill__timer-ring" cx="12" cy="12" r="10"></circle></svg><span id="vault2fa-autofill-timer-text">30</span>';
    header.append(left, timer);
    return header;
  }
  function accountLabel(account){
    return [account.issuer || '', account.label || ''].filter(Boolean).join(' · ');
  }
  function showDropdown(input, accounts){
    if(!accounts.length) return hideDropdown();
    const dd = ensureDropdown();
    dd.replaceChildren();
    dd.dataset.theme = currentTheme();
    state.activeInput = input;
    state.accounts = accounts;
    dd.appendChild(buildHeader());
    for(const account of accounts){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vault2fa-autofill__item';
      const title = document.createElement('span');
      title.className = 'vault2fa-autofill__item-title';
      title.textContent = account.label || account.issuer || 'Account';
      const sub = document.createElement('span');
      sub.className = 'vault2fa-autofill__item-sub';
      const patterns = Array.isArray(account.autofillPatterns) ? account.autofillPatterns : [];
      sub.textContent = patterns.length ? `${account.issuer || ''}${account.issuer ? ' · ' : ''}${patterns.join(', ')}` : accountLabel(account);
      btn.append(title, sub);
      btn.addEventListener('mousedown', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        fillAccount(account).catch(() => hideDropdown());
      });
      dd.appendChild(btn);
    }
    positionDropdown(input);
    dd.style.display = 'block';
    startTimer();
  }
  async function lookupAccounts(hostname){
    const response = await browserApi.runtime.sendMessage({ action: 'getAccountsForAutofill', hostname });
    return response && Array.isArray(response.accounts) ? response.accounts : [];
  }
  async function onFocusIn(event){
    const input = event.target;
    if(!isOtpInput(input)) return;
    try {
      const accounts = await lookupAccounts(window.location.hostname || '');
      if(accounts.length) showDropdown(input, accounts);
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
  if(window.matchMedia){
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onTheme = () => { if(state.dropdown) state.dropdown.dataset.theme = currentTheme(); };
    if(media.addEventListener) media.addEventListener('change', onTheme); else if(media.addListener) media.addListener(onTheme);
  }
  loadTheme();
})();
