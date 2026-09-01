const express = require('express');
const ctrl = require('../controllers/testimonials.controller');

const router = express.Router();

router.get('/', ctrl.listPublicTestimonials);

module.exports = router;
