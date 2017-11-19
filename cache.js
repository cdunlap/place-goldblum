const config = require('./config');
const Promise = require('bluebird');
const memjs = require('memjs');
Promise.promisifyAll(memjs.Client.prototype);

module.exports = new memjs.Client.create(config.cache.servers, {
  username: config.cache.username,
  password: config.cache.password
});
