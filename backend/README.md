# 后端 API（阶段1 + 阶段2）

FastAPI + SQLAlchemy + SQLite（`../database/app.db`）。阶段2 增加：YOLOv10 + DeepSORT 轨迹入库、提前预警、去抖、异步任务。

## 环境

- Python 3.10+
- **轨迹/告警流水线**依赖项目根目录的 `requirements.txt`（`ultralytics`、`deep-sort-realtime`、`opencv-python` 等）。仅跑 API 可只装 `backend/requirements.txt`；跑 `POST /jobs/run_local_path` 或批处理脚本时请在**项目根**执行 `pip install -r requirements.txt` 与 `pip install -r backend/requirements.txt`。

## 安装

```bash
cd backend
pip install -r requirements.txt
```

（完整流水线请在项目根再执行 `pip install -r requirements.txt`。）

## 启动

在 **`backend` 目录** 下：

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- 交互文档：<http://127.0.0.1:8000/docs>
- 健康检查：<http://127.0.0.1:8000/health>

## 数据（数据集诚实说明）

- **RepCount**（及同类健身/重复动作先验数据）可用于**批量测试**轨迹管道与算法验证，场景为**健身/室内运动**，与**园区安防业务是跨域**的；**不得**在文档中将其表述为「园区行人行走数据集」。
- **园区**演示与上线应使用**自采视频**或经明确标注的数据源；RepCount 仅作流水线验证，不代表园区场景分布。
- 批量脚本默认根目录由环境变量 **`DATASET_VIDEO_ROOT`** 指定；未设置时尝试 `<项目根>/data/RepCount/video/train`（若不存在请自行设置路径）。

## 流水线配置

- 预警阈值、ROI、去抖：`config/pipeline_alerts.yaml`
- 说明：`docs/pipeline_alerts.md`

## 默认账号（种子用户）

| 用户名 | 密码     | 角色  |
|--------|----------|-------|
| admin  | admin123 | admin |
| guard  | guard123 | guard |

密码经 `bcrypt` 哈希后存入数据库。

## 环境变量（可选）

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | 覆盖默认 SQLite 路径 |
| `JWT_SECRET` | JWT 签名密钥（生产环境必改） |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 令牌有效期（默认 1440） |
| `DATASET_VIDEO_ROOT` | RepCount 等视频根目录（批处理脚本） |

## 数据库

首次启动会 `create_all` 建表；若旧库缺 `alerts.job_id` 列，启动时会尝试 `ALTER TABLE` 补列。未使用 Alembic。

## 阶段2 / 阶段3 API 摘要

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/alerts` | 告警列表；支持 `level`、`skip`、`limit` |
| GET | `/alerts/{id}` | 告警详情 |
| POST | `/alerts/{id}/feedback` | 闭环反馈 |
| GET | `/dashboard/summary` | 大屏统计（今日告警、近 7 日、反馈误报率、任务状态等） |
| GET | `/jobs` | 最近分析任务列表 |
| GET | `/jobs/{job_id}` | 任务状态与轨迹点/摘要/告警计数 |
| POST | `/jobs/run_local_path` | body `{"path":"..."}`，异步跑流水线，立即返回 `job_id` |

静态文件：关键帧图片位于项目根 `storage/frames/`，HTTP 路径为 **`GET /media/frames/...`**（与 `keyframe_path` 中 `storage/frames/...` 对应）。

前端（Next.js）见项目根 **`frontend/`** 与根目录 **`README.md`**。

## curl 示例（bash）

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .access_token)

# 异步跑本地视频（需已安装根目录 requirements 以加载 YOLO）
curl -s -X POST http://127.0.0.1:8000/jobs/run_local_path \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path":"D:/datasets/RepCount/video/train/some.mp4"}'

# 查询任务
curl -s http://127.0.0.1:8000/jobs/1 -H "Authorization: Bearer $TOKEN"
```

## 批处理脚本（项目根）

```bash
set PYTHONPATH=backend
python scripts/batch_extract_trajectories.py --root D:\path\to\mp4\folder
```

## 配置示例（缩略）

见 `config/pipeline_alerts.yaml`。核心字段：`early_warning.dwell_warning_sec`、`dwell_alert_sec`、`reversal_alert_k`、`early_warning.simple_intrusion_mode`、`debounce.cooldown_sec`、`debounce.consecutive_frames_for_escalation`。

## 一条测试命令（需本地存在 mp4）

```bash
# 项目根、已激活 venv、已 pip install 根目录+backend 依赖
set PYTHONPATH=backend
python scripts/batch_extract_trajectories.py --root D:\your\RepCount\video\train
```

## 阶段2 自检（维护）

| 项 | 说明 |
|----|------|
| TrajectoryPoint > 0 | 对至少 1 个含行人的 mp4 跑通批处理或 `run_local_path` |
| TrajectorySummary / Alert | 摘要非空；宽松阈值下可产生告警 |
| 提前预警 vs 单纯入侵 | `simple_intrusion_mode: false` 为默认；`true` 时首入 ROI 即 `intrusion_simple` |
| 去抖 | 同 `track_id` 在冷却内不重复入库 |
| 数据集表述 | README 与 `docs/acceptance_p0.md` 无「园区行走数据集」编造 |
