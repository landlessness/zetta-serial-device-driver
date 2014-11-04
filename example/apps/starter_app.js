module.exports = function testApp(server) {
  
  var serialDeviceQuery = server.where({type: 'serial'});
  
  server.observe([serialDeviceQuery], function(serialDevice){
    setInterval(function(){
      serialDevice.call('do', './app.js is running', function() {});
    }, 5000);
  });
  
}