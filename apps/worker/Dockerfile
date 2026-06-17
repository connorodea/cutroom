# Cutroom media worker — standalone (Railway Root Directory = apps/worker).
# Build stage bundles the service; runtime image carries ffmpeg + ffprobe.

FROM node:22-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg imagemagick ca-certificates fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/dist/index.mjs ./index.mjs
ENV PORT=8080
# Fonts for ImageMagick overlay text (fonts-dejavu-core).
ENV OVERLAY_FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
ENV OVERLAY_FONT_REGULAR=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
EXPOSE 8080
CMD ["node", "index.mjs"]
