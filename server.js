// server.js — Frontend + Ultraviolet client + Bare backend (works on Node 18–22)

import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";
import { createBareServer } from "@tomphttp/bare-server-node";
import uvPkg from "@titaniumnetwork-dev/ultraviolet";

const { uvPath } = uvPkg; // path to UV client assets

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Middleware ----------
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));

// ---------- Frontend ----------
app.use(express.static(__dirname)); // serve index.html, css, js in project root
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ---------- Ultraviolet client assets ----------
app.use("/uv/", express.static(uvPath));

// UV runtime config (adjust if you change prefixes)
app.get("/uv/uv.config.js", (_req, res) => {
  const cfg = `
    self.__uv$config = {
      prefix: '/uv/service/',
      bare: '/bare/',
      encodeUrl: Ultraviolet.codec.xor.encode,
      decodeUrl: Ultraviolet.codec.xor.decode,
      handler: '/uv/uv.handler.js',
      bundle: '/uv/uv.bundle.js',
      sw: '/uv/uv.sw.js',
      client: '/uv/index.html',
    };
  `.trim();
  res.type("application/javascript").send(cfg);
});

// ---------- Bare backend (attach at HTTP layer, NOT app.use) ----------
const bare = createBareServer("/bare/");

// Create a single HTTP server that routes to Bare or Express as needed
const server = http.createServer((req, res) => {
  if (bare.shouldRoute(req)) {
    // Let Bare handle proxied HTTP(S) requests
    bare.routeRequest(req, res);
  } else {
    // Everything else goes to your Express app (frontend + UV client files)
    app(req, res);
  }
});

// Handle WebSocket upgrades (Bare proxies WS too)
server.on("upgrade", (req, socket, head) => {
  if (bare.shouldRoute(req)) {
    bare.routeUpgrade(req, socket, head);
  } else {
    socket.destroy(); // nothing else needs WS upgrades here
  }
});

// ---------- Start ----------
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  console.log(`✅ Front-end:     http://localhost:${PORT}/`);
  console.log(`✅ UV client:     http://localhost:${PORT}/uv/`);
  console.log(`✅ Bare backend:  http://localhost:${PORT}/bare/ (internal)`);
});
