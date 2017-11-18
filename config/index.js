const path = require('path');

const env = process.env.NODE_ENV || 'development';

const config = {
  db: {
    url: process.env.MONGODB_URI
  },
  cache: {
    enable: true,
    servers: process.env.MEMCACHEDCLOUD_SERVERS,
    username: process.env.MEMCACHED_USERNAME,
    password: process.env.MEMCACHED_PASSWORD
  },
  cloudinary: {
    url: process.env.CLOUDINARY_URL
  }
};

const envConfig = require(`./${env}.js`);
module.exports = Object.assign(config, envConfig);
