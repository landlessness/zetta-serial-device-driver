var Scout = require('zetta-scout');
var util = require('util');
var SerialDevice = require('./serial_device');

var serialport = require('serialport');

var SerialDeviceScout = module.exports = function() {
  Scout.call(this);
  this.serialPortLocation = arguments[0];
  this._serialPort = null;
};
util.inherits(SerialDeviceScout, Scout);

SerialDeviceScout.prototype.init = function(next) {
  this._serialPort = new serialport.SerialPort(this.serialPortLocation, {
    baudRate: 115200,
    parser: serialport.parsers.readline('\r\n')
  });

  var self = this;

  this._serialPort.on('open', function(err) {
    if (err) {
      console.error('SerialDevice error:', err);
      return;
    }
    var query = self.server.where({ type: 'serial' });
    self.server.find(query, function(err, results) {
      if(err) {
        return;
      }
      if (results.length) {
        self.provision(results[0], SerialDevice, self._serialPort, self.resetPin, self.apn);
      } else {
        self.discover(SerialDevice, self._serialPort, self.resetPin, self.apn);
      }
    });
    next();
  });

  this._serialPort.on('error', function(err) {
    console.log('error on serialport:', err);
  });

}