// SPDX-License-Identifier: MIT
'use strict';

(() => {
  const cache = new Map();
  let localeIndexPromise = null;
  const DEFAULT_LOCALE_ID = 'en-US';

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

  function parseLangConfigText(text){
    const ids = [];
    for(const rawLine of String(text || '').split(/\r?\n/)){
      const line = rawLine.trim();
      if(!line || line.startsWith('#') || line.startsWith(';')) continue;
      const localeId = normalizeLocaleCandidate(line.replace(/\.lang$/i, ''));
      if(localeId) ids.push(localeId);
    }
    return Array.from(new Set(ids));
  }

  async function listLocaleIdsViaConfig(){
    try {
      const url = browser.runtime.getURL('locales/lang.conf');
      const resp = await fetch(url);
      if(!resp || !resp.ok) return [];
      const text = await resp.text();
      return parseLangConfigText(text);
    } catch (_) {
      return [];
    }
  }

  function normalizeLocaleCandidate(value){
    const raw = String(value || '').trim();
    if(!raw) return '';
    if(raw.includes('-')){
      const [lang, region] = raw.split('-');
      if(!lang) return raw;
      if(!region) return lang.toLowerCase();
      return `${lang.toLowerCase()}-${region.toUpperCase()}`;
    }
    return raw.toLowerCase();
  }

  function readDirectoryEntries(dirEntry){
    return new Promise((resolve, reject) => {
      const reader = dirEntry.createReader();
      const all = [];
      function readBatch(){
        reader.readEntries((entries) => {
          if(!entries || !entries.length){
            resolve(all);
            return;
          }
          all.push(...entries);
          readBatch();
        }, reject);
      }
      readBatch();
    });
  }

  async function listLocaleIdsViaPackageDirectory(){
    if(!browser.runtime || typeof browser.runtime.getPackageDirectoryEntry !== 'function') return [];
    const root = await new Promise((resolve, reject) => {
      browser.runtime.getPackageDirectoryEntry((entry) => {
        if(entry) resolve(entry);
        else reject(new Error('Package directory entry unavailable.'));
      });
    });
    const queue = [{ entry: root, path: '' }];
    const localeIds = new Set();
    while(queue.length){
      const { entry, path } = queue.shift();
      if(!entry || typeof entry.isDirectory !== 'boolean') continue;
      if(entry.isDirectory){
        const children = await readDirectoryEntries(entry);
        for(const child of children){
          const childPath = path ? `${path}/${child.name}` : child.name;
          queue.push({ entry: child, path: childPath });
        }
        continue;
      }
      if(!entry.isFile) continue;
      if(!/^locales\/.+\.lang$/i.test(path)) continue;
      const name = path.split('/').pop() || '';
      if(!name || name.toLowerCase() === 'i18n.js') continue;
      localeIds.add(name.replace(/\.lang$/i, ''));
    }
    return Array.from(localeIds);
  }

  async function discoverLocaleIds(){
    if(localeIndexPromise) return localeIndexPromise;
    localeIndexPromise = (async () => {
      const result = new Set();
      try {
        const configIds = await listLocaleIdsViaConfig();
        if(configIds.length){
          for(const localeId of configIds) result.add(localeId);
          const finalFromConfig = Array.from(result);
          try {
            console.info('[Vault2FA][i18n] discovered locale ids from lang.conf:', finalFromConfig);
          } catch (_) {}
          return finalFromConfig;
        }
      } catch (_) {}
      try {
        const listedFromPackage = await listLocaleIdsViaPackageDirectory();
        for(const localeId of listedFromPackage) result.add(normalizeLocaleCandidate(localeId));
      } catch (_) {}
      try {
        const url = browser.runtime.getURL('locales/');
        const resp = await fetch(url);
        if(!resp || !resp.ok) throw new Error('Cannot read locales directory.');
        const html = await resp.text();
        const listed = parseDirectoryLocaleIds(html);
        for(const localeId of listed) result.add(normalizeLocaleCandidate(localeId));
      } catch (_) {}
      const finalList = Array.from(result);
      try {
        console.info('[Vault2FA][i18n] discovered locale ids:', finalList);
      } catch (_) {}
      return finalList;
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
