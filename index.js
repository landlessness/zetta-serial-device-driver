var Scout = require('zetta-scout');
var util = require('util');
var SerialDevice = require('./serial_device');

var SerialDeviceScout = module.exports = function() {
  Scout.call(this);
};
util.inherits(SerialDeviceScout, Scout);

SerialDeviceScout.prototype.init = function(next) {
  var self = this;
  self.discover(SerialDevice, {default: 'DEFAULT'});
  next();
}