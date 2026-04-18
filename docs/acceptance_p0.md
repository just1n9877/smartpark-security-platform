# P0 验收主线（阶段进度）

本文档逐条对应项目 P0 要求，并标注**阶段1 / 阶段2 / 阶段3**完成情况。

**前端为 Next.js 16 + React**（目录 `frontend/`，`npm run dev` 默认 <http://127.0.0.1:3000>）。

下表**阶段1 / 阶段2**行为「各该阶段结束时的快照」，便于对照原始计划；**当前实现**已覆盖至阶段3（Next 联调）。

---

**阶段1 勾选总览**（阶段1结束时）

| # | 验收项 | 阶段1 |
|---|--------|--------|
| 1 | 轨迹抽 track、落库/CSV、可查询 | ☐ 未完成（仅表结构） |
| 2 | 行为特征（≥2 类）+ 提前预警条件 | ☐ 未完成 |
| 3 | 告警：分级 + 去抖 + 结构化留痕 | ☑ 部分完成（留痕字段有；去抖未做） |
| 4 | 反馈闭环 + 反馈后策略/阈值变化 | ☑ 部分完成（API+表；策略变化未做） |
| 5 | 后端 + DB + 前端 + 大屏（≥4 图）+ README | ☑ 部分完成（后端+DB+README） |
| 6 | 数据集表述诚实（RepCount/LLSP 非园区行走） | ☑ 已完成（见下文 §6） |

**阶段2 勾选总览（AI 流水线与服务对接）**

| # | 验收项 | 阶段2 |
|---|--------|--------|
| 1 | 轨迹抽 track、落库/CSV、可查询 | ☑ 部分完成（`TrajectoryPoint` 写入 + 批处理脚本；CSV 未强制） |
| 2 | 行为特征（≥2 类）+ 提前预警条件 | ☑ 部分完成（摘要含位移/速度/折返/ROI 停留；提前预警见 `config/` + `alert_engine`） |
| 3 | 告警：分级 + 去抖 + 结构化留痕 | ☑ 部分完成（warning/alert + 冷却 + 连续帧确认 + 关键帧路径） |
| 4 | 反馈闭环 + 反馈后策略/阈值变化 | ☑ 阶段1 同左；策略变化仍待后续 |
| 5 | 后端 + DB + 前端 + 大屏 + README | ☑ 部分完成（后端 API + 流水线 README；**Next 前端与图表见阶段3**） |
| 6 | 数据集表述诚实 | ☑ 已完成（README「数据」节 + 本文 §6） |

**阶段3 勾选总览（Next.js 前端 + 联调）**

| # | 验收项 | 阶段3（当前） |
|---|--------|----------------|
| 1 | 登录联调 | ☑ `POST /auth/login`，令牌存 `localStorage`（`src/lib/api.ts`） |
| 2 | 告警列表 / 详情 / 关键帧 | ☑ `/alerts`：`GET /alerts`、关键帧 URL、`POST /alerts/{id}/feedback` |
| 3 | 仪表盘与数据分析 | ☑ `/dashboard`、`/analytics`：`GET /dashboard/summary`、`GET /cameras` 等 |
| 4 | CORS / 环境变量 | ☑ 后端 `main.py` 放行 `3000`/`5000` 等；`NEXT_PUBLIC_API_BASE_URL` |
| 5 | 文案与数据诚实 | ☑ 未将 RepCount 标为园区数据集；无依据指标已弱化或标注占位 |

---

## 1) 轨迹：从视频抽出 track 序列，落库或 CSV，可查询

- [ ] **阶段1 本条未闭环**：抽帧、跟踪、写入轨迹尚未接入。
- [x] **阶段1 已具备**：表 `TrajectoryPoint` / `TrajectorySummary` / `AnalysisJob` 已就绪；后续接入 `video_tracker.py` 流水线。
- [x] **阶段2**：`services/tracking_pipeline.py` + `services/pipeline_runner.py` + `scripts/batch_extract_trajectories.py`；轨迹点批量入库。

## 2) 行为：基于轨迹计算至少 2 类可解释特征（ROI 停留、折返/徘徊、速度异常等），并定义「提前预警」触发条件

- [ ] **阶段1 未完成**：特征计算与预警规则未实现。
- [x] **阶段1 已具备**：`TrajectorySummary.features_json` 可存摘要；规则引擎待后续。
- [x] **阶段2**：`TrajectorySummary` 写入 `total_displacement_px`、`avg_speed_px_per_s`、`reversal_count`、`roi_dwell_frames`；提前预警规则见 `config/pipeline_alerts.yaml` 与 `docs/pipeline_alerts.md`（与「单纯入侵」分支见 `services/alert_engine.py`）。

## 3) 告警：分级 + 去抖（冷却/连续确认）+ 结构化留痕（时间、摄像头、track_id、类型、关键帧路径）

- [x] **结构化留痕**：`Alert` 含级别、类型、时间、摄像头、track、关键帧路径、是否已确认。
- [ ] **阶段1 去抖/冷却/连续确认**：未实现。
- [x] **阶段2**：冷却 `cooldown_sec`；连续 `consecutive_frames_for_escalation`；关键帧 `storage/frames/`；`alerts.job_id` 关联任务。

