FROM node:24-alpine
WORKDIR /app
RUN npm install @actual-app/api axios node-cron
COPY sync.js .
CMD ["node", "sync.js"]
