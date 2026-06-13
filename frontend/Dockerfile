FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_META_APP_ID
ENV NEXT_PUBLIC_META_APP_ID=$NEXT_PUBLIC_META_APP_ID
ARG NEXT_PUBLIC_META_CONFIG_ID
ENV NEXT_PUBLIC_META_CONFIG_ID=$NEXT_PUBLIC_META_CONFIG_ID
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copiar archivos del builder con el dueño correcto (usuario `node` viene en la imagen base)
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Cambiar a usuario no-root antes de exponer y arrancar
USER node

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "--max-old-space-size=512", "--expose-gc", "server.js"]
