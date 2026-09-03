const express = require('express');
const ctrl = require('../controllers/announcement.controller');

const router = express.Router();

router.get('/', ctrl.getActivePublic);

module.exports = router;
