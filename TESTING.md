# P0 手动验证清单（命令版）

一、使用说明

这份文档按 P0 验收主线 1～6 编排，照着跑一遍就能完成一轮最小可验证闭环。默认你已经通过源码方式或 `docker compose up` 把系统拉起来了：

- 后端：`http://127.0.0.1:8000`
- 前端：`http://127.0.0.1:3000`

数据口径提醒（很重要）：

- `RepCount` / `LLSP` 属于健身或重复动作先验数据，只用于流水线验证
- 不要在文档或答辩里写成“园区行人行走数据集”
- 园区场景请使用自采视频，或使用 ShanghaiTech Campus 并明确标注引用

---

二、启动环境（阶段5）

1) Docker（推荐新机器）

```bash
cd /path/to/智慧园区安防AI管理与仿真平台
docker compose up --build
```

快速确认：

- `curl -s http://127.0.0.1:8000/health`
- 浏览器打开 `http://127.0.0.1:3000`

视频路径说明（Docker）：

- 把 mp4 放在宿主机 `data/videos/`
- API 请求里使用容器路径：`/app/data/videos/your.mp4`

2) 源码方式（对照）

```bash
# 终端1
cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 终端2
cd frontend && pnpm install && pnpm dev
```

---

三、P0 验收步骤

### 1) 轨迹：能抽 track，能落库，能查询

前提是你有可检出人物的 mp4（RepCount 片段、自采视频都可以，但要如实标注来源）。

先登录取 token：

```bash
curl -s -X POST http://127.0.0.1:8000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```

拿到 `access_token` 后再提交任务：

```bash
curl -s -X POST http://127.0.0.1:8000/jobs/run_local_path \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"path\":\"/app/data/videos/demo.mp4\"}"
```

源码模式下把 `path` 换成本机绝对路径（例如 `D:/datasets/xxx.mp4`）。

轮询任务：

```bash
curl -s "http://127.0.0.1:8000/jobs/1" -H "Authorization: Bearer $TOKEN"
```

验收看点：

- `trajectory_points_count > 0`（检出到人时）
- `alerts_count` 根据阈值可能为 0 或更高

说明：P0 这里是“落库或 CSV”，当前以落库为准，CSV 导出不是必做。

### 2) 行为：有可解释特征，有提前预警规则

- 任务完成后检查摘要（任务详情或库表）
- `TrajectorySummary.features_json` 应包含位移、速度、折返、ROI 停留等信息
- 规则来源：`config/pipeline_alerts.yaml`
- 规则实现：`services/alert_engine.py`

### 3) 告警：分级、去抖、结构化留痕

```bash
curl -s "http://127.0.0.1:8000/alerts?limit=20" -H "Authorization: Bearer $TOKEN"
```

验收看点：

- 告警字段完整（`level`、`alert_type`、`triggered_at`、`track_id`、`keyframe_path`、`job_id`）
- 能看到分级（如 `warning` / `alert`）
- 去抖参数在日志中可见（`debounce M=`）

关键帧可通过 `http://127.0.0.1:8000/media/frames/...` 访问。

### 4) 闭环：反馈后能看到阈值变化

提交误报反馈：

```bash
curl -s -X POST "http://127.0.0.1:8000/alerts/1/feedback" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"label\":\"false_positive\",\"note\":\"TESTING\"}"
```

查看设置：

```bash
curl -s http://127.0.0.1:8000/settings -H "Authorization: Bearer $TOKEN"
```

验收看点：

- `feedback_rollup` 统计正常
- 多条误报后可触发 M 异步收紧（见 `docs/demo_script.md`）
- `PATCH /settings` 与 `reset_to_yaml_defaults` 仅 admin 可用

前端路径：登录 -> 告警中心反馈 -> 系统设置查看生效 M。

### 5) 工程：后端、前端、图表、README 都可复现

