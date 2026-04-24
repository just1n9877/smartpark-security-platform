# P0 验收主线与阶段进度

一、文档目的

这份文档把 P0 的 6 条验收要求和当前实现一一对齐，答辩时可以直接说明“做到了什么、做到哪一步、证据在哪”。

当前项目口径：

- 后端：FastAPI + SQLAlchemy + SQLite
- 前端：Next.js 16 + React（不是 Vue3 + Element Plus）
- 交付：支持源码启动，也支持 `docker compose` 一键启动（阶段5）

---

二、阶段总览（1～5）

### 阶段1（历史快照）

| 验收项 | 结论 |
|------|------|
| 轨迹抽取与查询 | 未闭环（当时只有表结构） |
| 行为特征与预警条件 | 未完成 |
| 告警分级与结构化字段 | 部分完成（去抖未做） |
| 反馈闭环与阈值变化 | 部分完成（仅 API + 表） |
| 工程完整性 | 部分完成（后端+DB+README） |
| 数据口径诚实 | 已完成 |

### 阶段2（流水线落地）

| 验收项 | 结论 |
|------|------|
| 轨迹抽取与查询 | 部分完成（轨迹点入库 + 批处理） |
| 行为特征与提前预警 | 部分完成（特征 + 规则已接入） |
| 告警分级与去抖 | 部分完成（冷却 + 连续确认帧） |
| 反馈后策略变化 | 当时暂未闭环 |
| 工程完整性 | 部分完成（前端图表待阶段3） |
| 数据口径诚实 | 已完成 |

### 阶段3（前端联调）

| 验收项 | 结论 |
|------|------|
| 登录联调 | 已完成（`POST /auth/login`） |
| 告警与反馈 | 已完成（列表/详情/提交反馈） |
| 仪表盘与分析页 | 已完成（真实接口） |
| CORS 与环境变量 | 已完成 |
| 文案口径 | 已完成（未误标数据） |

### 阶段4（反馈闭环）

| 验收项 | 结论 |
|------|------|
| 滚动误报统计 | 已完成（`GET /settings`） |
| 高误报自动收紧 M | 已完成（`SystemConfig` 自动调参） |
| 设置 API | 已完成（`GET/PATCH /settings`） |
| 反馈后异步重算 | 已完成 |
| 演示文档 | 已完成（`docs/demo_script.md`） |
| 数据口径诚实 | 已完成 |

### 阶段5（容器化交付）

| 验收项 | 结论 |
|------|------|
| 后端/前端 Dockerfile | 已完成 |
| compose 多服务与挂载 | 已完成 |
| 一键启动与 README | 已完成 |
| 命令级测试文档 | 已完成（`TESTING.md`） |
| 数据口径一致性 | 已完成 |

---

三、按 P0 主线逐条对照

## 1) 轨迹：抽 track、落库/CSV、可查询

- 阶段1：表结构就绪，但流程未打通
- 阶段2：通过 `services/tracking_pipeline.py`、`services/pipeline_runner.py`、`scripts/batch_extract_trajectories.py` 打通轨迹入库
- 当前结论：以“落库”完成验收，CSV 导出仍是可选增强

## 2) 行为：至少两类可解释特征 + 提前预警

- 已支持位移、速度、折返、ROI 停留等特征（`TrajectorySummary.features_json`）
- 提前预警规则配置在 `config/pipeline_alerts.yaml`
- 规则分支实现在 `services/alert_engine.py`

## 3) 告警：分级 + 去抖 + 结构化留痕

- 告警结构化字段齐全（级别、类型、时间、摄像头、track、关键帧、job）
- 去抖策略已接入：`cooldown_sec` + `consecutive_frames_for_escalation`
- 关键帧落在 `storage/frames/`，并可通过 `/media/frames/...` 访问

## 4) 闭环：反馈写库 + 反馈后策略变化

- `POST /alerts/{id}/feedback` 已接入并写入 `Feedback`
- 前端 `/alerts` 页面支持提交反馈
- 阶段4 已完成“误报高 -> 自动 M+1”的可演示闭环
- `GET/PATCH /settings` 支持查看/调整/恢复默认参数

## 5) 工程：后端 + DB + 前端 + 图表 + README

- 后端、数据库、接口和文档已可复现
- 前端 `dashboard` 和 `analytics` 已接真实数据并展示图表
- 阶段5 补齐 Docker Compose 一键启动，支持新机器复现

## 6) 数据集说明诚实

- 文档一致声明：RepCount/LLSP 仅用于先验验证，不是园区行走数据
- 园区演示应使用自采视频，或在公开数据场景里明确引用来源
- 验收口径与 README、TESTING 文档保持一致

---

四、自检结论（维护版）

| 项目 | 阶段1 | 阶段2 | 阶段3 | 阶段4 | 阶段5 |
|------|------|------|------|------|------|
| 未虚构园区数据集 | 是 | 是 | 是 | 是 | 是 |
| 去抖/调参可演示 | 否 | 部分 | 部分 | 是 | 是 |
| 新机器可一键复现 | 否 | 否 | 否 | 否 | 是 |
| TESTING 覆盖 P0 | 否 | 否 | 否 | 否 | 是 |

---

五、关键文件索引（审计）

### 阶段2关键路径

- `services/tracking_pipeline.py`
- `services/trajectory_analytics.py`
- `services/alert_engine.py`
- `services/pipeline_runner.py`
- `config/pipeline_alerts.yaml`
- `scripts/batch_extract_trajectories.py`
- `backend/app/routers/jobs_routes.py`
- `backend/app/models.py`

### 阶段3关键路径

- `frontend/src/lib/api.ts`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/alerts/page.tsx`
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/app/analytics/page.tsx`

### 阶段4关键路径

- `backend/app/system_config_service.py`
- `backend/app/routers/settings_routes.py`
- `backend/app/routers/alerts_routes.py`
- `docs/demo_script.md`

### 阶段5关键路径

- `docker-compose.yml`
- `docker/Dockerfile.backend`
- `docker/Dockerfile.frontend`
- `TESTING.md`

---

六、偏差与说明（诚实口径）

1. 数据口径：未出现“把 RepCount/LLSP 写成园区数据”的表述。  
2. P0“落库或 CSV”：当前以落库完成主线，CSV 导出为可选增强。  
3. 技术栈差异：前端采用 Next.js，文档已显式说明。  
4. 闭环状态：反馈 API + 设置 API + 自动调参 + 演示脚本已经构成完整闭环。  
5. 范围边界：无目标检出时轨迹与告警为空属正常，不视为功能失败。  
6. 配置生效规则：批处理可固定 YAML；API 任务默认合并 DB 生效参数。  
7. 阶段5结论：主线已满足验收，其他增强项不影响当前 P0 结论。  
