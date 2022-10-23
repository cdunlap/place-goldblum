const express = require('express');
const router = express.Router();
const randomInt = require('random-int');
const cloudinary = require('cloudinary');
const download = require('download');
const photos = require('../photos');

/* GET home page. */
router.get('/', async (req, res) => {
  try {
    const photoCount = photos.length;
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
    res.render('attribution', { photos })
  } catch (err) {
    console.error(err)
    res.status(500)
    res.end()
  }
})

const fetchImage = async (width, height) => {
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
    /*
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
    */
    const data = await fetchImage(width, height);
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
