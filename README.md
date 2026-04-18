# 智慧园区安防 AI 管理与仿真平台

后端：FastAPI + SQLAlchemy + SQLite；**前端：Next.js 16 + React + Tailwind（`frontend/`）**，与 FastAPI 直连联调。轨迹与告警流水线见 `services/` 与 `config/pipeline_alerts.yaml`。

**技术栈说明（与部分任务书默认值差异）**：前端实现为 **Next.js**（非 Vue3 + Element Plus）；交付含 **`docker compose` 一键启动**（阶段5），详见下文「Docker」。

## Docker 一键启动（阶段5）

需安装 [Docker](https://docs.docker.com/get-docker/) 与 Docker Compose v2。

```bash
cd /path/to/智慧园区安防AI管理与仿真平台
docker compose up --build
```

- 后端：<http://127.0.0.1:8000/docs>  
- 前端：<http://127.0.0.1:3000>（构建参数 `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`，浏览器在宿主机访问后端同址）  
- **持久化**：命名卷挂载 `database/`、`storage/`；`config/` 与 `data/` 以只读绑定挂载自宿主机。  
- **跑流水线**：将测试 mp4 放在 **`data/videos/`**，调用 `POST /jobs/run_local_path`，body 中 `path` 使用容器路径 **`/app/data/videos/文件名.mp4`**。  
- 首次运行会下载 YOLO 权重，已挂载 `ultralytics-cache` 卷以复用缓存；CPU 推理较慢属正常。  
- 生产环境请设置环境变量 **`JWT_SECRET`**（可在 compose 同目录 `.env` 中配置）。

手动验证清单：**[TESTING.md](./TESTING.md)**。

## 数据集表述（诚实说明）

先验数据（如 **RepCount / LLSP**）为健身/重复动作类视频，**仅用于轨迹流水线与算法验证**；**不得**在文档或界面中将其表述为「园区行人行走数据集」。园区演示请使用自采视频或后续补充数据。

## 环境要求

- Python 3.10+（后端、流水线）
- Node.js 18+ 与 **npm**（前端）

## 后端启动

```bash
cd backend
pip install -r requirements.txt
```

完整流水线（YOLO + DeepSORT）还需在项目根安装根目录 `requirements.txt`（见 `backend/README.md`）。

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API 文档：<http://127.0.0.1:8000/docs>
- 健康检查：<http://127.0.0.1:8000/health>
- 关键帧静态资源（相对项目根 `storage/`）：<http://127.0.0.1:8000/media/frames/...>

默认账号（种子用户）：`admin` / `admin123`，`guard` / `guard123`。

## 前端启动（Next.js）

```bash
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

浏览器访问 **<http://127.0.0.1:3000>**（`npm run dev` 默认端口）。

- 环境变量 **`NEXT_PUBLIC_API_BASE_URL`**（在 `.env.local` 中）默认为 `http://127.0.0.1:8000`，与后端同源跨域已在 `backend/app/main.py` 的 CORS 中放行（含 `3000`、`5000` 等）。

生产构建：

```bash
cd frontend
npm run build
npm run start
```

若仍使用扣子 **`dev:coze`**（`tsx watch src/server.ts`，端口多为 5000），可执行 `npm run dev:coze`（需已安装依赖）。

## 阶段 3 自检（前端 + 联调）

| 项 | 说明 |
|----|------|
| 登录 → 告警 → 反馈 | 使用真实后端：登录后打开告警列表、展开条目、提交 `POST /alerts/{id}/feedback` |
| 仪表盘 / 数据分析 | `/dashboard`、`/analytics` 使用 `GET /dashboard/summary` 与 `GET /alerts` 等真实接口 |
| 文案 | 界面不出现将 RepCount 误标为「园区数据集」的表述 |

## 文档索引

- 后端细节：`backend/README.md`
- 流水线与验收：`docs/pipeline_alerts.md`、`docs/acceptance_p0.md`
- P0 手动验证（命令级）：`TESTING.md`
- 前端补充说明：`frontend/README.md`
- 镜像构建：`docker/Dockerfile.backend`、`docker/Dockerfile.frontend`、`docker-compose.yml`
