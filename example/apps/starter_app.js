module.exports = function testApp(server) {
  
  var serialDeviceQuery = server.where({type: 'serial'});
  
  var tasks = [
  {
    command: 'AT', 
    regexp: /^$/
  },{
    regexp: /(O)(K)/, callback: function(match) {
      console.log('match: ' + match[1]);
      console.log('match: ' + match[2]);
    }
  }];

  server.observe([serialDeviceQuery], function(serialDevice){
    serialDevice.enqueue({
      perennial: true,
      regexp: /^(.*)$/,
      onMatch: function(match) {
        console.log('RAW ===\n\n' + match[1] + '\n\n=== RAW');
      }
    });
    setInterval(function(){
      serialDevice.enqueue(tasks);
    }, 100);
  });
  
}