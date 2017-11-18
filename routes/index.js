const express = require('express');
const router = express.Router();
const path = require('path');
const mime = require('mime-types');
const db = require('../db');
const fs = require('fs');
const gm = require('gm');
const multer = require('multer');
const checksum = require('checksum');
const Promise = require('bluebird');
const randomInt = require('random-int');
const cloudinary = require('cloudinary');
const download = require('download');
const config = require('../config/index');
const cache = require('../cache');

const uploader = multer({
  dest: './uploads/',
  rename: (fieldname, filename) => {
    console.log('Multer', arguments);
    return filename;
  }
});

/* GET home page. */
router.get('/', (req, res) => {
  res.render('index', { title: 'Express' });
});

router.get('/image', (req, res) => {
  db.Image.find({})
  .then(images => {
    res.json(images);
  });
});

router.get('/clear', (req, res) => {
  if(config.cache.enable) {
    cache.flush((err, response) => {
      if(err) {
        console.error(err);
      } else {
        console.log('Cache flushed', response);
      }
      res.end();
    });
  }
});

router.get('/delete/:key', (req, res) => {
  if(config.cache.enable) {
    cache.delete(req.params.key, (err, response) => {
      if(err) {
        console.error(err);
      } else {
        console.log('Cache deleted', req.params.key, response);
      }
      res.end();
    });
  }
});

if(process.env.NODE_ENV === 'development') {
  router.post('/image', uploader.single('image'), (req, res) => {
    if(!req.file) {
      res.status(400);
      res.end();
    }
    const imagePath = path.join(__dirname, '../', req.file.path);
    const image = new db.Image({
      name: req.file.filename
    });

    Promise.promisify(checksum.file)(imagePath)
    .then((cs) => {
      // Get image checksum
      image.checksum = cs;
      return cs;
    })
    .then((cs) => {
      // Make sure the checksum doesn't exist already
      return db.Image.find({checksum: cs})
      .then(images => {
        if(images.length > 0) {
          throw new Error('Image already exists');
        }
      });
    })
    .then(() => {
      // Get image data and save
      return gm(imagePath)
      .size((err, size) => {
        if(err) {
          throw err;
        } else {
          image.width = size.width;
          image.height = size.height;
        }
      });
    })
    .then(() => {
      // Upload the image to Cloudinary for later transformation
      return Promise.promisify(cloudinary.v2.uploader.upload)(imagePath)
      .then(result => {
        image.public_id = result.public_id;
        image.url = result.url;
        return image.save();
      });
    })
    .then(() => {
      // Notify the user
      res.end('Image uploaded');
    })
    .catch(err => {
      res.status(500);
      res.end(err.message || err);
    })
    .finally(() => {
      fs.unlink(imagePath);
    });
  });
}

function sendUncached(width, height, res, cacheKey) {
  // Find an image at random
  db.Image.count().exec((err, count) => {
    const idx = randomInt(count - 1);
    db.Image.findOne().skip(idx).exec((err, image) => {
      if(err) {
        res.status(500);
        res.end();
        console.error(err);
      } else {
        const url = cloudinary.url(image.public_id, {
          width: width,
          height: height,
          gravity: 'face',
          crop: 'fill',
          format: 'jpg'
        });
        console.log('Requesting', url);
        download(url).then(data => {
          res.set('Content-Type', 'image/jpeg');
          res.send(data);
          res.end();

          // Store record in cache
          if(config.cache.enable) {
            console.log('Cache miss, writing');
            cache.set(cacheKey, data, {
              expires: 3600 // 1 hr
            }, (err, val) => {
              if(err) {
                console.error(err);
              } else {
                console.log('Wrote to cache');
              }
            });
          }
        }).catch(err => {
          console.error(err);
          res.status(500);
          res.end();
        });
      }
    });
  });
}

router.get(['/:width', '/:width/:height'], (req, res) => {
  let {width, height} = req.params;
  height = height || width;

  if(config.cache.enable) {
    const cacheKey = `${width}_${height}`;
    console.log('Cache key', cacheKey);
    // TODO: Check cache for key, return it
    cache.get(cacheKey, (err, data) => {
      if(!err && data) {
        console.log('Cache hit');
        res.set('Content-Type', 'image/jpeg');
        res.send(data);
        res.end();
      } else {
        console.error(err);
        sendUncached(width, height, res, cacheKey);
      }
    })
  } else {
    sendUncached(width, height, res);
  }
});

module.exports = router;
