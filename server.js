// server.js — Final version: Frontend + Ultraviolet client + Bare backend

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
import uvPkg from "@titaniumnetwork-dev/ultraviolet"; // CommonJS export

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
const staticDir = __dirname;
app.use(express.static(staticDir));

app.get("/", (_req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});

// -------- Ultraviolet (client + worker) --------
const { uvPath } = uvPkg;

// Serve all UV files directly from node_modules
app.use(
  "/uv/",
  express.static(uvPath, {
    setHeaders(res, filePath) {
      if (filePath.endsWith("uv.sw.js") || filePath.endsWith("uv.config.js")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.setHeader("Service-Worker-Allowed", "/uv/");
      }
    },
  })
);

// Ensure /uv.sw.js works too (alias for browsers registering root-level SW)
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

// Runtime UV config
app.get("/uv/uv.config.js", (_req, res) => {
  const cfg = `
    self.__uv$config = {
      prefix: '/uv/service/',
      bare: '/bare/',
      encodeUrl: Ultraviolet.codec.xor.encode,
      decodeUrl: Ultraviolet.codec.xor.decode,
      handler: '/uv/uv.handler.js',
      bundle: '/uv/uv.bundle.js',
      // ✅ Correct SW path now:
      sw: '/uv/uv.sw.js',
      client: '/uv/index.html'
    };
  `.trim();
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Service-Worker-Allowed", "/uv/");
  res.type("application/javascript").send(cfg);
});

// -------- Bare backend --------
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
  console.log(`✅ Frontend:     /`);
  console.log(`✅ UV files:     /uv/uv.bundle.js`);
  console.log(`✅ ServiceWorker: /uv/uv.sw.js`);
});
