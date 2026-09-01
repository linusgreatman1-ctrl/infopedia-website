const express = require('express');
const multer = require('multer');
const { requireAdminAuth } = require('../middleware/auth');
const reviewsCtrl = require('../controllers/reviews.controller');
const contactCtrl = require('../controllers/contact.controller');
const blogCtrl = require('../controllers/blog.controller');
const mediaCtrl = require('../controllers/media.controller');
const settingsCtrl = require('../controllers/settings.controller');
const adminUsersCtrl = require('../controllers/adminUsers.controller');

const router = express.Router();
router.use(requireAdminAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error('Only image uploads are allowed.'), { status: 400 }));
  },
});

router.get('/reviews', reviewsCtrl.listReviewsForAdmin);
router.post('/reviews/:id/respond', reviewsCtrl.respondToReview);
router.post('/reviews/:id/hide', reviewsCtrl.setReviewHidden);

router.get('/contacts', contactCtrl.listContactsForAdmin);
router.post('/contacts/:id/read', contactCtrl.setContactRead);

router.get('/blog', blogCtrl.listPostsForAdmin);
router.get('/blog/:id', blogCtrl.getPostForAdmin);
router.post('/blog', blogCtrl.createPost);
router.put('/blog/:id', blogCtrl.updatePost);
router.delete('/blog/:id', blogCtrl.deletePost);

router.get('/media', mediaCtrl.listMedia);
router.post('/media', upload.single('file'), mediaCtrl.uploadMedia);
router.delete('/media/:id', mediaCtrl.deleteMedia);

router.get('/site-settings', settingsCtrl.getSettingsForAdmin);
router.put('/site-settings', settingsCtrl.updateSettings);

router.get('/admins', adminUsersCtrl.listAdmins);
router.post('/admins', adminUsersCtrl.createAdmin);
router.delete('/admins/:id', adminUsersCtrl.deleteAdmin);
router.post('/me/password', adminUsersCtrl.changeOwnPassword);

module.exports = router;
