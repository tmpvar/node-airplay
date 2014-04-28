exports.Browser = require('./airplay/browser').Browser;
exports.createBrowser = function() {
  return new exports.Browser();
};

exports.Device = require('./airplay/device').Device;
exports.connect = function(host, port, opt_pass) {
  // TODO: connect
  return new exports.Device();
};
