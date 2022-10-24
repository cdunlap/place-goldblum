const NodeCache = require('node-cache');
const cloudinary = require('cloudinary');

const imageCache = new NodeCache({
  stdTTL: 3600,
  useClones: false
});

const fillImageCache = async () => {
  let photos = imageCache.get('all');
  if(!photos) {
    try {
      photos = await cloudinary.v2.api.resources({
        resource_type: 'image',
        type: 'upload',
        prefix: 'goldblum',
        context: true
      })
      imageCache.set('all', photos.resources);
    } catch (err) {
      console.error(`fillImageCache`, err);
    }
  }
  return photos || [];
}

module.exports = {
  imageCache,
  fillImageCache
};