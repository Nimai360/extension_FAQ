(function () {
  'use strict';
  const Config = {
    JSON_URL: 'https://atlas2.com.br/extension/faq.json',
    APP_VERSION: 'v1.0.5',
    DEFAULT_CONFIG: {
      input_xpath: '//*[@id="main"]/footer/div[1]/div/span/div/div[2]/div/div[3]/div[1]/p',
      send_xpath: '//*[@id="main"]/footer/div[1]/div/span/div/div[2]/div/div[4]/button',
      max_wait_ms: 4000
    },
    buildConfig(cfg) {
      const c = (typeof cfg === 'object' && cfg) ? cfg : {};
      const out = {
        input_xpath: String(c.input_xpath || this.DEFAULT_CONFIG.input_xpath),
        send_xpath: String(c.send_xpath || this.DEFAULT_CONFIG.send_xpath),
        max_wait_ms: Number.isFinite(Number(c.max_wait_ms)) ? Number(c.max_wait_ms) : this.DEFAULT_CONFIG.max_wait_ms,
      };
      if (out.max_wait_ms < 100) out.max_wait_ms = 100;
      if (out.max_wait_ms > 15000) out.max_wait_ms = 15000;
      return out;
    }
  };
  window.App = window.App || {};
  window.App.Config = Config;
})();
