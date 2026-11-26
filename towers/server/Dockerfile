# Jalankan dari root repo: docker build -f server/Dockerfile -t towers-api .
FROM node:22-alpine
WORKDIR /app
COPY js ./js
COPY server ./server
RUN mkdir -p server/data && chown node:node server/data
USER node
EXPOSE 8787
CMD ["node", "server/server.js"]
