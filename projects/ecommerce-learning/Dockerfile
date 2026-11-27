FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && chown -R node:node /app/.next
USER node
EXPOSE 3000
CMD ["npm","start"]
