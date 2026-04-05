// SPDX-License-Identifier: MIT
'use strict';

(() => {
  const cache = new Map();
  let localeIndexPromise = null;
  const DEFAULT_LOCALE_ID = 'en-US';
  const FALLBACK_LOCALE_IDS = ['en-US', 'zh-CN'];

  function normalizeLanguage(value){
    return String(value || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }

  function localeIdFromLanguage(language){
    const raw = String(language || '').trim();
    if(raw.includes('-')) return raw;
    return normalizeLanguage(raw) === 'zh' ? 'zh-CN' : DEFAULT_LOCALE_ID;
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

  function parseDirectoryLocaleIds(html){
    const ids = new Set();
    const regex = /href\s*=\s*["']([^"']+\.lang)["']/ig;
    let match;
    while((match = regex.exec(String(html || '')))){
      const href = decodeURIComponent(match[1] || '');
      const fileName = href.split('/').pop() || '';
      if(!/\.lang$/i.test(fileName)) continue;
      ids.add(fileName.replace(/\.lang$/i, ''));
    }
    return Array.from(ids);
  }

  async function discoverLocaleIds(){
    if(localeIndexPromise) return localeIndexPromise;
    localeIndexPromise = (async () => {
      try {
        const url = browser.runtime.getURL('locales/');
        const resp = await fetch(url);
        if(!resp || !resp.ok) throw new Error('Cannot read locales directory.');
        const html = await resp.text();
        const listed = parseDirectoryLocaleIds(html);
        if(listed.length) return listed;
      } catch (_) {}
      return FALLBACK_LOCALE_IDS.slice();
    })();
    return localeIndexPromise;
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
    const section = Object.assign({}, (data && data[sectionName]) || {});
    if(Object.keys(section).length) return section;
    if(localeId !== DEFAULT_LOCALE_ID){
      const fallback = await loadLocaleById(DEFAULT_LOCALE_ID);
      return Object.assign({}, (fallback && fallback[sectionName]) || {});
    }
    return section;
  }

  async function getAvailableLanguages(){
    const localeIds = await discoverLocaleIds();
    const list = [];
    for(const localeId of localeIds){
      const parsed = await loadLocaleById(localeId);
      const info = (parsed && parsed.Information) || {};
      const language = (parsed && parsed.Language) || {};
      if(!language.LOCALE_ID && !localeId) continue;
      list.push({
        localeId: language.LOCALE_ID || localeId,
        language: language.LANGUAGE || localeId,
        translator: info.TRANSLATOR || '',
        version: info.VERSION || '',
      });
    }
    return list;
  }

  window.Vault2FALocales = {
    DEFAULT_LOCALE_ID,
    normalizeLanguage,
    localeIdFromLanguage,
    loadLocaleById,
    getSection,
    discoverLocaleIds,
    getAvailableLanguages,
  };
})();
