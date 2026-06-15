# 🃏 昆特牌对战平台 (Gwent Battle)

基于《巫师3》昆特牌的在线对战平台，支持人机对战与玩家对战，内置 Ollama 本地大模型 AI 对手。

## 项目结构

```
├── server/                  # 后端（Node.js + Express 5 + Socket.IO 4）
│   ├── ai/                  # AI 决策模块
│   │   ├── AIInterface.js   #   AI 抽象基类
│   │   ├── HeuristicAI.js   #   启发式规则引擎（兜底 AI）
│   │   ├── OllamaAgent.js   #   Ollama 大模型 Agent（工具调用驱动）
│   │   ├── tools.js         #   Tool 定义 / 解析 / 执行
│   │   ├── skills.js        #   阵营克制等技能提示
│   │   ├── ollama-config.json
│   │   └── index.js         #   AI 工厂 + 注册表
│   ├── db/                  # SQLite 数据库
│   │   ├── schema.js        #   表结构 DDL
│   │   └── dbUtils.js       #   数据库工具类
│   ├── gameLogic/           # 昆特牌核心逻辑
│   │   ├── cards.js         #   完整卡牌数据库（基于 Witcher 3）
│   │   ├── gameState.js     #   对局状态机
│   │   ├── gameManager.js   #   对局管理（创建 / 匹配 / 对战）
│   │   └── trainingRecorder.js  # 训练数据录制器
│   ├── routes/              # REST API 路由
│   │   └── index.js         #   /api/cards, /api/health, /api/matches
│   ├── test/                # 测试脚本
│   │   ├── diagnoseOllama.js    # Ollama 连通性诊断
│   │   ├── stressOllama.js      # Ollama 压力测试
│   │   ├── testAI.js            # AI 决策单元测试
│   │   ├── testAIBattle.js      # AI 对战模拟
│   │   ├── testgameLogic.js     # 游戏逻辑测试
│   │   ├── testRoutes.js        # API 路由测试
│   │   └── test_comprehensive.js
│   ├── app.js               # Express + Socket.IO 入口
│   └── package.json
├── client/                  # 前端（React 19 + Chakra UI v3）
│   ├── build/               # 生产构建产物
│   ├── public/
│   ├── src/
│   │   ├── components/      # GameBoard / DeckBuilder / PlayerList / MouseTooltip
│   │   ├── hooks/           # useWebSocket
│   │   ├── constants.js
│   │   ├── App.js
│   │   └── index.js
│   ├── patches/             # react-scripts patch
│   └── package.json
├── scripts/                 # 工具脚本
│   ├── kill-ports.js        # 跨平台端口清理
│   └── kill-ports.ps1
├── Dockerfile               # 多阶段 Docker 构建
├── .env.example             # 环境变量模板
├── training_data.json       # AI 训练数据样例
└── package.json             # 根工作区（concurrently）
```

## 技术栈

| 层 | 技术 |
|---|------|
| **前端** | React 19 · Chakra UI v3 · Emotion · Framer Motion · Socket.IO Client |
| **后端** | Node.js 18+ · Express 5 · Socket.IO 4 · better-sqlite3 |
| **AI** | Ollama (qwen2.5:1.5b) · 工具调用 Agent · 启发式规则回退 |
| **通信** | REST API · WebSocket 实时对战 |
| **构建** | react-scripts · concurrently · Docker 多阶段构建 |

---

## 🚀 快速开始（开发环境）

### 前置条件

