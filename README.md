# Ultraviolet Backend (Render) — Customizable

This is a ready-to-deploy backend for the Ultraviolet proxy on **Render**.

## Deploy (Render)
1. Push this folder to a GitHub repo.
2. In Render, click **New → Web Service**, connect the repo.
3. Use:
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `node server.js`
4. Deploy. Your URL will be like `https://<your-app>.onrender.com`.

## Environment Variables
- `PORT` (auto by Render)
- `BARE_PATH=/bare/` — internal path for bare server
- `UV_PUBLIC_PATH=/` — where to serve UV static files
- `ENABLE_LOGS=true`
- `CORS_ORIGIN=*`
- `RATE_POINTS=200` / `RATE_DURATION=60`

## Customize
- Branding/UI is provided by Ultraviolet’s client bundle (served from `uvPath`). 
  If you want a **custom UI**, use the Firebase frontend in this project and embed your backend.
