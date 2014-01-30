var events = require('events');
var plist = require('plist');
var bplist = require('bplist-parser');
var util = require('util');

var Client = require('./client').Client;

var parsePlist = function(res, callback) {
  if (res && res.headers && res.headers['Content-Type']) {
    if (res.statusCode === 200) {

      var contentType = res.headers['Content-Type'];
      if (contentType === 'application/x-apple-binary-plist') {
        callback(null, bplist.parseBuffer(res.buffer));
      } else if (contentType === 'text/x-apple-plist+xml') {
        callback(null, plist.parseStringSync(res.body));
      } else {
        callback(new Error('unknown content-type:' + contentType));
      }

    } else {
      callback(new Error('request failed with status code: ' + res.statusCode));
    }
  } else {

    callback(new Error('invalid response (' + res.statusCode + ')\n' + JSON.stringify(res, null, '  ')));
  }
};

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
  this.client_ = new Client(host, port, user, pass, function(err) {
    if (!!err) return opt_readyCallback(err, null);

    // TODO: support passwords

    self.client_.get('/server-info', function(err, res) {
      parsePlist(res, function(e, obj) {
        if (e) {
          throw e;
        }

        var el = obj || {};

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
    opt_readyCallback(null, this);
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
  this.client_.get('/playback-info', function(err, res) {
    if (!!err) return callback(err);

    parsePlist(res, function(e, obj) {
      if (e) {
        return callback(e);
      }

      if (obj) {
        var el = obj || {};
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
          callback(null, result);
        }

      } else {
        if (callback) {
          callback(new Error('invalid response object'));
        }
      }
    });
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
  this.client_.post('/play', body, function(err, res) {
    if (callback) {
      callback(err, res ? {} : null);
    }
  });
};

Device.prototype.stop = function(callback) {
  this.client_.post('/stop', null, function(err, res) {
    if (callback) {
      callback(err, res ? {} : null);
    }
  });
};

Device.prototype.scrub = function(position, callback) {
  this.client_.post('/scrub?position=' + position, null, function(err, res) {
    if (callback) {
      callback(err, res ? {} : null);
    }
  });
};

Device.prototype.reverse = function(callback) {
  this.client_.post('/reverse', null, function(err, res) {
    if (callback) {
      callback(err, res ? {} : null);
    }
  });
};

Device.prototype.rate = function(value, callback) {
  this.client_.post('/rate?value=' + value, null, function(err, res) {
    if (callback) {
      callback(err, res ? {} : null);
    }
  });
};

Device.prototype.volume = function(value, callback) {
  this.client_.post('/volume?value=' + value, null, function(err, res) {
    if (callback) {
      callback(err, res ? {} : null);
    }
  });
};

Device.prototype.photo = function(req, callback) {
  // TODO: implement photo
  if (callback) {
    callback(null);
  }
};

Device.prototype.playbackAccessLog = function(callback) {
  this.client_.post('/getProperty?playbackAccessLog', null, function(err, res) {
    if (!!err) return callback(err, null);

    parsePlist(res, function(e, bits) {
      if (e) return callback(e);
      if (bits && bits[0]) {
        if (bits.errorCode) {
          callback(new Error("error getting access log: " + bits.errorCode));
        } else if (bits[0].value && bits[0].value[0]) {
          callback(null, bits[0].value[0]);
        } else {
          callback(new Error('invalid status' + JSON.stringify(bits[0])));
        }
      } else {
        callback(new Error('failed to retrieve status'));
      }
    });
  });
};
