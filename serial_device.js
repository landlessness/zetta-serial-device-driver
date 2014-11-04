var Device = require('zetta-device');
var util = require('util');
var async = require('async');

var SerialDevice = module.exports = function() {
  Device.call(this);
  this._serialPort = arguments[0];

  this._serialPort.on('data', function(data) {
    console.log('RAW ===\n\n' + data + '\n\n=== RAW');
  });
  
};
util.inherits(SerialDevice, Device);

SerialDevice.prototype.init = function(config) {
  var self = this;
  config
  .name('Serial Device')
  .type('serial')
  .state('waiting')
  .when('waiting', { allow: ['write', 'parse']})
  .when('writing', { allow: ['write', 'parse']})
  .when('parsing', { allow: ['write', 'parse']})
  .map('write', this.write, [
    { name: 'command', type: 'text'}])
  .map('parse', this.parse, [
    { name: 'data', type: 'text'},
    { name: 'regexp', type: 'text'}]);

  this._setupWriteParseQueue(function() {});
};

SerialDevice.prototype.write = function(command, cb) {
  this.state = 'writing';
  var self = this;
  this.log('command: ' + command);
  this.log('command (encoded): ' + encodeURI(command));
  this._serialPort.write(command, function(err, results) {
    if (typeof err !== 'undefined') {
      self.log('write err ' + err);
      self.log('write results ' + results);
    }
  });
  this.state = 'waiting';
  cb();
};

SerialDevice.prototype.parse = function(data, regexp, cb) {
  this.state = 'parsing';
  this.log('parsing data: "' + data + '"');
  this.log('parsing regexp: "' + regexp + '"');
  var match = data.match(regexp);
  if (!!match) {
    this.log('match: true');
  } else {
    this.log('failed match on data: ' + data);
    this.log('with regexp: ' + this._regexps[this._regexpIndex].toString());
    this.log('URI encoded data: ' + encodeURI(data));
    throw new Error('failed match');
  }
  this.state = 'waiting';
  this.log('match: ' + match);
  cb(null, match);
};

SerialDevice.prototype._setupWriteParseQueue = function(cb) {

  var self = this;
  
  this._q = async.priorityQueue(function (task, callback) {
    self._regexpIndex = 0;
    self._regexps = task.regexps;
    self._matches = [];
    self._callback = callback;

    // Prepare to Parse
    self.log('add serial port listener');
    self._serialPort.on('data', parseData);
     
    // Write
    if (!!task.rawCommand) {
      self.call('write', task.rawCommand);
    } else {
      self.call('write', task.command + "\n\r");
    }

  }, 1);


  // Parse
  var parseData = function(data) {
    self.log('parseData');
    var regexp = self._regexps[self._regexpIndex];
    self.call('parse', data, regexp, function(err, match) {
      self.log('add match to matches array');
      console.log('match: ', match);
      self._matches.push(match);
      self._regexpIndex++;
      if (self._regexpIndex >= self._regexps.length) {
        self.log('remove serial port listener');
        self._serialPort.removeListener('data', parseData);
        console.log('matches: ', self._matches);
        self._callback(self._matches);
      }
    });
  }

  cb();
}

SerialDevice.prototype.enqueue = function(command, cb) {
  var self = this;
  this._q.push(
    command,
    1,
    function (err) {
      var matches = arguments[0];
      cb(matches);
    });
  this.log(
    'queue #length: ' + this._q.length() +
    ' #started: ' + this._q.started +
    ' #running: ' + this._q.running() +
    ' #idle: ' + this._q.idle() +
    ' #concurrency: ' + this._q.concurrency +
    ' #paused: ' + this._q.paused
  );
}

SerialDevice.prototype.enqueueSimple = function(command, regexp, cb) {
  this.enqueue({
    command: command, 
    regexps: [new RegExp(RegExp.quote(command) + '\\s*'), regexp, /^$/, /OK/]},
    function (matches) {
      cb(matches);
    });
}

RegExp.quote = function(str) {
    return (str+'').replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
};