var buffer = require('buffer');
var events = require('events');
var net = require('net');
var util = require('util');

var Client = function(host, port, user, pass, callback) {
  var self = this;

  this.host_ = host;
  this.port_ = port;
  this.user_ = user;
  this.pass_ = pass;

  this.responseWaiters_ = [];

  this.socket_ = net.createConnection(port, host);
  this.socket_.on('connect', function() {
    self.responseWaiters_.push({
      callback: callback
    });
    self.socket_.write(
        'GET /playback-info HTTP/1.1\n' +
        'User-Agent: MediaControl/1.0\n' +
        'Content-Length: 0\n' +
        '\n');
  });

  this.queue = null;

  this.socket_.on('data', function(data) {

    if (self.queue) {
      data = Buffer.concat(self.queue, data);
      self.queue = null;
    }

    var res = self.parseResponse_(data);

    if (res) {
      var waiter = self.responseWaiters_.shift();
      if (waiter.callback) {
        waiter.callback(res);
      }
    } else {
      self.queue = data;
    }
  });
};
util.inherits(Client, events.EventEmitter);
exports.Client = Client;

Client.prototype.close = function() {
  if (this.socket_) {
    this.socket_.destroy();
  }
  this.socket_ = null;
};

Client.prototype.parseResponse_ = function(res) {
  // Look for HTTP response:
  // HTTP/1.1 200 OK
  // Some-Header: value
  // Content-Length: 427
  // \n
  // body (427 bytes)
  var buffer = res;
  res = res.toString();
  var header = res;
  var body = '';
  var splitPoint = res.indexOf('\r\n\r\n');
  if (splitPoint != -1) {
    header = res.substr(0, splitPoint);
    body = res.substr(splitPoint + 4);
  } else {
    return false;
  }

  // Normalize header \r\n -> \n
  header = header.replace(/\r\n/g, '\n');

  // Peel off status
  var status = header.substr(0, header.indexOf('\n'));
  var statusMatch = status.match(/HTTP\/1.1 ([0-9]+) (.+)/);
  header = header.substr(status.length + 1);

  // Parse headers
  var allHeaders = {};
  var headerLines = header.split('\n');
  for (var n = 0; n < headerLines.length; n++) {
    var headerLine = headerLines[n];
    var key = headerLine.substr(0, headerLine.indexOf(':'));
    var value = headerLine.substr(key.length + 2);
    allHeaders[key] = value;
  }

  // still awaiting another packet...
  var expectedLength = parseInt(allHeaders['Content-Length'], 10);
  buffer = buffer.slice(splitPoint+4);

  if (expectedLength > body.length) {
    return false;
  } else if (body.length > expectedLength) {
    var end = expectedLength;
    this.queue = buffer.slice(expectedLength);
    body = buffer.toString('utf8', 0, expectedLength);
    buffer = buffer.slice(0, expectedLength);
  }

  return {
    statusCode: parseInt(statusMatch[1]),
    statusReason: statusMatch[2],
    headers: allHeaders,
    body: body.trim(),
    buffer: buffer
  };
};

Client.prototype.issue_ = function(req, body, callback) {
  if (!this.socket_) {
    util.puts('client not connected');
    return;
  }

  req.headers = req.headers || {};
  req.headers['User-Agent'] = 'MediaControl/1.0';
  req.headers['Content-Length'] = body ? buffer.Buffer.byteLength(body) : 0;
  req.headers['Connection'] = 'keep-alive';

  var allHeaders = '';
  for (var key in req.headers) {
    allHeaders += key + ': ' + req.headers[key] + '\n';
  }

  var text =
      req.method + ' ' + req.path + ' HTTP/1.1\n' +
      allHeaders + '\n';
  if (body) {
    text += body;
  }

  this.responseWaiters_.push({
    callback: callback
  });
  this.socket_.write(text);
};

Client.prototype.get = function(path, callback) {
  var req = {
    method: 'GET',
    path: path,
  };
  this.issue_(req, null, callback);
};

Client.prototype.post = function(path, body, callback) {
  var req = {
    method: 'POST',
    path: path,
  };
  this.issue_(req, body, callback);
};
