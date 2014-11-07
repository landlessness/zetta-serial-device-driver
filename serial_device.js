var Device = require('zetta-device');
var util = require('util');
var async = require('async');

var SerialDevice = module.exports = function() {
  Device.call(this);
  
  this._serialPort = arguments[0];

  this.sysPriority = 1;
  this.highPriority = 2;
  this.mediumPriority = 3;
  this.lowPriority = 4;
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

  this._serialPort.on('data', this._showRawStream);
  
  this._setupQueue(function() {});
  this._turnOffEcho();
  this._testConnection();

};

SerialDevice.prototype._showRawStream = function(data) {
  console.log('RAW ===\n\n' + data + '\n\n=== RAW');
}

// Parse

// TODO: need to figure out better approaches for:
// 1. when more data comes than expected causing problems for next task
// 2. when not enough data comes for current task
SerialDevice.prototype._parseTaskData = function(task, data, callback) {
  this.log('parseTaskData');
  this.call('parse', data, task.regexp, function(err, match) {
    console.log('match: ', match);
    if (task.callback instanceof Function) {
      task.callback(match);
    }
    callback();
  });
}

    
SerialDevice.prototype.write = function(command, cb) {
  this.state = 'writing';
  var self = this;
  this.log('writing: ' + command);
  this.log('writing (url encoded): ' + encodeURI(command));
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
    this.log('with regexp: ' + regexp.toString());
    this.log('URI encoded data: ' + encodeURI(data));
    this.log('Error: failed match');
    throw new Error('failed match');
  }
  this.state = 'waiting';
  this.log('match: ' + match);
  cb(null, match);
};

SerialDevice.prototype._setupQueue = function(cb) {

  var self = this;

  this._q = async.priorityQueue(function taskWorker(task, callback) {
    console.log('task:', task);
    
    // Nothing to parse? Then this is a mistake.
    if (!(task.regexp instanceof RegExp)) {
      throw new Error('Task is missing a regexp.');
    }

    self._serialPort.once('data', function (data) {
      self._parseTaskData(task, data, callback);
    });
    
    // Write
    if (!!task.rawCommand) {
      self.call('write', task.rawCommand);
    } else if (!!task.command) {
      self.call('write', task.command + "\n\r");
    }

  }, 1);

  cb();
}

SerialDevice.prototype.enqueue = function(tasks, priority, callback) {
  var priority = priority || this.lowPriority;

  this._q.push(
    tasks,
    priority,
    callback
  );

  this.log(
    ' q' +
    ' #length: ' + this._q.length() +
    ' #started: ' + this._q.started +
    ' #running: ' + this._q.running() +
    ' #idle: ' + this._q.idle() +
    ' #concurrency: ' + this._q.concurrency +
    ' #paused: ' + this._q.paused
  );
}

// turn off echo so that we parse less
SerialDevice.prototype._turnOffEcho = function() {
  var self = this;

  var tasks = [
  {    
    command: 'ATE0',
    regexp: /^ATE0|$/
  },
  {
    regexp: /OK/
  }];

  this.enqueue(tasks, this.sysPriority);
}
  
// send 3 AT OK commands as a batch to test connection
SerialDevice.prototype._testConnection = function() {

  var tasks = [];

  for (i = 0; i < 3; i++) {
    tasks.push({command: 'AT',regexp: /^$/});
    tasks.push({regexp: /OK/});
  }

  this.enqueue(tasks, this.sysPriority);

}

RegExp.quote = function(str) {
    return (str+'').replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
};