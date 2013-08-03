var airplay = require('../lib/airplay');
var b = airplay.createBrowser();

b.on('deviceOnline', function(deviceInfo) {

  var device = new airplay.Device(deviceInfo.id, deviceInfo.info_, function() {
    device.play('http://download.ted.com/talks/JulieTaymor_2011.mp4?apikey=TEDDOWNLOAD', 0, console.log);
    setTimeout(function() {

      device.playbackAccessLog(console.log);

    }, 2000);
  });
});

b.start();