# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install all dependencies (including devDependencies for TypeScript compilation)
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Build/compile the TypeScript code to JavaScript
RUN npm run build

# --- Production Stage ---
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy dependency definitions
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy compiled JavaScript output from the builder stage
COPY --from=builder /app/dist ./dist

# Copy the static data files (station coordinates, schedule databases)
COPY --from=builder /app/src/data ./src/data

# Expose the port the Express app runs on
EXPOSE 3000

# Run the app
CMD ["node", "dist/http-streamable.js"]
