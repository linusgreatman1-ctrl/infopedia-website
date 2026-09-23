const express = require('express');
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/chat.controller');

const router = express.Router();

const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages. Please slow down.' },
});

router.post('/start', ctrl.startConversation);
router.get('/:visitorId/messages', ctrl.getMessagesForVisitor);
router.post('/:visitorId/messages', sendLimiter, ctrl.postMessageFromVisitor);

module.exports = router;
