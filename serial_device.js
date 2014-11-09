var Device = require('zetta-device');
var util = require('util');
var async = require('async');

var SerialDevice = module.exports = function() {
  Device.call(this);
  
  this._serialPort = arguments[0];
  this._q = null;

  this._perennialRegExps = [];

  this.sysPriority = 1;
  this.highPriority = 2;
  this.mediumPriority = 3;
  this.lowPriority = 4;
};
util.inherits(SerialDevice, Device);

SerialDevice.prototype.init = function(config) {
  config
  .name('Serial Device')
  .type('serial')
  .state('waiting')
  .when('waiting', { allow: ['write', 'writeRaw', 'parse', 'at']})
  .when('at', { allow: ['write', 'writeRaw', 'parse', 'at']})
  .when('writing', { allow: ['write', 'writeRaw', 'parse']})
  .when('parsing', { allow: ['write', 'writeRaw', 'parse']})
  .map('at', this.at)
  .map('write', this.write, [
    { name: 'command', type: 'text'}])
  .map('writeRaw', this.writeRaw, [
    { name: 'command', type: 'text'}])
  .map('parse', this.parse, [
    { name: 'data', type: 'text'},
    { name: 'regexp', type: 'text'}]);

  this._setupTaskQueue(function() {});

  this._setupRawLog();
  this._turnOffEcho();
  this._testConnection();

};

SerialDevice.prototype.at = function(cb) {
  var self = this;
  var tasks = [
  {
    before: function() {self.state = 'at'},
    command: 'AT',
    regexp: /^$/
  },
  {
    regexp: /OK/
  }
  ];
  this.enqueue(tasks, null, function() {
    this.state = 'waiting';
    cb();
  });
}

SerialDevice.prototype.enqueue = function(tasks, priority, callback) {
  var priority = priority || this.lowPriority;

  console.log('enqueue tasks: ', tasks);
  
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

SerialDevice.prototype.write = function(command, cb) {
  this.writeRaw(command + "\n\r", cb);
}

SerialDevice.prototype.writeRaw = function(command, cb) {
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
  this.state = 'waiting';
  this.log('match: ' + match);
  cb(null, match);
};

SerialDevice.prototype._parsePerennialTaskData = function(task, data, callback) {
  this.log('_parsePerennialTaskData');

  var self = this;

  console.log('task.regexp: ', task.regexp);
  console.log('data: ', data);
  
  this.call('parse', data, task.regexp, function(err, match) {
    console.log('match: ', match);

    if (!!match) {
      self.log('match: true');
      if (task.before instanceof Function) {
        task.before();
      }
      if (task.onMatch instanceof Function) {
        task.onMatch(match);
      }
    }
    
    callback();
  });
}

SerialDevice.prototype._parseTaskData = function(task, data, callback) {
  this.log('parseTaskData');

  // TODO: need to figure out better approaches for:
  // 1. when more data comes than expected causing problems for next task
  // 2. when not enough data comes for current task
  
  var self = this;
  
  this.call('parse', data, task.regexp, function(err, match) {
    console.log('match: ', match);
    
    if (!!match) {
      self.log('match: true');
      if (task.onMatch instanceof Function) {
        task.onMatch(match);
      }
    } else {
      var perennialMatch = self._perennialRegExps.some(function (regexp) {
        return regexp.test(data);
      });
      
      if (perennialMatch) {
        // if it's something the perennial is seeking then ignore
        self.log('perennial match encountered and ignored by parse task.');
      } else {
        self.log('failed match on data: ' + data);
        self.log('with regexp: ' + task.regexp.toString());
        self.log('URI encoded data: ' + encodeURI(data));
        self.log('Error: failed match');
        throw new Error('failed match');
      }
    }
    
    callback();
  });
}

SerialDevice.prototype._setupRawLog = function(cb) {
  var self = this;
  this._serialPort.on('data', function(data) {
    self.log('\n\n### RAW SERIAL IN\n' + data + '\n### RAW SERIAL IN\n');
  });
}

// TODO: create a worker function and call priorityQueue from init()
SerialDevice.prototype._setupTaskQueue = function(cb) {

  var self = this;

  this._q = async.priorityQueue(function taskWorker(task, callback) {
    console.log('task:', task);
    
    // No regular expression to parse? Then this is a mistake.
    if (!(task.regexp instanceof RegExp)) {
      throw new Error('Task is missing a regexp.');
    }

    if (task.perennial) {
      self._perennialRegExps.push(task.regexp);
      self._serialPort.on('data', function (data) {
        self._parsePerennialTaskData(task, data, function() {});
      });
      callback();
    } else {
      if (task.before instanceof Function) {
        task.before();
      }
      self._serialPort.once('data', function (data) {
        self._parseTaskData(task, data, callback);
      });
    }

    // Write
    if (!!task.command) {
      self.call('write', task.command);
    } else if (!!task.rawCommand) {
      self.call('writeRaw', task.rawCommand);
    }

    self.log(
      ' q' +
      ' #length: ' + self._q.length() +
      ' #started: ' + self._q.started +
      ' #running: ' + self._q.running() +
      ' #idle: ' + self._q.idle() +
      ' #concurrency: ' + self._q.concurrency +
      ' #paused: ' + self._q.paused
    );

    // TODO: figure out where task.after() should go

  }, 1);

  cb();
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