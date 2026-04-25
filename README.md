# 智慧园区安防 AI 管理与仿真平台

一、项目概述

这是一个面向智慧园区场景的安防管理与仿真平台。当前版本已经从“前端页面 + 后端接口 + 逐帧告警”的原型，升级为以前端为唯一入口的事件驱动安防系统：用户可以在前端完成登录注册、摄像头管理、视频分析、场景规则配置、人脸识别/人员授权、告警查看、误报反馈和 AI 助手问答。

当前技术实现如下：

- 后端：FastAPI + SQLAlchemy + SQLite
- 前端：Next.js 16 + React + Tailwind（目录：`frontend/`）
- 轨迹与告警流水线：`services/` + `config/pipeline_alerts.yaml`
- 事件驱动告警：场景规则 -> 原子事件 -> 复合事件 -> 分级告警
- 人脸识别与授权：本地人脸模板、人员授权、轨迹身份识别、告警分级联动

说明：本项目前端使用 Next.js，不是 Vue3 + Element Plus。

---

二、系统结构

项目采用前后端分离结构，核心分为 6 层：

1. 前端展示层：登录注册、仪表盘、实时监控、场景规则、人脸识别、告警中心、数据分析、AI 助手  
2. 后端服务层：鉴权、摄像头、视频任务、场景规则、人员授权、告警反馈、AI 助手接口  
3. 轨迹流层：YOLO + DeepSORT 输出带 `track_id`、`camera_id`、时间戳和位置历史的轨迹  
4. 场景规则层：支持区域、越线、门/入口、方向、敏感点靠近五类规则  
5. 行为分析与告警层：原子事件进入行为分析，生成徘徊、入侵、逆行、尾随、聚集等复合事件后才报警  
6. 数据与存储层：`database/`（结构化数据）+ `storage/`（上传视频、关键帧、人脸照片、识别证据）

---

三、核心能力

- 前端唯一入口：上传视频、启动分析、查看任务、配置摄像头和规则、查看告警、反馈误报均在前端完成。
- 事件驱动告警：检测仍逐帧进行，但帧只更新轨迹状态，告警由复合事件生成，不再由单帧直接触发。
- 场景规则配置：支持 `area`、`line_crossing`、`door`、`direction`、`object_proximity`。
- 告警分级：后端根据区域风险、摄像头点位、时间段、人员授权状态、复合事件类型计算 `critical`、`high`、`medium`、`low`。
- 人脸识别与授权：前端可录入人员、上传人脸照片、设置授权规则；流水线会把识别结果绑定到轨迹并参与告警分级。
- 多摄像头支持：摄像头、轨迹、规则、事件、告警均支持 `camera_id` 绑定。
- 证据查看：上传视频、关键帧、人脸证据统一通过后端 `/media/...` 暴露给前端。
- 反馈闭环：同一条告警只有一个最终反馈状态，可以修改，反馈会进入后续误报优化数据。
- AI 助手：前端调用后端助手接口，基于系统告警、摄像头、规则等结构化数据给出回答。

---

四、快速启动（Docker）

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

五、本地开发启动

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

六、数据集说明（避免误导）

1. `RepCount` / `LLSP` 这类数据本质是健身或重复动作视频，只能用于轨迹流水线与算法验证。  
2. 文档或页面里不能把它们写成“园区行人行走数据集”。  
3. 若做校园异常检测演示，可使用 ShanghaiTech Campus 及本地整理的 `SHANGHAI_Test` 帧序列、索引和 `.npy` 标签。  
4. 所有公开数据都必须写清正式名称、引用和 LICENSE。  
5. 公开数据与“甲方园区实拍”不能混称。

将 Shanghai 类帧序列转为 `.mp4` 并接入流水线的方法见：`docs/dataset_shanghai.md`

---

七、联调自检

- 登录/注册 -> 前端上传视频 -> 启动分析 -> 查看任务状态
- 场景规则页创建区域/越线/门/方向/敏感点规则
- 人脸识别页新增人员 -> 上传人脸照片 -> 配置授权规则
- 告警中心查看等级、原因、关键帧、轨迹和反馈状态
- 同一告警重复反馈时应更新最终反馈，而不是新增多个最终状态
- 前端文案不能出现“把 RepCount 说成园区数据集”的错误描述

---

八、当前限制

- 跨摄像头同一人高准确率续接需要 Re-ID 模型和现场拓扑标定；当前已实现拓扑关联和可扩展数据结构。
- 浏览器不能直接播放原生 RTSP，实时画面播放需要 HLS/WebRTC 网关；后端目前可以拉流分析。
- 本地人脸识别使用轻量 embedding 兜底实现，适合演示人员库、授权状态和告警分级闭环；生产级准确率建议接入 InsightFace、ArcFace 或企业门禁/人脸系统。

---

九、文档索引

- 后端说明：`backend/README.md`
- 流水线与验收：`docs/pipeline_alerts.md`、`docs/acceptance_p0.md`
- 手动验证清单：`TESTING.md`
- Shanghai 数据接入：`docs/dataset_shanghai.md`
- 前端补充文档：`frontend/README.md`
- 镜像文件：`docker/Dockerfile.backend`、`docker/Dockerfile.frontend`、`docker-compose.yml`