## 4) 闭环：前端可对告警提交反馈（误报/类型等），写入数据库；至少一种可演示的「反馈后策略/阈值变化」

- [x] **反馈写入**：`POST /alerts/{id}/feedback` + `Feedback` 表（标签枚举 + 备注）。
- [x] **Next 前端（阶段3）**：`frontend/` 中 `/alerts` 展开项内可提交反馈，与后端枚举一致。
- [ ] **反馈后策略/阈值变化**（阶段4）：仍待后续（如 `SystemConfig` + `/settings`）。

## 5) 工程：后端 API + 数据库 + 前端管理端 + 简单数据大屏（≥4 图表）+ README 可复现

- [x] **后端 API + SQLite + README**：见 `backend/README.md`。
- [x] **Next 管理端与图表（阶段3）**：`frontend/src/app/dashboard/page.tsx`、`analytics/page.tsx` 等对接真实 API；根 `README.md` 已写 Next 启动方式。
- [x] **阶段2 API**：`GET /jobs/{id}`、`POST /jobs/run_local_path`（异步流水线）。

## 6) 数据集说明诚实

- [x] **表述与验收一致**：先验数据为 **RepCount/LLSP（健身重复动作）**，**仅用于轨迹流水线与算法验证**；**不是**「园区行人行走」数据集。园区场景依赖**自采视频或后续补充**；文档中**禁止**将 RepCount/LLSP 写成园区行走数据。
- [x] **补充**：**RepCount**（及同类先验数据）**仅用于后续轨迹流水线与算法实验**，不代表园区行人场景；园区演示需自采或另行标注的数据源。
- [x] **阶段2**：`backend/README.md`「数据」节再次说明：RepCount 用于批量验证轨迹管道，与园区业务**跨域**。

---

## 自检清单（维护用）

| 条目 | 阶段1 | 阶段2 | 阶段3（Next） |
|------|--------|--------|----------------|
| 未虚构「园区行走数据集」 | ☑ | ☑ | ☑ |
| `video_tracker.py` 保留不破坏 | ☑（未删改逻辑，仅改为 import 共用模块） | ☑ | ☑ |

---

## 阶段2 改动文件索引（供审计）

| 路径 | 说明 |
|------|------|
| `services/__init__.py` | 包初始化 |
| `services/tracking_pipeline.py` | YOLO + DeepSORT 单帧更新（共用） |
| `services/trajectory_analytics.py` | 轨迹摘要特征 |
| `services/pipeline_config.py` | YAML 配置加载 |
| `services/alert_engine.py` | 提前预警 + 去抖 |
| `services/pipeline_runner.py` | 入库流水线 |
| `config/pipeline_alerts.yaml` | ROI/阈值/去抖参数 |
| `docs/pipeline_alerts.md` | 预警与入侵对照说明 |
| `scripts/batch_extract_trajectories.py` | 递归 mp4 批处理 |
| `storage/frames/.gitkeep` | 关键帧目录占位 |
| `backend/app/database.py` | `ensure_sqlite_migrations` |
| `backend/app/models.py` | `Alert.job_id` 等 |
| `backend/app/schemas.py` | `JobDetail`、`RunLocalPathBody`、`AlertOut.job_id` |
| `backend/app/routers/jobs_routes.py` | `GET /jobs/{id}`、`POST /jobs/run_local_path` |
| `backend/app/main.py` | 启动迁移调用；CORS 含 Next 端口 |
| `backend/requirements.txt` | `pyyaml` |
| `backend/README.md` | 数据节、API、批处理说明 |
| `video_tracker.py` | 改为 import `services.tracking_pipeline` |
| `video_surveillance_system.py` | 同上 |

**阶段3（Next）主要路径（补充）**

| 路径 | 说明 |
|------|------|
| `frontend/src/lib/api.ts` | `apiFetch`、`loginApi`、关键帧 URL、令牌 |
| `frontend/src/app/login/page.tsx` | 登录 |
| `frontend/src/app/alerts/page.tsx` | 告警与反馈 |
| `frontend/src/app/dashboard/page.tsx` | 仪表盘 |
| `frontend/src/app/analytics/page.tsx` | 数据分析 |
| `frontend/src/components/Sidebar.tsx` | 导航与退出清除令牌 |

---

## 与验收清单的偏差与修正计划（诚实说明）

1. **RepCount/LLSP 表述**：验收文档与 README「数据」节一致；**无「编造园区数据集」表述**。
2. **P0 仍待项**：**反馈驱动策略/阈值（阶段4）**、**轨迹 CSV 导出（非强制）**、Docker/TESTING 等可后续补齐。
3. **「闭环」验收**：反馈 API + **Next 前端提交**已具备；**「反馈后自动调参」**仍待阶段4。
4. **阶段2 范围边界**：流水线在无检出目标时不会产生 `TrajectoryPoint`/摘要/告警（属正常）；完整 P0 演示需使用**含可检测行人**的视频（如 RepCount 片段或自采园区视频），且园区场景数据须单独说明来源。
