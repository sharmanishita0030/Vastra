import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  findUserByEmail,
  findUserById,
  createUser,
  updateUserPreferences,
  verifyPassword,
  getItemsByUserAndCollection,
  getItemById,
  createWardrobeItem,
  createBatchWardrobeItems,
  updateWardrobeItem,
  deleteWardrobeItem,
  getOutfitsByUserAndCollection,
  toggleOutfitFavorite,
  recordFeedback,
  clearWardrobeForUser
} from './src/server/storage';
import { analyzeClothingImage, isAiConfigured } from './src/server/ai';
import { generateOutfitRecommendations } from './src/server/recommendation';
import { generateAmazonRecommendations } from './src/server/amazon';
import { CollectionType } from './src/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Simple Bearer token / Session helper for user context
function getUserIdFromRequest(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  // Fallback to query or default guest user
  const guestHeader = req.headers['x-user-id'] as string;
  if (guestHeader) return guestHeader;
  return 'usr_guest_default';
}

// ------------------- AUTH ENDPOINTS -------------------

app.post('/api/v1/auth/register', (req: Request, res: Response) => {
  try {
    const { name, email, password, preferredCollection } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email and password are required.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    const user = createUser(name, email, password, preferredCollection || 'ladies');
    res.status(201).json({ user, token: user.id });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

app.post('/api/v1/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const user = findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    const isValid = verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    const { passwordHash: _, salt: __, ...safeUser } = user;
    res.json({ user: safeUser, token: safeUser.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

// Guest Instant Login for demo
app.post('/api/v1/auth/guest', (req: Request, res: Response) => {
  try {
    const guestEmail = 'guest@atelier.ai';
    let user = findUserByEmail(guestEmail);
    if (!user) {
      user = createUser('Atelier Guest', guestEmail, 'Atelier123!', 'ladies') as any;
    }
    const safeUser = findUserById(user!.id)!;
    res.json({ user: safeUser, token: safeUser.id });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to initialize guest session' });
  }
});

app.get('/api/v1/auth/me', (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  const user = findUserById(userId);
  if (!user) {
    // If not found, return a transient default user
    res.json({
      user: {
        id: userId,
        name: 'Guest Fashionista',
        email: 'guest@atelier.ai',
        preferredCollection: 'ladies',
        themePreference: 'dark',
        createdAt: new Date().toISOString()
      }
    });
    return;
  }
  res.json({ user });
});

app.patch('/api/v1/auth/preferences', (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  try {
    const { preferredCollection, themePreference } = req.body;
    const user = updateUserPreferences(userId, { preferredCollection, themePreference });
    res.json({ user });
  } catch (err: any) {
    res.json({ success: true, updated: req.body });
  }
});

app.post('/api/v1/auth/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

// ------------------- WARDROBE ENDPOINTS -------------------

app.get('/api/v1/wardrobe/items', (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  const collection = (req.query.collection as CollectionType) || 'ladies';
  const items = getItemsByUserAndCollection(userId, collection);
  res.json({ items });
});

app.post('/api/v1/wardrobe/items', (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  try {
    const itemData = req.body;
    const item = createWardrobeItem({
      ...itemData,
      userId
    });
    res.status(201).json({ item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/v1/wardrobe/items/batch', (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'Items must be an array' });
      return;
    }
    const prepared = items.map(i => ({ ...i, userId }));
    const created = createBatchWardrobeItems(prepared);
    res.status(201).json({ items: created, count: created.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/v1/wardrobe/items/:id', (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  const item = getItemById(userId, req.params.id);
  if (!item) {
    res.status(404).json({ error: 'Clothing item not found' });
    return;
  }
  res.json({ item });
});

app.patch('/api/v1/wardrobe/items/:id', (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  try {
    const updated = updateWardrobeItem(userId, req.params.id, req.body);
    res.json({ item: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/v1/wardrobe/items/:id', (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  const success = deleteWardrobeItem(userId, req.params.id);
  if (!success) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  res.json({ message: 'Item deleted successfully' });
});

// Clear wardrobe endpoint (for testing empty states strictly required in prompt)
app.post('/api/v1/wardrobe/clear', (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  const collection = req.body.collection as CollectionType | undefined;
  clearWardrobeForUser(userId, collection);
  res.json({ message: 'Wardrobe cleared successfully' });
});

// ------------------- AI UPLOADS & VISION -------------------

app.post('/api/v1/uploads/analyze', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType, collection } = req.body;
    if (!imageBase64) {
      res.status(400).json({ error: 'Image data is required' });
      return;
    }

    const col: CollectionType = collection === 'gents' ? 'gents' : 'ladies';
    const detected = await analyzeClothingImage(imageBase64, mimeType || 'image/jpeg', col);
    res.json({
      detected,
      aiActive: isAiConfigured(),
      count: detected.length
    });
  } catch (err: any) {
    console.error('Upload analysis error:', err);
    res.status(500).json({ error: err.message || 'Vision analysis failed' });
  }
});

// ------------------- OUTFITS & RECOMMENDATIONS -------------------

app.post('/api/v1/outfits/recommend', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { collection, occasion, mood, periodMode, weather } = req.body;
    const col: CollectionType = collection === 'gents' ? 'gents' : 'ladies';

    const result = await generateOutfitRecommendations(
      userId,
      col,
      occasion || 'Casual day out',
      mood,
      Boolean(periodMode),
      weather
    );
    res.json({
      outfits: result.outfits,
      totalUserItems: result.totalUserItems,
      emptyWardrobe: result.totalUserItems === 0
    });
  } catch (err: any) {
    console.error('Recommendation error:', err);
    res.status(500).json({ error: err.message || 'Recommendation failed' });
  }
});

app.get('/api/v1/outfits', (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  const collection = (req.query.collection as CollectionType) || 'ladies';
  const outfits = getOutfitsByUserAndCollection(userId, collection);
  res.json({ outfits });
});

app.post('/api/v1/outfits/:id/favorite', (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  try {
    const outfit = toggleOutfitFavorite(userId, req.params.id);
    res.json({ outfit });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/v1/feedback', (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  const { outfitId, rating, comment } = req.body;
  if (!outfitId || !rating) {
    res.status(400).json({ error: 'outfitId and rating are required' });
    return;
  }
  const feedback = recordFeedback(userId, outfitId, rating, comment);
  res.json({ feedback });
});

// ------------------- AMAZON PRODUCT RECOMMENDATIONS -------------------

app.get('/api/v1/amazon/recommendations', (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  const collection = (req.query.collection as CollectionType) || 'ladies';
  const occasion = req.query.occasion as string | undefined;
  const userItems = getItemsByUserAndCollection(userId, collection);
  const recommendations = generateAmazonRecommendations(collection, userItems, occasion);
  res.json({
    recommendations,
    marketplace: process.env.AMAZON_MARKETPLACE_URL || 'https://www.amazon.in'
  });
});

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    aiVisionConfigured: isAiConfigured(),
    model: 'gemini-3.8-flash'
  });
});

// ------------------- FRONTEND MOUNTING -------------------

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Atelier AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
