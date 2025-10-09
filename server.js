// server.js — Frontend + Ultraviolet (client) + Bare (backend)

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";
import { createBareServer } from "@tomphttp/bare-server-node";
import uvPkg from "@titaniumnetwork-dev/ultraviolet";

const { uvPath } = uvPkg; // client assets path

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

// UV runtime config (tells the client where the service prefix & bare endpoint are)
app.get("/uv/uv.config.js", (_req, res) => {
  // Adjust as needed; these defaults work with this server
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

// ---------- Bare backend ----------
const bare = createBareServer("/bare/");
app.use("/bare/", bare.middleware);

// 404 (optional)
app.use((req, res) => res.status(404).send("404: Not Found"));

// ---------- Start ----------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  console.log(`✅ Front-end: http://localhost:${PORT}/`);
  console.log(`✅ UV client files: http://localhost:${PORT}/uv/`);
});
