module.exports = function testApp(server) {
  
  var serialDeviceQuery = server.where({type: 'serial'});
  
  var tasks = [
  {command: 'AT', regexp: /^$/},
  {regexp: /(O)(K)/, callback: function(match) {
    console.log('match: ' + match[1]);
    console.log('match: ' + match[2]);
  }}];

  server.observe([serialDeviceQuery], function(serialDevice){
    setInterval(function(){
      serialDevice.enqueue(tasks);
    }, 5000);
  });
  
}