# 智慧园区安防 AI 管理与仿真平台

一、项目概述

这是一个面向智慧园区场景的安防管理与仿真平台。我们希望把“视频轨迹分析 + 告警处置 + 前后端联调”串成一条能演示、能验证、也能直接部署的完整链路。

当前技术实现如下：

- 后端：FastAPI + SQLAlchemy + SQLite
- 前端：Next.js 16 + React + Tailwind（目录：`frontend/`）
- 轨迹与告警流水线：`services/` + `config/pipeline_alerts.yaml`

说明：本项目前端使用 Next.js，不是 Vue3 + Element Plus。

---

二、系统结构

项目采用前后端分离结构，核心分为 4 层：

1. 前端展示层：登录、告警列表、仪表盘、数据分析页面  
2. 后端服务层：鉴权、告警接口、任务调度接口  
3. 算法流水线层：YOLO + DeepSORT 轨迹分析、告警触发与落库  
4. 数据与存储层：`database/`（结构化数据）+ `storage/`（关键帧等文件）

---

三、快速启动（Docker）

环境准备：

- [Docker](https://docs.docker.com/get-docker/)
- Docker Compose v2

启动命令：

```bash
cd /path/to/smartpark-security-platform
docker compose up --build
```

启动后访问：

- 后端接口文档：<http://127.0.0.1:8000/docs>
- 前端页面：<http://127.0.0.1:3000>

补充说明：

- 持久化目录：`database/`、`storage/`
- 配置与数据目录：`config/`、`data/`（只读挂载）
- 运行本地视频任务时，将 mp4 放到 `data/videos/`，并调用 `POST /jobs/run_local_path`
- `path` 参数示例：`/app/data/videos/demo.mp4`
- 首次运行会下载 YOLO 权重，CPU 场景下推理慢是正常现象
- 建议在生产环境配置 `JWT_SECRET`（可放在 compose 同目录 `.env`）

手动测试步骤见：`TESTING.md`

---

四、本地开发启动

1) 后端启动

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

如果需要完整流水线（YOLO + DeepSORT），还需在项目根额外安装根目录的 `requirements.txt`，详见 `backend/README.md`。

常用地址：

- API 文档：<http://127.0.0.1:8000/docs>
- 健康检查：<http://127.0.0.1:8000/health>
- 静态关键帧：<http://127.0.0.1:8000/media/frames/...>

默认账号（种子用户）：

- `admin` / `admin123`
- `guard` / `guard123`

2) 前端启动（Next.js）

```bash
cd frontend
copy .env.example .env.local
pnpm install
pnpm dev
```

访问地址：<http://127.0.0.1:3000>

环境变量：

- `NEXT_PUBLIC_API_BASE_URL` 默认是 `http://127.0.0.1:8000`
- 后端 CORS 已放行常用开发端口（包含 `3000`、`5000`）

前端生产构建：

```bash
cd frontend
pnpm build
pnpm start
```

如需兼容旧调试脚本，可执行：`pnpm dev:coze`

---

五、数据集说明（避免误导）

1. `RepCount` / `LLSP` 这类数据本质是健身或重复动作视频，只能用于轨迹流水线与算法验证。  
2. 文档或页面里不能把它们写成“园区行人行走数据集”。  
3. 若做校园异常检测演示，可使用 ShanghaiTech Campus 及本地整理的 `SHANGHAI_Test` 帧序列、索引和 `.npy` 标签。  
4. 所有公开数据都必须写清正式名称、引用和 LICENSE。  
5. 公开数据与“甲方园区实拍”不能混称。

将 Shanghai 类帧序列转为 `.mp4` 并接入流水线的方法见：`docs/dataset_shanghai.md`

---

六、联调自检（阶段 3）

- 登录 -> 查看告警 -> 提交反馈，确保 `POST /alerts/{id}/feedback` 可用
- `dashboard`、`analytics` 页面需走真实后端接口（如 `GET /dashboard/summary`、`GET /alerts`）
- 前端文案不能出现“把 RepCount 说成园区数据集”的错误描述

---

七、文档索引

- 后端说明：`backend/README.md`
- 流水线与验收：`docs/pipeline_alerts.md`、`docs/acceptance_p0.md`
- 手动验证清单：`TESTING.md`
- Shanghai 数据接入：`docs/dataset_shanghai.md`
- 前端补充文档：`frontend/README.md`
- 镜像文件：`docker/Dockerfile.backend`、`docker/Dockerfile.frontend`、`docker-compose.yml`
