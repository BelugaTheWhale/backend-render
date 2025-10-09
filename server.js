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
// server.js
// server.js — Frontend + Ultraviolet Backend for Node 18+

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";
import { createBareServer } from "@tomphttp/bare-server-node";

// ✅ FIXED IMPORT for CommonJS Ultraviolet module
import uvPkg from "@titaniumnetwork-dev/ultraviolet";
const { createServer: createUVServer, uvPath } = uvPkg;

// === Setup ===
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Needed for __dirname with ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Middleware ===
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));

// === FRONT-END HOSTING ===
// Serve your static files (index.html, CSS, JS, etc.)
app.use(express.static(__dirname));

// Serve index.html when visiting root
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// === ULTRAVIOLET PROXY BACKEND ===
const bare = createBareServer("/bare/");

const uv = createUVServer({
  prefix: "/uv/service/",
  bare,
  config: {
    // optional configuration here
  },
  handler: app,
});

// Serve Ultraviolet client files (JS bundle, config, etc.)
app.use("/uv/", express.static(uvPath));

// Mount Bare middleware
app.use("/bare/", bare.middleware);

// === ERROR HANDLER ===
app.use((req, res) => {
  res.status(404).send("404: Not Found");
});

// === START SERVER ===
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  console.log(`✅ Front-end available at http://localhost:${PORT}/`);
  console.log(`✅ Ultraviolet proxy available at http://localhost:${PORT}/uv/`);
});

