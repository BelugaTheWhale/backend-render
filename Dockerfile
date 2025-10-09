# Use Node 18+ (Alpine = small)
FROM node:18-alpine

# Create app dir
WORKDIR /app

# Copy package files and install deps first (layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest (server.js, index.html, etc.)
COPY . .

# Expose port
EXPOSE 3000

# Run
CMD ["npm", "start"]
