const config = require('./config');
// const Promise = require('bluebird');
const memjs = require('memjs');
// Promise.promisifyAll(memjs.Client.prototype);

if(process.env.CACHE_ENABLED) {
  module.exports = new memjs.Client.create(config.cache.servers, {
    username: config.cache.username,
    password: config.cache.password
  });
} else {
  module.exports = {
    get: () => null,
    flush: () => null,
    set: v => true
  }
}
