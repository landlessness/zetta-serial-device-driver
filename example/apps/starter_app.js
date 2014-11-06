module.exports = function testApp(server) {
  
  var serialDeviceQuery = server.where({type: 'serial'});
  
  server.observe([serialDeviceQuery], function(serialDevice){
    setInterval(function(){
      serialDevice.enqueue({command: 'AT', regexps: [/^$/, /OK/]}, function() {});
    }, 5000);
  });
  
}