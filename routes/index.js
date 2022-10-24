const express = require('express');
const router = express.Router();
const randomInt = require('random-int');
const cloudinary = require('cloudinary');
const download = require('download');
// const photos = require('../photos');
const { imageCache, fillImageCache } = require('../cache');

/* GET home page. */
router.get('/', async (req, res) => {
  try {
    let photos = imageCache.get('all');
    if(!photos) {
      photos = await fillImageCache();
    }
    res.render('index', {photoCount: photos.length})
  } catch (err) {
    console.error(err);
    res.status(500);
    res.end()
  }
});

/* GET attribution page */
router.get('/attribution', async (req, res) => {
  try {
    const photos = await fillImageCache();
    res.render('attribution', { photos })
  } catch (err) {
    console.error(err)
    res.status(500)
    res.end()
  }
})

const fetchImage = async (width, height) => {
  const photos = await fillImageCache();
  const imgIdx = randomInt(0, photos.length - 1);
  const image = photos[imgIdx];
  const url = cloudinary.v2.url(image.public_id, {
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

    let data = await imageCache.get(cacheKey)
    if(data) {
      console.log('Cache hit')
    } else {
      console.log('Cache miss', cacheKey)
      data = await fetchImage(width, height)
      imageCache.set(cacheKey, data)
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
