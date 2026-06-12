# 🃏 昆特牌对战平台 (Gwent Battle)

基于《巫师3》昆特牌的在线对战平台，支持人机对战与玩家对战，内置 Ollama 本地大模型 AI 对手。

## 项目结构

```
├── server/              # 后端（Node.js + Express 5 + Socket.IO）
│   ├── ai/              # AI 决策模块（OllamaAgent / 启发式规则）
│   ├── db/              # SQLite 数据库 + 工具类
│   ├── gameLogic/       # 昆特牌核心逻辑（状态管理 / 卡牌 / 对局管理）
│   ├── routes/          # REST API 路由
│   ├── app.js           # Express + Socket.IO 入口
│   └── package.json
├── client/              # 前端（React 19 + Chakra UI v3）
│   ├── build/           # 生产构建产物
│   ├── public/          # 静态资源
│   ├── src/
│   │   ├── components/  # React 组件（GameBoard / DeckBuilder / PlayerList）
│   │   ├── hooks/       # 自定义 hooks（useWebSocket）
│   │   ├── App.js       # 应用入口
│   │   └── index.js
│   └── package.json
├── .env.example         # 环境变量模板
└── package.json         # 根工作区（concurrently 管理）
```

## 技术栈

| 层 | 技术 |
|---|------|
| **前端** | React 19 · Chakra UI v3 · Emotion · Framer Motion · Socket.IO Client |
| **后端** | Node.js · Express 5 · Socket.IO 4 · SQLite3 |
| **AI** | Ollama (qwen2.5:7b) · 启发式规则引擎 |
| **通信** | REST API · WebSocket 实时对战 |
| **构建** | react-scripts · concurrently |

---

## 🚀 快速开始（开发环境）

### 前置条件

- Node.js ≥ 18
- （可选）Ollama — 用于 AI 对手，[安装指南](https://ollama.com)

```bash
# 安装 Ollama 并拉取模型（可选，不装则自动回退到启发式 AI）
ollama pull qwen2.5:7b
ollama serve
```

### 安装与启动

```bash
# 1. 安装所有依赖
npm run install:all

# 2. 一键启动前后端（server:5000 + client:3000）
npm start
```

- 前端: http://localhost:3000
- 后端: http://localhost:5000

浏览器打开 http://localhost:3000，输入昵称进入大厅，选择"🤖 AI 对手"即可开始对战。

---

## 📦 生产部署

### 1. 安装依赖

```bash
npm run install:all
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，必改项：

```env
# 服务端口
PORT=5000

# 前端访问来源（必改！）
CLIENT_ORIGIN=https://你的域名.com
```

可选项（Ollama AI 配置）：

```env
# 如果 Ollama 运行在其他机器上
OLLAMA_BASE_URL=http://ollama服务器IP:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_TEMPERATURE=0.3
OLLAMA_TIMEOUT=10000
```

### 3. 构建前端

```bash
npm run build
```

> 构建产物输出到 `client/build/`，服务端会自动检测并托管静态资源。

### 4. 启动服务

```bash
# 一键构建 + 启动
npm run deploy

# 或分步操作
npm run start:prod
```

生产模式下**前后端共用一个端口**（默认 5000），访问 `http://服务器IP:5000` 即可。

### 5. 进程守护（推荐）

```bash
# 使用 PM2
npm install -g pm2
pm2 start server/app.js --name gwent
pm2 save
pm2 startup
```

### 6. Nginx 反向代理（可选）

```nginx
server {
    listen 80;
    server_name 你的域名.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 7. Docker 部署

```bash
# 构建镜像
docker build -t gwent .

# 运行容器
docker run -d -p 5000:5000 \
  -v gwent_db:/app/server/db \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  --name gwent \
  gwent
```

`docker-compose.yml` 示例：

```yaml
version: '3.8'
services:
  gwent:
    build: .
    ports:
      - "5000:5000"
    volumes:
      - gwent_db:/app/server/db
      - ./.env:/app/.env:ro
    environment:
      - NODE_ENV=production
    restart: unless-stopped

volumes:
  gwent_db:
```

```bash
docker-compose up -d
```

---

---

## 🌐 环境变量参考

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `5000` | 服务端口 |
| `CLIENT_ORIGIN` | `http://localhost:3000` | CORS 允许的前端来源 |
| `DB_PATH` | 留空 | SQLite 数据库路径（默认 `server/db/gwent.db`） |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API 地址 |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Ollama 模型名 |
| `OLLAMA_TEMPERATURE` | `0.3` | 生成温度 |
| `OLLAMA_TIMEOUT` | `10000` | API 超时毫秒 |
| `REACT_APP_SOCKET_URL` | `http://localhost:5000` | 前端 WebSocket 地址 |
| `REACT_APP_API_URL` | 留空 | 前端 API 地址（留空 = 同源） |

---

## 🤖 AI 对手

项目内置两种 AI 实现，通过 `server/ai/index.js` 工厂切换：

```js
const ai = createAI('heuristic');   // 启发式规则（默认回退）
const ai = createAI('ollama');       // Ollama 大模型
```

Ollama 调用失败时**自动回退**到启发式规则，确保游戏不会卡死。

修改 AI 参数无需改代码，编辑 `server/ai/ollama-config.json`：

```json
{
  "model": "qwen2.5:7b",
  "baseUrl": "http://localhost:11434",
  "temperature": 0.3,
  "timeout": 10000
}
```

---

## 📜 可用脚本

| 命令 | 说明 |
|------|------|
| `npm start` | 开发模式：前后端同时启动 |
| `npm run build` | 构建前端到 `client/build/` |
| `npm run start:prod` | 生产模式：仅启动后端（托管前端静态资源） |
| `npm run deploy` | 构建 + 生产启动 |
| `npm test` | 运行所有测试 |
| `npm run install:all` | 安装前后端所有依赖 |

---

## 🃏 卡牌能力一览

| 能力 | 图标 | 说明 |
|------|------|------|
| 间谍 (Spy) | 🕵️ | 打到对方场上，我方抽 2 张 |
| 医生 (Medic) | 💊 | 从己方墓地复活一张非英雄单位 |
| 召集 (Muster) | 👥 | 自动拉出同名卡 |
| 紧紧团结 (Tight Bond) | 🔗 | 同名卡战力翻倍 |
| 士气 (Morale Boost) | 📯 | 同排单位 +1 战力 |
| 烧灼 (Scorch) | 🔥 | 摧毁全场最高战力非英雄单位 |
| 号角 (Horn) | 📯 | 指定排战力翻倍 |
| 诱饵 (Decoy) | 🃏 | 收回己方战场一张单位 |

### 领袖技能

| 领袖 | 能力 |
|------|------|
| 弗尔泰斯特 | 号角 — 指定排战力翻倍 |
| 法兰西斯卡 | 晴空 — 清除所有天气效果 |

---

## 📄 License

ISC
