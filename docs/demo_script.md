# 阶段4 演示脚本：反馈驱动阈值（同一段视频前后对比）

以下演示 **RepCount/LLSP 等先验视频仅用于轨迹与算法验证**，不表述为园区行人数据；若用自采园区视频，在汇报中单列数据来源即可。

## 前置条件

- 后端：`cd backend` 后 `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`（项目根需在 `PYTHONPATH` 中，或从项目根按 README 启动）。
- 前端：`cd frontend`，配置 `.env.local` 中 `NEXT_PUBLIC_API_BASE_URL`，`npm run dev`。
- 管理员账号：`admin` / `admin123`（用于 `PATCH /settings` 与查看「系统设置 → 预警策略」中的重置按钮）。

## A. 观察「确认帧数 M」与告警条数（推荐）

1. **重置为 YAML 基准**  
   - 浏览器登录 admin → **系统设置** → **预警策略** → 点击 **恢复 YAML 默认**（或 `PATCH /settings`，body `{"reset_to_yaml_defaults": true}`）。  
   - 记录界面上的 **确认帧数 M**（应与 `config/pipeline_alerts.yaml` 中 `debounce.consecutive_frames_for_escalation` 一致，默认一般为 **4**）。

2. **第一次跑同一支测试视频**  
   - 使用 `POST /jobs/run_local_path`（或前端若已对接任务入口）提交**固定路径**的 mp4，例如项目内短视频。  
   - 任务完成后记录 **`GET /jobs/{id}`** 中的 `alerts_count`，或在 **告警中心** 数该 `job_id` 的告警条数。  
   - 终端中流水线日志应出现一行：  
     `[pipeline job=…] debounce M=4 dwell_warn=…`（M 与当前 DB 一致）。

3. **制造高误报反馈（触发自动收紧）**  
   - 对**多条不同告警**（至少 3 条）提交反馈，标签均选 **误报**（`false_positive`）。  
   - 条数建议 ≥ `feedback_window_n`（默认 20）的 **30%** 且总条数 ≥ **3**，或直接把窗口内最近几条全部标误报，使 **滚动误报率 ≥ `high_fp_threshold`**（默认 **0.4**）。  
   - 提交后后端会**异步**执行自动调参：若满足条件，**M 增加 1**（不超过 `max_consecutive_frames`，默认 12）。可在 **预警策略** 页刷新查看 **effective.consecutive_frames_for_escalation**，或看 uvicorn 控制台：  
     `[system_config] auto-tune: rolling_fp_rate=… => consecutive_frames 4 -> 5`

4. **第二次跑同一支视频（同一路径、同配置 YAML，仅 DB 中 M 变大）**  
   - 再次 `POST /jobs/run_local_path` 使用**完全相同**的视频路径。  
   - **期望现象**：多数场景下 **告警条数减少**或 **warning/alert 触发更晚**（需连续满足条件的帧数变多）；日志中 `debounce M=` 已为 **5**（或更高）。  
   - 若视频很短、目标在 ROI 内停留极短，差异可能不明显——换略长片段或略缩小 ROI（改 YAML 后配合「恢复默认」对比）。

## B. 仅演示「级别 / 条数」肉眼对比（不测自动调参）

1. 重置为 YAML 默认（M 较小）。跑视频 A，截图告警列表数量与最高级别（warning vs alert）。  
2. `PATCH /settings` 将 `consecutive_frames_for_escalation` 改为 **8**（或更大），**不要**改 YAML。  
3. 再跑**同一**视频 A。  
4. **期望**：告警更少或更多停留在 warning、alert 推迟出现；日志中 `debounce M=8`。

## C. 验收自检对应关系

| 自检项 | 如何看到 |
|--------|----------|
| 改配置后新告警行为变化 | 流水线日志 `debounce M=…`；同视频两次 `alerts_count` 对比 |
| P0 闭环 | `POST /alerts/{id}/feedback` + `SystemConfig` + `GET/PATCH /settings` |
| 数据域诚实 | 演示口述与 README/验收文档一致，不称 RepCount 为园区行走数据 |

## D. API 速查

- `GET /settings`：需登录；返回 `effective`、`yaml_baseline`、`tuning`、`feedback_rollup`（含全局与按摄像头窗口内误报率）。  
- `PATCH /settings`：仅 **admin**；`{"reset_to_yaml_defaults": true}` 或逐项修改 `consecutive_frames_for_escalation` 等。  
- `GET /auth/me`：当前用户与角色（前端用于是否显示重置按钮）。
