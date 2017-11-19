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
const config = require('../config');
const cache = require('../cache');

const uploader = multer({
  dest: './uploads/',
  rename: (fieldname, filename) => {
    return filename;
  }
});

/* GET home page. */
router.get('/', (req, res) => {
  cache.getAsync('photoCount')
  .then(count => {
    if(!count) {
      console.log('Cache miss: photoCount', count);
      return db.Image.count()
      .then(count => {
        console.log('Cache write: photoCount', count);
        return cache.setAsync('photoCount', count.toString())
        .then(response => {
          console.log(response);
          return count;
        });
      });
    }
    console.log('Cache hit: photoCount', count);
    return count;
  })
  .then(photoCount => {
    res.render('index', {photoCount});
  })
  .catch(err => {
    console.error(err);
    res.status(500);
    res.end();
  });
});

/* GET attribution page */
router.get('/attribution', (req, res) => {
  db.Image.find()
  .then(photos => {
    res.render('attribution', {photos});
  })
  .catch(err => {
    console.error(err);
    res.status(500);
    res.end();
  });
});

router.get('/clear', (req, res) => {
  cache.flushAsync()
  .then(response => {
    console.log('Flushed cache', response);
    res.status(200);
  })
  .catch(err => {
    console.error('Error flushing cache', err);
    res.status(500);
  })
  .finally(() => {
    res.end();
  });
});

router.get('/delete/:key', (req, res) => {
  cache.delAsync(req.params.key)
  .then(response => {
    console.log('Deleted cache key', req.params.key);
    res.status(200);
  })
  .catch(err => {
    console.error('Error deleting cache key', req.params.key, err);
    res.status(500);
  })
  .finally(() => {
    res.end();
  });
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
      // Clear caches
      return Promise.join(
        cache.delAsync('photoCount'), cache.delAsync('photos'),
        (res1, res2) => {
          console.log('Cleared photoCount and photos', res1, res2);
        });
    })
    .then(() => {
      req.flash('success', 'Image uploaded');
      res.redirect('/upload');
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

function fetchImage(width, height) {
  return db.Image.count()
  .then(count => {
    const idx = randomInt(count - 1);
    return db.Image.findOne().skip(idx);
  })
  .then(image => {
    const url = cloudinary.url(image.public_id, {
      width: width,
      height: height,
      gravity: 'face',
      crop: 'fill',
      format: 'jpg'
    });
    console.log('Requesting url', url);
    return download(url);
  })
}

router.get(['/:width', '/:width/:height'], (req, res) => {
  let {width, height} = req.params;
  height = height || width;

  const cacheKey = `${width}_${height}`;
  console.log('Cache key', cacheKey);
  cache.getAsync(cacheKey)
  .then(data => {
    if(data) {
      console.log('Cache hit');
      return data;
    }
    console.log('Cache miss');
    return fetchImage(width, height)
    .then(data => {
      // Store it
      console.log('Writing cache', cacheKey);
      cache.setAsync(cacheKey, data); // Don't need to wait for this
      return data;
    });
  })
  .then(data => {
    res.set('Content-Type', 'image/jpeg');
    res.send(data);
  })
  .catch(err => {
    console.error(err);
    res.status(500);
  })
  .finally(() => {
    res.end();
  });
});

module.exports = router;
