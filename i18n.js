// SPDX-License-Identifier: MIT
'use strict';

(() => {
  const cache = new Map();

  function normalizeLanguage(value){
    return String(value || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }

  function localeIdFromLanguage(language){
    return normalizeLanguage(language) === 'zh' ? 'zh-CN' : 'en-US';
  }

  function decodeValue(raw){
    return String(raw || '')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\=/g, '=')
      .replace(/\\\\/g, '\\');
  }

  function parseLangText(text){
    const sections = {};
    let current = null;
    for(const lineRaw of String(text || '').split(/\r?\n/)){
      const line = lineRaw.trim();
      if(!line || line.startsWith(';') || line.startsWith('#')) continue;
      const sectionMatch = line.match(/^\[([^\]]+)\]$/);
      if(sectionMatch){
        current = sectionMatch[1].trim();
        if(!sections[current]) sections[current] = {};
        continue;
      }
      const eq = line.indexOf('=');
      if(eq < 0 || !current) continue;
      const key = line.slice(0, eq).trim();
      const value = decodeValue(line.slice(eq + 1));
      if(key) sections[current][key] = value;
    }
    return sections;
  }

  async function loadLocaleById(localeId){
    if(cache.has(localeId)) return cache.get(localeId);
    const url = browser.runtime.getURL(`locales/${localeId}.lang`);
    const promise = fetch(url)
      .then(resp => {
        if(!resp || !resp.ok) throw new Error(`Failed to load locale file: ${localeId}`);
        return resp.text();
      })
      .then(parseLangText)
      .catch(() => ({}));
    cache.set(localeId, promise);
    return promise;
  }

  async function getSection(sectionName, language){
    const localeId = localeIdFromLanguage(language);
    const data = await loadLocaleById(localeId);
    return Object.assign({}, (data && data[sectionName]) || {});
  }

  window.Vault2FALocales = {
    normalizeLanguage,
    localeIdFromLanguage,
    loadLocaleById,
    getSection,
  };
})();
