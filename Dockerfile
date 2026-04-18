FROM node:20-alpine

WORKDIR /app

# Copy package info and install dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY server.js db.js scraper.js backfill-time.js ./
COPY public ./public

# Create data directory for SQLite volume
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["npm", "start"]
