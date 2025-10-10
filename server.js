// server.js — Frontend + Ultraviolet client/worker + Bare backend (Node 18–22)

import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";
import { createBareServer } from "@tomphttp/bare-server-node";
import uvPkg from "@titaniumnetwork-dev/ultraviolet";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------- Middleware --------
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));

// Health check (for Koyeb)
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// -------- Frontend --------
// Serve from repo root (or move your files to /public and adjust if you like)
const staticDir = __dirname;
app.use(express.static(staticDir));
app.get("/", (_req, res) => res.sendFile(path.join(staticDir, "index.html")));

// -------- Ultraviolet (client + service worker) --------
const { uvPath } = uvPkg;

// Serve UV files directly from the package
app.use(
  "/uv/",
  express.static(uvPath, {
    setHeaders(res, filePath) {
      // SW + config must not be cached; allow scope
      if (filePath.endsWith("uv.sw.js") || filePath.endsWith("uv.config.js")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.setHeader("Service-Worker-Allowed", "/uv/");
      }
    },
  })
);

// Also expose /uv.sw.js at root in case a script references it there
app.get("/uv.sw.js", (_req, res) => {
  const swPath = path.join(uvPath, "uv.sw.js");
  if (fs.existsSync(swPath)) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Service-Worker-Allowed", "/uv/");
    res.sendFile(swPath);
  } else {
    res.status(404).send("Service Worker not found");
  }
});

// Runtime UV config with absolute URLs (avoids scope/proxy confusion)
app.get("/uv/uv.config.js", (req, res) => {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host  = req.headers["x-forwarded-host"] || req.headers.host;
  const base  = `${proto}://${host}`;
  const cfg = `
    // Ultraviolet runtime config (absolute URLs)
    self.__uv$config = {
      prefix: '${base}/uv/service/',
      bare:   '${base}/bare/',
      encodeUrl: Ultraviolet.codec.xor.encode,
      decodeUrl: Ultraviolet.codec.xor.decode,
      handler: '${base}/uv/uv.handler.js',
      bundle:  '${base}/uv/uv.bundle.js',
      sw:      '${base}/uv/uv.sw.js',
      client:  '${base}/uv/index.html'
    };
  `.trim();
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Service-Worker-Allowed", "/uv/");
  res.type("application/javascript").send(cfg);
});

// -------- Bare backend wiring (attach at HTTP layer) --------
const bare = createBareServer("/bare/");

const server = http.createServer((req, res) => {
  if (bare.shouldRoute(req)) {
    bare.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

server.on("upgrade", (req, socket, head) => {
  if (bare.shouldRoute(req)) {
    bare.routeUpgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});

// -------- Start --------
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Running on http://0.0.0.0:${PORT}`);
  console.log(`✅ Frontend:       /`);
  console.log(`✅ UV assets:      /uv/uv.bundle.js`);
  console.log(`✅ UV serviceworker: /uv/uv.sw.js`);
});
