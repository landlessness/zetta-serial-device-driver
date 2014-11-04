var zetta = require('zetta');
var SerialDevice = require('../index');
var app = require('./apps/starter_app');

zetta()
  .use(SerialDevice)
  .use(app)
  .listen(1337);
