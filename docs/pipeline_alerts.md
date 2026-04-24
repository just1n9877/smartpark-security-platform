# 提前预警与去抖说明（阶段2）

一、这份文档讲什么

这里主要解释两件事：

1. 系统什么时候判定为 `warning` 或 `alert`
2. 为什么不会每一帧都疯狂刷告警（去抖机制）

---

二、「进线即报警」和「提前预警」的区别

1) 单纯入侵模式（对照）

- 当 `simple_intrusion_mode: true` 时，目标框和 ROI 一有交集，就触发 `intrusion_simple`
- 这个模式是边沿触发一次，不会连续每帧都重复发，但仍受冷却约束

2) 提前预警模式（默认）

- 当 `simple_intrusion_mode: false` 时，首次进入 ROI 不会立刻升级高等级告警
- 需要满足以下条件才触发：
  - `warning`：ROI 累计停留时间 >= `dwell_warning_sec`
  - `alert`：停留时间 >= `dwell_alert_sec`，或折返计数 >= `reversal_alert_k`

相关分支逻辑在 `services/alert_engine.py`。

---

三、去抖机制

- 冷却机制：同一 `track_id` 在 `cooldown_sec` 时间内不重复落告警，避免刷屏
- 连续确认：满足条件后，还要连续满足 `consecutive_frames_for_escalation` 帧，才真正写入告警并标记 `is_confirmed=true`

---

四、参数在哪调

统一在项目根目录的 `config/pipeline_alerts.yaml` 调整。
