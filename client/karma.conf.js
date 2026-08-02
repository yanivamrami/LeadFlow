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
  });
};
