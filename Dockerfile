# ─── 构建阶段：编译前端 ───
FROM node:18-alpine AS builder
WORKDIR /app
COPY client/package.json client/package-lock.json* client/
RUN cd client && npm ci --omit=optional
COPY client/ client/
RUN cd client && npm run build

# ─── 运行阶段：仅后端 + 静态资源 ───
FROM node:18-alpine
WORKDIR /app

# 后端依赖
COPY server/package.json server/package-lock.json* server/
RUN cd server && npm ci --production --omit=optional

# 复制后端源码
COPY server/ server/

# 复制前端构建产物
COPY --from=builder /app/client/build /app/client/build

# 复制根配置
COPY .env.example /app/.env.example
COPY README.md /app/README.md

# 复制训练数据（AI 对战历史，可选）
COPY training_data.json /app/training_data.json 2>/dev/null || true

ENV NODE_ENV=production
ENV PORT=5000
ENV CLIENT_ORIGIN=http://localhost:5000

EXPOSE 5000
CMD ["node", "server/app.js"]
