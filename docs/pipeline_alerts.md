# 提前预警与去抖（阶段2）

## 与「进线即报警」的区别

- **单纯入侵（对照）**：`config/pipeline_alerts.yaml` 中 `simple_intrusion_mode: true` 时，目标检测框与 ROI 一旦出现交集即产生 `intrusion_simple` 类告警（边沿触发一次，仍受冷却约束）。
- **提前预警（默认）**：`simple_intrusion_mode: false` 时，**不**因首次进入 ROI 即升级为高等级告警；需满足：
  - **warning**：在 ROI 内累计停留时间 ≥ `dwell_warning_sec`（秒）；
  - **alert**：停留 ≥ `dwell_alert_sec`，**或** 轨迹折返启发式计数 ≥ `reversal_alert_k`。

上述阈值与「仅入侵」路径在 `services/alert_engine.py` 中分支实现。

## 去抖

- **冷却**：同一 `track_id` 在 `cooldown_sec` 内不重复新建 `Alert` 记录（避免同 ID 刷屏）。
- **连续确认**：满足某级别条件时，需连续 `consecutive_frames_for_escalation` 帧仍满足，才写入该级别告警，并将 `is_confirmed` 置为 true。

## 可调参数

见项目根目录 `config/pipeline_alerts.yaml`。
