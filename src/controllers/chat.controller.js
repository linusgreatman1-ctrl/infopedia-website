const prisma = require('../config/db');
const emailSvc = require('../services/email.service');

const VISITOR_ID_RE = /^[a-zA-Z0-9-]{8,64}$/;

function isValidVisitorId(id) {
  return typeof id === 'string' && VISITOR_ID_RE.test(id);
}

// A visitor can have several conversations over time — once one is closed,
// neither side can post into it again, so the next message starts a fresh
// one. This always returns whichever conversation is current for display
// (open or closed), leaving the "start a new one" decision to the caller.
function findLatestConversation(visitorId) {
  return prisma.chatConversation.findFirst({ where: { visitorId }, orderBy: { createdAt: 'desc' } });
}

// ---- Public (visitor-facing, no auth) ----

async function startConversation(req, res, next) {
  try {
    const { visitorId, name } = req.body;
    if (!isValidVisitorId(visitorId)) {
      return res.status(400).json({ error: 'Invalid visitorId.' });
    }
    const visitorName = name ? String(name).trim().slice(0, 100) : null;

    let conversation = await findLatestConversation(visitorId);
    if (!conversation || conversation.status === 'closed') {
      conversation = await prisma.chatConversation.create({ data: { visitorId, visitorName } });
    } else if (visitorName && visitorName !== conversation.visitorName) {
      conversation = await prisma.chatConversation.update({ where: { id: conversation.id }, data: { visitorName } });
    }

    res.json({ conversation });
  } catch (err) {
    next(err);
  }
}

async function getMessagesForVisitor(req, res, next) {
  try {
    const { visitorId } = req.params;
    if (!isValidVisitorId(visitorId)) {
      return res.status(400).json({ error: 'Invalid visitorId.' });
    }

    const conversation = await findLatestConversation(visitorId);
    if (!conversation) return res.json({ conversation: null, messages: [] });

    const messages = await prisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    // The visitor is now looking — clear their unread flag.
    if (conversation.unreadByVisitor) {
      await prisma.chatConversation.update({ where: { id: conversation.id }, data: { unreadByVisitor: false } });
    }

    res.json({ conversation, messages });
  } catch (err) {
    next(err);
  }
}

async function postMessageFromVisitor(req, res, next) {
  try {
    const { visitorId } = req.params;
    if (!isValidVisitorId(visitorId)) {
      return res.status(400).json({ error: 'Invalid visitorId.' });
    }
    const body = String(req.body.body || '').trim().slice(0, 2000);
    if (!body) return res.status(400).json({ error: 'Message body is required.' });

    const name = req.body.name ? String(req.body.name).trim().slice(0, 100) : undefined;

    let conversation = await findLatestConversation(visitorId);
    if (!conversation || conversation.status === 'closed') {
      // Closed (or brand new) — this message starts a fresh conversation
      // rather than reviving the old, ended one.
      conversation = await prisma.chatConversation.create({ data: { visitorId, visitorName: name || null } });
    } else {
      conversation = await prisma.chatConversation.update({
        where: { id: conversation.id },
        data: { unreadByAdmin: true, lastMessageAt: new Date(), ...(name ? { visitorName: name } : {}) },
      });
    }

    const message = await prisma.chatMessage.create({
      data: { conversationId: conversation.id, sender: 'visitor', body },
    });

    emailSvc.notify(
      `New live chat message${conversation.visitorName ? ` from ${conversation.visitorName}` : ''}`,
      body
    );

    res.status(201).json({ message, conversationId: conversation.id });
  } catch (err) {
    next(err);
  }
}

// ---- Admin (auth required) ----

async function listConversationsForAdmin(req, res, next) {
  try {
    const conversations = await prisma.chatConversation.findMany({
      orderBy: { lastMessageAt: 'desc' },
      take: 200,
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    res.json({
      conversations: conversations.map((c) => ({
        id: c.id,
        visitorId: c.visitorId,
        visitorName: c.visitorName,
        status: c.status,
        unreadByAdmin: c.unreadByAdmin,
        lastMessageAt: c.lastMessageAt,
        createdAt: c.createdAt,
        lastMessage: c.messages[0] || null,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function getMessagesForAdmin(req, res, next) {
  try {
    const conversation = await prisma.chatConversation.findUnique({ where: { id: req.params.id } });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });

    const messages = await prisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    if (conversation.unreadByAdmin) {
      await prisma.chatConversation.update({ where: { id: conversation.id }, data: { unreadByAdmin: false } });
    }

    res.json({ conversation, messages });
  } catch (err) {
    next(err);
  }
}

async function postMessageFromAdmin(req, res, next) {
  try {
    const conversation = await prisma.chatConversation.findUnique({ where: { id: req.params.id } });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });
    if (conversation.status === 'closed') {
      return res.status(400).json({ error: 'This conversation is closed. Reopen it to keep replying.' });
    }

    const body = String(req.body.body || '').trim().slice(0, 2000);
    if (!body) return res.status(400).json({ error: 'Message body is required.' });

    const message = await prisma.chatMessage.create({
      data: { conversationId: conversation.id, sender: 'admin', body },
    });

    await prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { unreadByVisitor: true, lastMessageAt: new Date() },
    });

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

async function setConversationStatus(req, res, next) {
  try {
    const status = req.body.status === 'closed' ? 'closed' : 'open';
    const conversation = await prisma.chatConversation.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json({ conversation });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  startConversation,
  getMessagesForVisitor,
  postMessageFromVisitor,
  listConversationsForAdmin,
  getMessagesForAdmin,
  postMessageFromAdmin,
  setConversationStatus,
};
