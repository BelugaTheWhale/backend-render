/**
 * Ultraviolet on Render — Full-Stack Backend (Customizable)
 * - Express serves Ultraviolet frontend assets.
 * - Bare server handles proxied HTTP(S)/WS traffic at BARE_PATH.
 * - Helmet + Compression + basic rate limiting.
 *
 * Customize via environment variables:
 *   PORT=10000               # Render sets this automatically
 *   BARE_PATH=/bare/         # Path for bare server
 *   UV_PUBLIC_PATH=/         # Where to mount UV static assets
 *   ENABLE_LOGS=true         # Enable request logging
 *   RATE_POINTS=100          # Max requests per duration
 *   RATE_DURATION=60         # Window (seconds)
 *   CORS_ORIGIN=*            # Allowed origin for preflight (simple example)
 */
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { createBareServer } from '@tomphttp/bare-server-node';

const app = express();

// ---- Config ----
const PORT = process.env.PORT || 8080;
const BARE_PATH = process.env.BARE_PATH || '/bare/';
const UV_PUBLIC_PATH = process.env.UV_PUBLIC_PATH || '/';
const ENABLE_LOGS = /^true$/i.test(process.env.ENABLE_LOGS || 'true');
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const RATE_POINTS = parseInt(process.env.RATE_POINTS || '200', 10);   // requests
const RATE_DURATION = parseInt(process.env.RATE_DURATION || '60', 10); // per seconds

// ---- Middleware ----
app.use(helmet({
  contentSecurityPolicy: false, // UV does heavy rewriting; strict CSP can break it
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
if (ENABLE_LOGS) app.use(morgan('combined'));

// Simple CORS (adjust as you like)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Rate limiting (basic, memory-based; for multi-instance use Redis)
const rateLimiter = new RateLimiterMemory({ points: RATE_POINTS, duration: RATE_DURATION });
app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (e) {
    res.status(429).send('Too Many Requests');
  }
});

// Serve Ultraviolet static assets (client bundle, service worker, UI)
app.use(UV_PUBLIC_PATH, express.static(uvPath, { extensions: ['html'] }));

// Health check & info
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));
app.get('/config', (_req, res) => {
  res.json({ BARE_PATH, UV_PUBLIC_PATH });
});

// ---- Bare server for proxying ----
const bare = createBareServer(BARE_PATH);
const server = app.listen(PORT, () => {
  console.log(`✅ Ultraviolet running on port ${PORT}`);
  console.log(`   UV UI: http://localhost:${PORT}${UV_PUBLIC_PATH}`);
  console.log(`   Bare:  http://localhost:${PORT}${BARE_PATH}`);
});

server.on('request', (req, res) => {
  if (bare.shouldRoute(req)) return bare.routeRequest(req, res);
});
server.on('upgrade', (req, socket, head) => {
  if (bare.shouldRoute(req)) return bare.routeUpgrade(req, socket, head);
});
