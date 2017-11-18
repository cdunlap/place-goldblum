const config = require('./config/index');

module.exports = {};

if(config.cache.enable) {
  const memjs = require('memjs');
  module.exports = new memjs.Client.create(config.cache.servers, {
    maxExpiration: 30,
    username: config.cache.username,
    password: config.cache.password
  });
}
