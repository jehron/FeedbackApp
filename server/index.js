import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from project root
dotenv.config({ path: join(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import feedbackRoutes from './routes/feedback.js';
import {
  RATE_LIMIT_WINDOW_MS,
  SANITIZE_RATE_LIMIT_MAX,
  TRANSFORM_RATE_LIMIT_MAX
} from './constants.js';
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting for transform endpoint (anti-abuse)
const transformLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: TRANSFORM_RATE_LIMIT_MAX,
  message: { error: 'Too many requests, please try again later' }
});

// Rate limiting for sanitize endpoint
const sanitizeLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: SANITIZE_RATE_LIMIT_MAX,
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