```bash
curl -s http://127.0.0.1:8000/dashboard/summary -H "Authorization: Bearer $TOKEN"
```

验收看点：

- 返回结构包含 `alerts_by_day_7d` 等字段
- 页面 `/dashboard`、`/analytics` 可正常展示图表
- 根目录 `README.md` 提供本地和 Docker 启动方式

### 6) 数据说明：表述必须诚实

检查 `README.md`、`backend/README.md`、`docs/acceptance_p0.md`：

- 不得把 RepCount/LLSP 写成园区行走数据集
- 界面文案不应出现误导描述

---

四、可选：Shanghai 子集演示

如果你已经按 `docs/dataset_shanghai.md` 把帧序列转成 `data/videos/demo_shanghai.mp4`，第 1 步可以直接复用。

路径示例：

- 本机：`C:/.../smartpark-security-platform/data/videos/demo_shanghai.mp4`
- Docker：`/app/data/videos/demo_shanghai.mp4`

这类数据答辩时请单独标注正式名称和引用，别和 RepCount 或“园区实拍”混称。

---

五、阶段5自检

| 项目 | 如何检查 |
|------|------|
| 新机器可跑通 | 只装 Docker，克隆后执行 `docker compose up --build`，然后跑本文关键命令 |
| TESTING 覆盖 P0 | 本文三章第 1～6 节与 P0 主线一一对应 |

---

六、常见问题

- Docker 内找不到视频：确认文件在 `./data/videos/`，请求体用 `/app/data/videos/文件名.mp4`
- 第一次 YOLO 很慢：首次会下载权重，后续由 `ultralytics-cache` 复用
- 跨域报错：后端已放行常见本地端口；如果改了前端端口，需要同步更新 `backend/app/main.py` 的 `allow_origins`

---

七、模型版本 / 重训 / Holdout / RTSP（扩展验收）

前置：`TOKEN` 为 admin 的 Bearer。

1) **统一策略**：`GET /settings` 应含 `unified_ml`（ML 阈值与规则同库）；`PATCH /settings` 可改 `retrain_on_feedback`、`retrain_interval_hours` 等。

2) **手动训练**：`POST /admin/training/enqueue`，然后 `GET /admin/training/runs` 观察 `status` 变为 `completed` 且 `version_id` 非空；`models/versions/<version_id>/` 下应有 `manifest.json`。

3) **回滚**：`POST /admin/models/activate`，body `{"version_id":"v..."}`，再跑一条视频任务，告警详情中 ML 分数应与回滚前版本一致（需重启进程则见 README）。

4) **Holdout 评测**：`POST /admin/evaluation/run`，响应写入 `evaluation_reports`；前端「数据分析」页「Holdout 评测」卡片应出现 FPR；`GET /dashboard/metrics` 返回 `latest_evaluation`。

5) **误报触发重训**：在 `PATCH /settings` 打开 `retrain_on_feedback: true` 后，对某告警提交 `false_positive` 反馈；`retrain_feedback_delay_sec` 秒后 `GET /admin/training/runs` 应出现 `trigger=feedback` 的新记录。

6) **定时重训**：`retrain_interval_hours` 设为 `1`（测试后改回 `0`），等待约 1 小时或临时改代码缩短轮询（生产勿改）；日志中应出现 `trigger=schedule`。

7) **RTSP**：在 `cameras` 表为某摄像头配置 `rtsp_url` 后，`POST /admin/streams/{camera_id}/start`；设置环境变量 `STREAM_DEMO_MAX_FRAMES=500` 可缩短演示；`GET /admin/streams/active` 查看活跃路数；`POST .../stop` 停止。

8) **流式去重单测**（项目根）：`py -3 tests/test_stream_dedupe.py -v`

9) **轨迹可视化**：登录前端「告警中心」，展开任意带 `job_id` 的告警，应看到叙事文案 + 2D 折线图；纯 RTSP 告警可能无轨迹点，仅叙事说明。
