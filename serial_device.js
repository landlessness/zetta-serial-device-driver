var Device = require('zetta-device');
var util = require('util');

var SerialDevice = module.exports = function(options) {
  Device.call(this);
  this._default = options['default'];
};
util.inherits(SerialDevice, Device);

SerialDevice.prototype.init = function(config) {
  config
  .name('Serial Device')
  .type('serial')
  .state('waiting')
  .when('waiting', { allow: ['do']})
  .when('doing', { allow: [] })
  .map('do', this.do, [
    { name: 'message', type: 'text'}
  ]);
};

SerialDevice.prototype.do = function(message, cb) {
  this.state = 'doing';
  this.log(this._default + ': ' + message);
  this.state = 'waiting';
  cb();
};
