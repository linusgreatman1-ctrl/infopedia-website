const express = require('express');
const { requireAdminAuth } = require('../middleware/auth');
const reviewsCtrl = require('../controllers/reviews.controller');
const contactCtrl = require('../controllers/contact.controller');

const router = express.Router();
router.use(requireAdminAuth);

router.get('/reviews', reviewsCtrl.listReviewsForAdmin);
router.post('/reviews/:id/respond', reviewsCtrl.respondToReview);
router.post('/reviews/:id/hide', reviewsCtrl.setReviewHidden);

router.get('/contacts', contactCtrl.listContactsForAdmin);
router.post('/contacts/:id/read', contactCtrl.setContactRead);

module.exports = router;