- Node.js ≥ 18
- （可选）Ollama — 用于大模型 AI 对手，[安装指南](https://ollama.com)

```bash
# 安装 Ollama 并拉取模型（可选，不装则自动回退到启发式 AI）
ollama pull qwen2.5:1.5b
ollama serve
```

### 安装与启动

```bash
# 1. 安装所有依赖
npm run install:all

# 2. 一键启动前后端（server :5000 + client :3000）
npm start
```

- 前端: http://localhost:3000
- 后端: http://localhost:5000

浏览器打开 http://localhost:3000，输入昵称进入大厅，选择「🤖 AI 对手」即可开始对战。

---

## 🎮 游戏玩法

### 基本规则

昆特牌是《巫师3》中的经典卡牌游戏，三局两胜制。每局双方轮流出牌，战力高者赢得该局。

### 卡牌能力

| 能力 | 效果 |
|------|------|
| **英雄 (Hero)** | 免疫所有特殊效果（天气/号角/烧灼） |
| **间谍 (Spy)** | 打出到对方场上，自己抽 2 张牌 |
| **医生 (Medic)** | 从墓地复活一张牌 |
| **召集 (Muster)** | 从牌组拉出所有同名卡 |
| **同袍 (Tight Bond)** | 同名卡战力翻倍 |
| **提振士气 (Morale Boost)** | 同排所有单位 +1 战力 |
| **烧灼 (Scorch)** | 消灭场上战力最高的非英雄单位 |

### 阵营

| 阵营 | 特色 |
|------|------|
| **北方领域 (Northern)** | 赢得一局后额外抽一张牌 |
| **尼弗迦德 (Nilfgaard)** | 平局算胜利 |
| **松鼠党 (Scoia'tael)** | 决定谁先手 |
| **怪物 (Monsters)** | 每局结束后随机保留一个单位 |

---

## 🤖 AI 系统

项目内置两级 AI 系统：

| 级别 | 实现 | 说明 |
|------|------|------|
| **OllamaAgent** | Ollama 本地大模型 | 工具调用驱动，模型输出 JSON 决策，解析后执行 |
| **HeuristicAI** | 启发式规则引擎 | 基于规则的最优出牌策略，始终可用，无需外部依赖 |

### 工作流程

```
游戏请求 → OllamaAgent.decideAction()
              ├─ _buildPrompt()    构建精简 prompt（~100 tokens）
              ├─ _callOllama()     调用 Ollama API
              ├─ parseToolCall()   解析 JSON 工具调用
              ├─ executeTool()     执行 play_card / pass_turn
              └─ 失败 → _fallbackDecision() → HeuristicAI
```

### AI 配置

```env
# .env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:1.5b
OLLAMA_TEMPERATURE=0.1
OLLAMA_TIMEOUT=15000
```

也可以通过 `server/ai/ollama-config.json` 修改默认值。

### 测试工具

```bash
# Ollama 连通性诊断（4 步检测）
node server/test/diagnoseOllama.js

# Ollama 压力测试（N 轮对战模拟）
node server/test/stressOllama.js

# AI 对战模拟
node server/test/testAIBattle.js
```

---

## 📦 生产部署

### 1. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，必改项：

```env
PORT=5000
CLIENT_ORIGIN=https://你的域名.com

# Ollama AI
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:1.5b
OLLAMA_TEMPERATURE=0.1
OLLAMA_TIMEOUT=15000
```

### 2. 构建并启动

```bash
# 安装依赖 + 构建前端 + 启动生产服务
npm run deploy

# 或分步：
npm run install:all
npm run build
npm run start:prod
```

生产模式下前后端共用端口 5000，访问 `http://服务器IP:5000` 即可。

### 3. 进程守护（推荐）

```bash
npm install -g pm2
pm2 start server/app.js --name gwent
pm2 save
pm2 startup
```

### 4. Nginx 反向代理（可选）

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

### 5. Docker 部署

```bash
docker build -t gwent .
docker run -d -p 5000:5000 --env-file .env gwent
```

---

## 🧪 测试

```bash
# 后端测试
npm test --prefix server

# 前端测试
npm test --prefix client

# 游戏逻辑测试
node server/test/testgameLogic.js

# API 路由测试
node server/test/testRoutes.js
```

---

## 📡 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/cards` | 获取所有卡牌数据 + 阵营信息 |
| GET | `/api/matches/:userId` | 获取玩家历史对局 |

WebSocket 事件通过 Socket.IO 实时通信，包括：`joinLobby`, `requestGame`, `playCard`, `pass`, `gameOver` 等。

---

## 🌐 环境变量参考

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `5000` | 服务端口 |
| `CLIENT_ORIGIN` | `http://localhost:3000` | CORS 允许的前端来源 |
| `DB_PATH` | 留空 | SQLite 数据库路径（默认 `server/db/gwent.db`） |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API 地址 |
| `OLLAMA_MODEL` | `qwen2.5:1.5b` | Ollama 模型名 |
| `OLLAMA_TEMPERATURE` | `0.1` | 生成温度 |
| `OLLAMA_TIMEOUT` | `15000` | API 超时（毫秒） |

---

## 🗄️ 数据库

使用 SQLite（`server/db/gwent.db`），表结构：

- `users` — 玩家信息
- `matches` — 对局记录
- `match_rounds` — 每局回合详情
- `match_turns` — 每回合操作记录
- `player_stats` — 玩家统计数据

---

## 📜 可用脚本

| 命令 | 说明 |
|------|------|
| `npm start` | 开发模式：前后端同时启动 |
| `npm run dev` | 开发模式：后端 watch 模式 |
| `npm run build` | 构建前端到 `client/build/` |
| `npm run start:prod` | 生产模式：仅启动后端（托管前端静态资源） |
| `npm run deploy` | 安装依赖 + 构建 + 生产启动 |
| `npm test` | 运行所有测试 |
| `npm run install:all` | 安装前后端所有依赖 |

---

## 📝 许可

MIT
