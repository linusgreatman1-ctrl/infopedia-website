const prisma = require('../config/db');

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

async function uniqueSlug(base, ignoreId) {
  let slug = base || 'post';
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.blogPost.findUnique({ where: { slug } });
    if (!existing || existing.id === ignoreId) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

const PUBLIC_FIELDS = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  content: true,
  featuredImage: true,
  category: true,
  tags: true,
  seoTitle: true,
  seoDescription: true,
  authorName: true,
  publishedAt: true,
};

async function listPublicPosts(req, res, next) {
  try {
    const where = { published: true };
    if (req.query.category) where.category = String(req.query.category);
    if (req.query.tag) where.tags = { contains: String(req.query.tag) };

    const posts = await prisma.blogPost.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: 100,
      select: PUBLIC_FIELDS,
    });
    res.json({ posts });
  } catch (err) {
    next(err);
  }
}

async function getPublicPostBySlug(req, res, next) {
  try {
    const post = await prisma.blogPost.findUnique({
      where: { slug: req.params.slug },
      select: PUBLIC_FIELDS,
    });
    if (!post || !post.publishedAt) return res.status(404).json({ error: 'Post not found.' });
    res.json({ post });
  } catch (err) {
    next(err);
  }
}

async function listPostsForAdmin(req, res, next) {
  try {
    const posts = await prisma.blogPost.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
    res.json({ posts });
  } catch (err) {
    next(err);
  }
}

async function getPostForAdmin(req, res, next) {
  try {
    const post = await prisma.blogPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    res.json({ post });
  } catch (err) {
    next(err);
  }
}

function readPostBody(req) {
  const title = String(req.body.title || '').trim().slice(0, 200);
  const excerpt = String(req.body.excerpt || '').trim().slice(0, 400) || null;
  const content = String(req.body.content || '').trim();
  const featuredImage = String(req.body.featuredImage || '').trim() || null;
  const category = String(req.body.category || '').trim().slice(0, 60) || null;
  const tagsInput = req.body.tags;
  const tags = Array.isArray(tagsInput)
    ? tagsInput.map((t) => String(t).trim()).filter(Boolean).join(',')
    : String(tagsInput || '').trim() || null;
  const seoTitle = String(req.body.seoTitle || '').trim().slice(0, 120) || null;
  const seoDescription = String(req.body.seoDescription || '').trim().slice(0, 300) || null;
  const published = !!req.body.published;
  return { title, excerpt, content, featuredImage, category, tags, seoTitle, seoDescription, published };
}

async function createPost(req, res, next) {
  try {
    const body = readPostBody(req);
    if (!body.title || !body.content) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }

    const requestedSlug = req.body.slug ? slugify(req.body.slug) : slugify(body.title);
    const slug = await uniqueSlug(requestedSlug || 'post');

    const post = await prisma.blogPost.create({
      data: {
        ...body,
        slug,
        authorId: req.admin.id,
        authorName: req.admin.name,
        publishedAt: body.published ? new Date() : null,
      },
    });
    res.status(201).json({ post });
  } catch (err) {
    next(err);
  }
}

async function updatePost(req, res, next) {
  try {
    const existing = await prisma.blogPost.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Post not found.' });

    const body = readPostBody(req);
    if (!body.title || !body.content) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }

    let slug = existing.slug;
    if (req.body.slug) {
      const requested = slugify(req.body.slug);
      if (requested !== existing.slug) slug = await uniqueSlug(requested, existing.id);
    }

    const publishedAt = body.published ? existing.publishedAt || new Date() : null;

    const post = await prisma.blogPost.update({
      where: { id: existing.id },
      data: { ...body, slug, publishedAt },
    });
    res.json({ post });
  } catch (err) {
    next(err);
  }
}

async function deletePost(req, res, next) {
  try {
    await prisma.blogPost.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPublicPosts,
  getPublicPostBySlug,
  listPostsForAdmin,
  getPostForAdmin,
  createPost,
  updatePost,
  deletePost,
};
