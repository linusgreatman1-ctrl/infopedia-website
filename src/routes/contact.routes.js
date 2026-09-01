const express = require('express');
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/contact.controller');

const router = express.Router();

const submitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again later.' },
});

router.post('/', submitLimiter, ctrl.createContact);

module.exports = router;
