module.exports = {
  db: {
    url: process.env.MONGODB_URI
  },
  cache: {
    servers: process.env.MEMCACHEDCLOUD_SERVERS,
    username: process.env.MEMCACHEDCLOUD_USERNAME,
    password: process.env.MEMCACHEDCLOUD_PASSWORD
  },
  cloudinary: {
    url: process.env.CLOUDINARY_URL
  }
};
