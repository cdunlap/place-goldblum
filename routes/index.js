const express = require('express');
const router = express.Router();
const path = require('path');
const mime = require('mime-types');
const db = require('../db');
const fs = require('fs');
const gm = require('gm');
const multer = require('multer');
const checksum = require('checksum');
// const Promise = require('bluebird');
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
router.get('/', async (req, res) => {
  try {
    let photoCount = await cache.get('photoCount')
    if(!photoCount) {
      console.log('Cache miss: photoCount ', photoCount)
      const { rows } = await db.query('SELECT COUNT(*) AS photoCount FROM images')
      photoCount = parseInt(rows[0].photocount)
      console.log('Cache write: photoCount ', photoCount)
      await cache.set('photoCount', photoCount.toString())
    }
    else {
      console.log('Cache hit: photoCount', photoCount)
    }
    res.render('index', {photoCount})
  } catch (err) {
    console.error(err);
    res.status(500);
    res.end()
  }
});

/* GET attribution page */
router.get('/attribution', async (req, res) => {
  try {
    let photos = await cache.get('photos')
    if(!photos) {
      const { rows } = await db.query('SELECT * FROM images')
      photos = rows
      cache.set('photos', photos)
    }
    res.render('attribution', { photos })
  } catch (err) {
    console.error(err)
    res.status(500)
    res.end()
  }
})

router.get('/clear', async (req, res) => {
  try {
    const response = await cache.flush()
    console.log('Flushed cache', response)
    res.status(200)
  } catch (err) {
    res.status(500)
  } finally {
    res.end()
  }
});

router.get('/delete/:key', async (req, res) => {
  try {
    await cache.del(req.params.key)
    res.status(200)
  } catch(err) {
    console.error(`Error deleting cache key ${req.params.key}`, err);
    res.status(500)
  } finally {
    res.end()
  }
})

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

const fetchImage = async (width, height) => {
  const { rows } = await db.query('select * from images order by random() limit 1')
  const image = rows[0]
  const url = cloudinary.url(image.public_id, {
    width: width,
    height: height,
    gravity: 'face',
    crop: 'fill',
    format: 'jpg'
  });
  return download(url)
}

router.get(['/:width', '/:width/:height'], async (req, res) => {
  try {
    let { width, height } = req.params
    height = height || width
    const cacheKey = `${width}_${height}`
    console.log('Cache key', cacheKey)

    let data = await cache.get(cacheKey)
    if(data) {
      console.log('Cache hit')
    } else {
      console.log('Cache miss', cacheKey)
      data = await fetchImage(width, height)
      cache.set(cacheKey, data)
    }

    // If there's still no data, return 404
    if(!data) {
      res.status(404)
    } else {
      res.set('Content-Type', 'image/jpeg')
      res.send(data)
    }
  } catch(err) {
    console.error(err)
    res.status(500)
  } finally {
    res.end()
  }
})

module.exports = router;
