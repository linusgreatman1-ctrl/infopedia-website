const express = require('express');
const ctrl = require('../controllers/blog.controller');

const router = express.Router();

router.get('/', ctrl.listPublicPosts);
router.get('/:slug', ctrl.getPublicPostBySlug);

module.exports = router;
