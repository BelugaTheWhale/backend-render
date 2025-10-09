// server.js — Minimal, loud, and reliable
// Frontend + Ultraviolet client/worker (direct from node_modules) + Bare backend

import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";
import { createBareServer } from "@tomphttp/bare-server-node";
import uvPkg from "@titaniumnetwork-dev/ultraviolet";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- __dirname for ES modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------- Middleware ----------------
app.use(compression());
app.use(morgan("dev"));

// (Optional) noisy 404 logger so we can see missing files in logs
app.use((req, res, next) => {
  const end = res.end;
  res.end = function (...args) {
    if (res.statusCode === 404) {
      console.warn("404:", req.method, req.originalUrl);
    }
    end.apply(this, args);
  };
  next();
});

// Health check
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// ---------------- Frontend ----------------
// Serve from /public if present; else repo root
const candidateA = path.join(__dirname, "public");
const staticDir = fs.existsSync(candidateA) ? candidateA : __dirname;
app.use(express.static(staticDir));

app.get("/", (_req, res) => {
  const indexPath = path.join(staticDir, "index.html");
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  return res
    .status(404)
    .send(
      `index.html not found at ${indexPath}<br/>Static dir: ${staticDir}`
    );
});

// ---------------- UV client/worker ----------------
const { uvPath } = uvPkg;
console.log("uvPath (from package):", uvPath);

try {
  const sample = fs.readdirSync(uvPath).slice(0, 10);
  console.log("uvPath sample files:", sample);
} catch (e) {
  console.error("Cannot read uvPath:", e?.message);
}

// Serve *all* UV files directly from node_modules path
app.use(
  "/uv/",
  express.static(uvPath, {
    setHeaders(res, filePath) {
      // Critical: worker + config must not be cached; allow /uv/ scope
      if (filePath.endsWith("uv.sw.js") || filePath.endsWith("uv.config.js")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("Service-Worker-Allowed", "/uv/");
      }
    },
  })
);

// Redundant explicit routes (belt + suspenders) with headers
function sendUvFile(rel) {
  return (req, res) => {
    const p = path.join(uvPath, rel);
    if (!fs.existsSync(p)) {
      console.error("UV file missing:", p);
      return res.status(404).send(`Missing UV file: ${rel}`);
    }
    if (rel.endsWith("uv.sw.js") || rel.endsWith("uv.config.js")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Service-Worker-Allowed", "/uv/");
    }
    res.sendFile(p);
  };
}

app.get("/uv/uv.bundle.js", sendUvFile("uv.bundle.js"));
app.get("/uv/uv.handler.js", sendUvFile("uv.handler.js"));
app.get("/uv/uv.sw.js", sendUvFile("uv.sw.js"));

// Runtime config (must match paths above)
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
      client: '/uv/index.html'
    };
  `.trim();
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Service-Worker-Allowed", "/uv/");
  res.type("application/javascript").send(cfg);
});

// ---------------- Bare backend wiring ----------------
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

// ---------------- Fallback 404 ----------------
app.use((req, res) => res.status(404).send("404: Not Found"));

// ---------------- Start ----------------
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server on http://0.0.0.0:${PORT}`);
  console.log(`✅ Test these must be 200:`);
  console.log(`   /uv/uv.bundle.js`);
  console.log(`   /uv/uv.handler.js`);
  console.log(`   /uv/uv.sw.js`);
  console.log(`   /uv/uv.config.js`);
});
