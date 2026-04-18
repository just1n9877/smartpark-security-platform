# P0 手动验证清单（命令级）

以下按验收主线 **P0 1～6** 组织。默认：**本地源码** 或 **`docker compose up`** 已启动后端 `http://127.0.0.1:8000`、前端 `http://127.0.0.1:3000`（Docker 见根目录 `README.md`）。

**数据域提醒（贯穿全文）**：RepCount/LLSP 等为**健身/重复动作类先验数据**，仅用于流水线与算法验证；**不得**在汇报或界面中写成「本数据集为园区行人行走」。园区场景使用自采视频、ShanghaiTech Campus 等**并单独标注来源**。

---

## 0. 环境与一键启动（工程 / 阶段5）

### 0.1 Docker（推荐新机器）

```bash
cd /path/to/智慧园区安防AI管理与仿真平台
docker compose up --build
```

- 健康检查：`curl -s http://127.0.0.1:8000/health`
- 浏览器打开：`http://127.0.0.1:3000`
- **流水线视频路径（容器内）**：将 mp4 放在宿主机 `data/videos/`，compose 挂载为只读 `/app/data/`，API 使用例如 `"/app/data/videos/your.mp4"`（见 §1）。

### 0.2 源码（对照）

```bash
# 终端1：项目根已安装根目录 requirements + backend requirements
cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 终端2
cd frontend && npm install && npm run dev
```

---

## 1) 轨迹：track 序列，落库，可查询

**前提**：有一段可检出人物的 mp4（RepCount 片段或自采；勿误标数据域）。

1. 登录获取令牌：

```bash
curl -s -X POST http://127.0.0.1:8000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```

记下 `access_token`（下文 `$TOKEN`）。

2. 提交分析任务（Docker 示例路径）：

```bash
curl -s -X POST http://127.0.0.1:8000/jobs/run_local_path \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"path\":\"/app/data/videos/demo.mp4\"}"
```

源码环境下将 `path` 换成本机绝对路径，例如 `D:/datasets/xxx.mp4`。

3. 轮询任务直到 `completed`：

```bash
curl -s "http://127.0.0.1:8000/jobs/1" -H "Authorization: Bearer $TOKEN"
```

4. **验收**：响应中 `trajectory_points_count > 0`（有检出时）；`alerts_count` 视规则可能 ≥0。

**说明**：P0「或 CSV」以入库为准；导出 CSV 非必选，未做不阻却本条。

---

## 2) 行为：可解释特征 + 提前预警条件

1. 同上任务完成后，查摘要（若 API 未单独暴露，可通过 DB 或扩展接口；当前以任务详情 + 库表为准）。
2. **验收（实现层面）**：`TrajectorySummary.features_json` 含多类特征（位移、速度、折返、ROI 停留等，见 `services/trajectory_analytics.py`）；预警条件见 `config/pipeline_alerts.yaml` 与 `docs/pipeline_alerts.md`，引擎 `services/alert_engine.py`。

---

## 3) 告警：分级 + 去抖 + 结构化留痕

```bash
curl -s "http://127.0.0.1:8000/alerts?limit=20" -H "Authorization: Bearer $TOKEN"
```

**验收**：每条含 `level`、`alert_type`、`triggered_at`、`track_id`、`keyframe_path`、`job_id` 等；存在 `warning` / `alert` 等分级；后端日志/配置体现冷却与连续确认帧数 M（`pipeline_runner` 打印 `debounce M=`）。

关键帧 URL（浏览器或 curl）：`http://127.0.0.1:8000/media/frames/...`（相对 `storage/frames`）。

---

## 4) 闭环：反馈 + 可演示阈值变化

1. 对某条告警提交反馈：

```bash
curl -s -X POST "http://127.0.0.1:8000/alerts/1/feedback" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"label\":\"false_positive\",\"note\":\"TESTING\"}"
```

2. 查看策略与滚动误报（需登录；admin 可 PATCH）：

```bash
curl -s http://127.0.0.1:8000/settings -H "Authorization: Bearer $TOKEN"
```

3. **验收**：`GET /settings` 中 `feedback_rollup` 统计合理；多条误报后异步收紧 **M**（见 `docs/demo_script.md`）；`PATCH /settings` + `reset_to_yaml_defaults` 仅 admin 成功。

前端：登录 → **告警中心** 提交反馈 → **系统设置 → 预警策略** 查看生效 M。

---

## 5) 工程：API + DB + 管理端 + 大屏（≥4 图）+ README

```bash
curl -s http://127.0.0.1:8000/dashboard/summary -H "Authorization: Bearer $TOKEN"
```

**验收**：`alerts_by_day_7d` 等字段非空结构；浏览器打开 `/dashboard`、`/analytics`，可见多图（Recharts）。根 `README.md` 含本地与 Docker 启动说明。

---

## 6) 数据集说明诚实

**验收**：阅读根 `README.md`、`backend/README.md`、`docs/acceptance_p0.md` §6；全文**不得**将 RepCount/LLSP 表述为园区行人行走数据集；界面占位文案无上述误导。

---

## 阶段5 自检

| 项 | 操作 |
|----|------|
| 新机器跑通 | 仅安装 Docker，克隆仓库，`docker compose up --build`，执行 §0.1 与 §1～§5 中关键 curl |
| TESTING 覆盖 P0 | 本文 §1～§6 与验收主线一一对应 |

---

## 常见问题

- **Docker 内跑任务报找不到视频**：确认文件在 `./data/videos/` 且请求体为 **`/app/data/videos/文件名.mp4`**。
- **首次 YOLO 很慢**：容器内会下载权重，已挂载 `ultralytics-cache` 卷以复用缓存。
- **CORS**：后端已放行 `localhost`/`127.0.0.1` 常见端口；若改前端端口，需在 `backend/app/main.py` 增加 `allow_origins`。
