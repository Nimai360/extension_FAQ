(function () {
  'use strict';
  const State = {
    STORAGE_KEY_MODE: 'faq_atlas_mode',
    STORAGE_KEY_THEME: 'faq_atlas_theme',
    cacheData: null,
    currentMode: '',
    currentList: [],
    currentConfig: null,

    setCacheData(d) { this.cacheData = d; },
    getCacheData() { return this.cacheData; },

    setCurrentMode(m) { this.currentMode = String(m || ''); try { localStorage.setItem(this.STORAGE_KEY_MODE, this.currentMode); } catch (_) {} },
    getCurrentMode() { return this.currentMode; },
    loadMode() { try { return localStorage.getItem(this.STORAGE_KEY_MODE) || ''; } catch (_) { return ''; } },

    setCurrentList(list) { this.currentList = Array.isArray(list) ? list : []; },
    getCurrentList() { return this.currentList; },

    setCurrentConfig(c) { this.currentConfig = c; },
    getCurrentConfig() { return this.currentConfig; },

    saveTheme(t) { try { localStorage.setItem(this.STORAGE_KEY_THEME, t); } catch (_) {} },
    loadTheme() { try { return localStorage.getItem(this.STORAGE_KEY_THEME) || 'light'; } catch (_) { return 'light'; } },
  };
  window.App = window.App || {};
  window.App.State = State;
})();
