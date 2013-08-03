var events = require('events');
var plist = require('plist');
var bplist = require('bplist-parser');
var util = require('util');

var Client = require('./client').Client;

var Device = function(id, info, opt_readyCallback) {
  var self = this;

  this.id = id;
  this.info_ = info;
  this.serverInfo_ = null;
  this.ready_ = false;

  var host = info.host;
  var port = info.port;
  var user = 'Airplay';
  var pass = '';
  this.client_ = new Client(host, port, user, pass, function() {
    // TODO: support passwords

    self.client_.get('/server-info', function(res) {
      var obj = plist.parseStringSync(res.body);
      var el = obj[0] || {};

      self.serverInfo_ = {
        deviceId: el.deviceid || undefined,
        features: el.features || undefined,
        model: el.model || undefined,
        protocolVersion: el.protovers || undefined,
        sourceVersion: el.srcvers || undefined
      };

      self.makeReady_(opt_readyCallback);
    });
  });
};
util.inherits(Device, events.EventEmitter);
exports.Device = Device;

Device.prototype.isReady = function() {
  return this.ready_;
};

Device.prototype.makeReady_ = function(opt_readyCallback) {
  this.ready_ = true;
  if (opt_readyCallback) {
    opt_readyCallback(this);
  }
  this.emit('ready');
};

Device.prototype.close = function() {
  if (this.client_) {
    this.client_.close();
  }
  this.client_ = null;
  this.ready_ = false;

  this.emit('close');
};

Device.prototype.getInfo = function() {
  var info = this.info_;
  var serverInfo = this.serverInfo_;
  return {
    id: this.id,
    name: info.serviceName,
    deviceId: info.host,
    features: serverInfo.features,
    model: serverInfo.model,
    slideshowFeatures: [],
    supportedContentTypes: []
  };
};

Device.prototype.getName = function() {
  return this.info_.serviceName;
};

Device.prototype.matchesInfo = function(info) {
  for (var key in info) {
    if (this.info_[key] != info[key]) {
      return false;
    }
  }
  return true;
};

Device.prototype.default = function(callback) {
  if (callback) {
    callback(this.getInfo());
  }
};

Device.prototype.status = function(callback) {
  this.client_.get('/playback-info', function(res) {
    if (res) {
      var obj = plist.parseStringSync(res.body);

      var el = obj[0] || {};
      var result = {
        duration: el.duration || undefined,
        position: el.position || undefined,
        rate: el.rate || undefined,
        playbackBufferEmpty: el.playbackBufferEmpty || undefined,
        playbackBufferFull: el.playbackBufferFull || undefined,
        playbackLikelyToKeepUp: el.playbackLikelyToKeepUp || undefined,
        readyToPlay: el.readyToPlay || undefined,
        loadedTimeRanges: el.loadedTimeRanges || undefined,
        seekableTimeRanges: el.seekableTimeRanges || undefined
      };
      if (callback) {
        callback(result);
      }

    } else {
      if (callback) {
        callback(null);
      }
    }
  });
};

Device.prototype.authorize = function(req, callback) {
  // TODO: implement authorize
  if (callback) {
   callback(null);
  }
};

Device.prototype.play = function(content, start, callback) {
  var body =
      'Content-Location: ' + content + '\n' +
      'Start-Position: ' + start + '\n';
  this.client_.post('/play', body, function(res) {
    if (callback) {
      callback(res ? {} : null);
    }
  });
};

Device.prototype.stop = function(callback) {
  this.client_.post('/stop', null, function(res) {
    if (callback) {
      callback(res ? {} : null);
    }
  });
};

Device.prototype.scrub = function(position, callback) {
  this.client_.post('/scrub?position=' + position, null, function(res) {
    if (callback) {
      callback(res ? {} : null);
    }
  });
};

Device.prototype.reverse = function(callback) {
  this.client_.post('/reverse', null, function(res) {
    if (callback) {
      callback(res ? {} : null);
    }
  })
};

Device.prototype.rate = function(value, callback) {
  this.client_.post('/rate?value=' + value, null, function(res) {
    if (callback) {
      callback(res ? {} : null);
    }
  })
};

Device.prototype.volume = function(value, callback) {
  this.client_.post('/volume?value=' + value, null, function(res) {
    if (callback) {
      callback(res ? {} : null);
    }
  })
};

Device.prototype.photo = function(req, callback) {
  // TODO: implement photo
  if (callback) {
    callback(null);
  }
};

Device.prototype.playbackAccessLog = function(callback) {
  this.client_.post('/getProperty?playbackAccessLog', null, function(res) {
    var bits = bplist.parseBuffer(res.buffer);
    if (bits && !bits.errorCode) {
      callback(null, bits[0].value[0]);
    } else {
      callback(new Error("error getting access log: " + bits.errorCode));
    }
  });
};
