// Karma config. The only reason this file exists is the headless launcher: the default
// ChromeHeadless drops its socket on locked-down Windows/CI hosts, so tests run through a
// no-sandbox launcher instead.
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
    ],
    reporters: ['progress'],
    browsers: ['ChromeHeadlessCI'],
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--headless=new',
          '--remote-debugging-port=9222',
        ],
      },
    },
    restartOnFileChange: true,
    // The socket drops under load on this host — a dropped ping is not a failing test, so
    // give it room to reconnect instead of reporting a red suite that passes on rerun.
    pingTimeout: 30_000,
    browserDisconnectTimeout: 20_000,
    browserDisconnectTolerance: 2,
    browserNoActivityTimeout: 60_000,
    captureTimeout: 120_000,
  });
};
