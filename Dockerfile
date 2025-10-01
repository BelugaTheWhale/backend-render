# Minimal Dockerfile for Ultraviolet backend
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --production

# Copy app code
COPY server.js ./

EXPOSE 8080
CMD ["node", "server.js"]
