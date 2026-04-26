# P0 验收说明

## 一、文档目的

这份文档用于说明项目的 P0 主线完成情况。它关注的是“系统是否形成了可演示、可复现、可解释的安防闭环”，而不是罗列所有代码细节。

当前项目口径：

- 后端：FastAPI + SQLAlchemy + SQLite
- 前端：Next.js 16 + React
- 部署：支持源码启动，也支持 Docker Compose
- 数据：公开数据和自采数据必须明确区分

## 二、P0 主线概览

| 主线 | 当前结论 | 证据位置 |
|------|------|------|
| 轨迹抽取、落库和查询 | 已完成主流程 | `services/pipeline_runner.py`、`GET /jobs/{id}` |
| 行为特征和提前预警 | 已完成基础能力 | `TrajectorySummary.features_json`、`config/pipeline_alerts.yaml` |
| 告警分级、去抖和留痕 | 已完成 | `alerts` 表、关键帧、`/alerts` API |
| 反馈闭环和策略变化 | 已完成可演示闭环 | `/alerts/{id}/feedback`、`/settings` |
| 工程可复现 | 已完成 | `README.md`、`TESTING.md`、`docker-compose.yml` |
| 数据说明诚实 | 已完成 | README、测试文档、数据集说明 |

## 三、逐项说明

### 1. 轨迹主线

系统通过视频任务触发轨迹流水线，检测和跟踪结果会写入数据库。任务完成后，可以通过 `GET /jobs/{id}` 查看轨迹点数量、摘要数量和告警数量。

当前以“落库查询”作为验收方式。CSV 导出不是 P0 必做项，后续可以作为数据分析增强。

验收看点：

- 视频任务能从 `pending/running` 进入 `completed`
- 检出人物时 `trajectory_points_count > 0`
- 轨迹数据带有 `job_id`、`track_id` 和坐标信息

### 2. 行为特征与提前预警

轨迹摘要中保留位移、速度、折返、ROI 停留等可解释特征。告警不是单帧触发，而是结合停留时间、折返次数、方向和区域规则进行判断。

相关文件：

- `services/trajectory_analytics.py`
- `services/alert_engine.py`
- `config/pipeline_alerts.yaml`

### 3. 告警分级与去抖

告警记录包含级别、类型、时间、摄像头、轨迹、关键帧和任务信息。系统通过冷却时间和连续确认帧减少重复告警。

验收看点：

- 告警列表能通过 `GET /alerts` 查询
- 关键帧可通过 `/media/frames/...` 访问
- 日志能看到类似 `debounce M=...` 的去抖参数

### 4. 反馈闭环

用户可以对告警提交反馈。系统会统计最近反馈中的误报比例，当误报比例达到阈值时，自动提高确认帧数 M，从而让后续告警更谨慎。

相关接口：

- `POST /alerts/{id}/feedback`
- `GET /settings`
- `PATCH /settings`

这条主线的演示脚本见 `docs/demo_script.md`。

### 5. 工程可复现

项目提供源码启动和 Docker Compose 两种方式。前端页面、后端接口、数据库、视频任务、告警和反馈都可以在一台新机器上复现。

主要入口：

- `README.md`
- `TESTING.md`
- `docker-compose.yml`
- `docker/Dockerfile.backend`
- `docker/Dockerfile.frontend`

### 6. 数据口径

项目没有把 `RepCount`、`LLSP` 等健身或重复动作视频写成园区实拍数据。若使用 ShanghaiTech Campus 或类似公开数据，需要写清正式名称、来源和许可范围。

这条要求不仅是文档要求，也关系到答辩可信度。没有实现的能力不要写成已上线，非园区数据不要包装成园区数据。

## 四、阶段演进

| 阶段 | 主要变化 |
|------|------|
| 阶段1 | 完成后端基础表结构和部分接口，主流程尚未闭环 |
| 阶段2 | 接入轨迹流水线、行为特征、规则和去抖 |
| 阶段3 | 前端与后端联调，登录、告警、仪表盘和数据分析页接入真实 API |
| 阶段4 | 完成反馈统计和阈值自动收紧闭环 |
| 阶段5 | 补齐 Docker、测试文档和一键复现能力 |

## 五、当前边界

1. P0 以轨迹落库为主，CSV 导出为可选增强。
2. 无目标检出时，轨迹和告警为空是正常结果。
3. RTSP 浏览器直播放需要 HLS/WebRTC 网关，当前后端侧重点是拉流分析。
4. 高精度跨摄像头 Re-ID 需要额外模型和现场标定。
5. 公开数据只用于算法验证或演示，不代表真实园区场景。

## 六、审计索引

### 后端关键路径

- `backend/app/routers/jobs_routes.py`
- `backend/app/routers/alerts_routes.py`
- `backend/app/routers/settings_routes.py`
- `backend/app/system_config_service.py`
- `backend/app/models.py`

### 流水线关键路径

- `services/tracking_pipeline.py`
- `services/pipeline_runner.py`
- `services/trajectory_analytics.py`
- `services/alert_engine.py`
- `services/ml_scoring.py`

### 前端关键路径

- `frontend/src/lib/api.ts`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/app/monitor/page.tsx`
- `frontend/src/app/alerts/page.tsx`
- `frontend/src/app/analytics/page.tsx`
- `frontend/src/app/settings/page.tsx`
