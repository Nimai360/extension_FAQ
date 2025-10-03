(function () {
  "use strict";
  const Config = {
    JSON_URL: "https://atlas2.com.br/extension/faq.json",
    APP_VERSION: "v1.0.7",
    DEFAULT_CONFIG: {
      input_xpath: '//*[@id="main"]/footer/div[1]/div/span/div/div[2]/div/div[3]/div[1]/p',
      send_xpath: '//*[@id="main"]/footer/div[1]/div/span/div/div[2]/div/div[4]/button',
      max_wait_ms: 4000,
      // Novos campos para detecção de nome e telefone
      name_xpath:
        "//*[@id='main']/header/div[2]/div/div/div/div/span | //*[@id='app']/div[1]/div[3]/div/div[5]/span/div/span/div/div/section/div[1]/div[2]/div[1]/div/div/span",
      phone_xpath:
        "//*[@id='app']/div[1]/div[3]/div/div[5]/span/div/span/div/div/section/div[1]/div[2]/div[2]/span/div | //*[@id='app']/div[1]/div[3]/div/div[5]/span/div/span/div/div/section/div[11]/div[3]/div/div/span/span",
      watcher_interval_ms: 500,
    },
    buildConfig(cfg) {
      const c = typeof cfg === "object" && cfg ? cfg : {};
      const out = {
        input_xpath: String(c.input_xpath || this.DEFAULT_CONFIG.input_xpath),
        send_xpath: String(c.send_xpath || this.DEFAULT_CONFIG.send_xpath),
        max_wait_ms: Number.isFinite(Number(c.max_wait_ms)) ? Number(c.max_wait_ms) : this.DEFAULT_CONFIG.max_wait_ms,
        name_xpath: String(c.name_xpath || this.DEFAULT_CONFIG.name_xpath),
        phone_xpath: String(c.phone_xpath || this.DEFAULT_CONFIG.phone_xpath),
        watcher_interval_ms: Number.isFinite(Number(c.watcher_interval_ms))
          ? Number(c.watcher_interval_ms)
          : this.DEFAULT_CONFIG.watcher_interval_ms,
      };
      if (out.max_wait_ms < 100) out.max_wait_ms = 100;
      if (out.max_wait_ms > 15000) out.max_wait_ms = 15000;
      if (out.watcher_interval_ms < 100) out.watcher_interval_ms = 100;
      if (out.watcher_interval_ms > 10000) out.watcher_interval_ms = 10000;
      return out;
    },
  };
  window.App = window.App || {};
  window.App.Config = Config;
})();
