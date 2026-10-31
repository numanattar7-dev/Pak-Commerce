FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api-backend/package*.json ./apps/api-backend/
COPY packages/database/package*.json ./packages/database/
COPY packages/common-types/package*.json ./packages/common-types/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma

# Build the application
RUN npm run build --workspace=apps/api-backend

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built application
COPY --from=builder /app/apps/api-backend/dist ./dist
COPY --from=builder /app/apps/api-backend/package*.json ./
COPY --from=builder /app/packages/database/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4000

CMD ["node", "dist/main.js"]