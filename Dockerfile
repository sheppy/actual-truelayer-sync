FROM node:24-slim
WORKDIR /app
RUN npm install @actual-app/api axios node-cron
COPY sync.js .
CMD ["node", "sync.js"]
