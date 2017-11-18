const config = require('./config/index');
const mongoose = require('mongoose');
const Promise = require('bluebird');
mongoose.connect(config.db.url, {useMongoClient: true});
mongoose.Promise = Promise;

module.exports ={
  Image: mongoose.model('Image', {
    width: Number,
    height: Number,
    name: String,
    mime: String,
    checksum: String,
    public_id: String,
    url: String
  })
};