require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const reviewsRoutes = require('./routes/reviews.routes');
const contactRoutes = require('./routes/contact.routes');
const adminRoutes = require('./routes/admin.routes');
const blogRoutes = require('./routes/blog.routes');
const settingsRoutes = require('./routes/settings.routes');
const testimonialsRoutes = require('./routes/testimonials.routes');
const announcementRoutes = require('./routes/announcement.routes');
const chatRoutes = require('./routes/chat.routes');
const storage = require('./services/storage.service');

const root = path.join(__dirname, '..');
const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", "'unsafe-inline'"],
        'script-src-attr': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'https://images.unsplash.com'],
        'connect-src': ["'self'"],
      },
    },
  })
);
app.use(compression());
app.use(
  cors({
    origin: !process.env.CLIENT_ORIGIN || process.env.CLIENT_ORIGIN === '*' ? true : process.env.CLIENT_ORIGIN.split(','),
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const globalLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use('/api', globalLimiter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/site-settings', settingsRoutes);
app.use('/api/testimonials', testimonialsRoutes);
app.use('/api/announcement', announcementRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);

storage.ensureUploadsDir();
app.use('/assets', express.static(path.join(root, 'assets')));
app.use('/uploads', express.static(storage.uploadsDir));
app.use(express.static(root, { index: 'index.html' }));

app.use('/api', notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5050;

const prisma = require('./config/db');
const { runSeed } = require('../prisma/seed');

async function start() {
  try {
    const result = await runSeed(prisma);
    console.log(result.created ? `[seed] created admin: ${result.adminEmail}` : `[seed] admin already exists: ${result.adminEmail}`);
  } catch (err) {
    console.error('[seed] failed (server will still start):', err.message);
  }

  app.listen(PORT, () => {
    console.log(`Infopedia site + backend listening on http://localhost:${PORT}`);
  });
}

start();

module.exports = app;
