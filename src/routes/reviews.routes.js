const express = require('express');
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/reviews.controller');

const router = express.Router();

const submitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again later.' },
});

router.get('/', ctrl.listPublicReviews);
router.post('/', submitLimiter, ctrl.createReview);

module.exports = router;
