# Use Node 18+
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files first (for caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all remaining files (including index.html, server.js, etc.)
COPY . .

# Expose the port Koyeb expects
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
