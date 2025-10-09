// server.js — Frontend + Ultraviolet (client/worker) + Bare backend (Node 18–22)

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
import uvPkg from "@titaniumnetwork-dev/ultraviolet"; // CommonJS-style export

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- __dirname for ES modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------- Middleware ----------------
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));

app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// ------------- Front-end hosting -------------
// Prefer /public if it exists; otherwise serve from repo root.
const candidateA = path.join(__dirname, "public");
const candidateB = __dirname;
const staticDir = fs.existsSync(candidateA) ? candidateA : candidateB;

console.log("Static directory:", staticDir);
console.log("Expecting index.html at:", path.join(staticDir, "index.html"));

app.use(express.static(staticDir));

app.get("/", (_req, res) => {
  const indexPath = path.join(staticDir, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res
      .status(404)
      .send(
        `index.html not found at ${indexPath}.<br/>` +
          `Static dir is ${staticDir}.<br/>` +
          `Ensure the file is committed and deployed.`
      );
  }
});

// --------- Ultraviolet client/worker setup ---------
const { uvPath } = uvPkg; // source folder inside node_modules
const uvOut = path.join(__dirname, "uv"); // we’ll serve from here

try {
  fs.mkdirSync(uvOut, { recursive: true });
  // Node 16+: cpSync supports { recursive: true }
  fs.cpSync(uvPath, uvOut, { recursive: true });
  console.log("Copied Ultraviolet assets to:", uvOut);
} catch (e) {
  console.error("Failed to copy UV assets:", e?.message);
}

// Serve the copied UV assets under /uv/, with no-cache for SW and config
app.use(
  "/uv/",
  express.static(uvOut, {
    setHeaders(res, filePath) {
      if (filePath.endsWith("uv.sw.js") || filePath.endsWith("uv.config.js")) {
        res.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, proxy-revalidate"
        );
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("Service-Worker-Allowed", "/uv/");
      }
    },
  })
);

// UV runtime config (tells client the paths/prefix)
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
  res.type("application/javascript").send(cfg);
});

// -------------- Bare backend wiring --------------
// Bare is not an Express middleware; attach at HTTP server layer.
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

// --------------- Fallback 404 ----------------
app.use((req, res) => res.status(404).send("404: Not Found"));

// ----------------- Start ---------------------
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  console.log(`✅ Front-end:     http://localhost:${PORT}/`);
  console.log(`✅ UV assets:     http://localhost:${PORT}/uv/`);
  console.log(`✅ Bare backend:  http://localhost:${PORT}/bare/ (internal)`);
});
