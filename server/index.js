import dotenv from 'dotenv';
import { fileURLToPath as toPath } from 'url';
import { dirname as dirPath, join as joinPath } from 'path';

// Load .env from project root
dotenv.config({ path: joinPath(dirPath(toPath(import.meta.url)), '../.env') });

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import feedbackRoutes from './routes/feedback.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting for transform endpoint (anti-abuse)
const transformLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  message: { error: 'Too many requests, please try again later' }
});

// Rate limiting for sanitize endpoint
const sanitizeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests, please try again later' }
});

// Apply rate limiters
app.use('/api/feedback/sanitize', sanitizeLimiter);
app.use('/api/feedback/:id/transform', transformLimiter);

// API routes
app.use('/api/feedback', feedbackRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
