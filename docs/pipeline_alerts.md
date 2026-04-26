# 告警阈值与去抖机制说明

## 一、文档目的

这份文档解释系统什么时候产生 `warning` 或 `alert`，以及为什么不会因为每一帧检测结果都重复刷告警。它适合开发联调、参数调试和答辩时解释告警逻辑。

相关实现主要在：

- `services/alert_engine.py`
- `services/pipeline_runner.py`
- `config/pipeline_alerts.yaml`
- `backend/app/system_config_service.py`

## 二、两种告警模式

### 1. 简单入侵模式

当 `simple_intrusion_mode: true` 时，只要目标框与 ROI 有交集，就可以触发 `intrusion_simple`。这个模式适合做基础连通性验证，优点是容易触发，缺点是对短时误检更敏感。

即便在简单模式下，系统也会受到冷却时间约束，不会每一帧都重复写入告警。

### 2. 提前预警模式

当 `simple_intrusion_mode: false` 时，系统不会在目标刚进入 ROI 时立刻升级高等级告警，而是观察目标在区域内的持续行为。

典型规则：

- `warning`：ROI 累计停留时间达到 `dwell_warning_sec`
- `alert`：停留时间达到 `dwell_alert_sec`
- `alert`：折返次数达到 `reversal_alert_k`

这种方式更接近安防场景里的“持续异常”判断，也更适合演示提前预警。

## 三、去抖策略

系统使用两层去抖：

1. 冷却时间：同一 `track_id` 在 `cooldown_sec` 内不重复生成同类告警。
2. 连续确认：满足告警条件后，还需要连续满足 `consecutive_frames_for_escalation` 帧，才会真正落库并标记为确认告警。

这样做的目的是减少短时检测抖动、目标框轻微漂移、视频噪声带来的重复告警。

## 四、参数来源

基线参数来自：

```text
config/pipeline_alerts.yaml
```

通过 API 启动视频任务时，系统会把 YAML 基线与数据库中的 `system_configs` 合并，最终使用数据库里的生效参数。前端“系统设置”页面看到的就是这部分生效配置。

任务启动时，后端日志会打印当前参数，例如：

```text
debounce M=4
```

这里的 M 对应连续确认帧数。

## 五、反馈如何影响阈值

用户提交告警反馈后，后端会统计最近一段窗口内的误报比例。如果误报比例高于阈值，系统会自动提高确认帧数 M，让后续告警更谨慎。

这条闭环主要用于演示“系统能根据反馈调整策略”。它不是完整的在线学习模型，但能在规则层面体现反馈对后续行为的影响。

## 六、调参建议

- 想更容易触发告警：降低 `dwell_warning_sec`、`dwell_alert_sec` 或 `consecutive_frames_for_escalation`。
- 想减少误报：提高 `consecutive_frames_for_escalation` 或延长 `cooldown_sec`。
- 想观察折返告警：降低 `reversal_alert_k`，并选择有明显来回运动的视频。
- 演示结束后建议恢复 YAML 默认值，避免后续测试结果不一致。

## 七、验收口径

可以说：

> 系统通过停留时长、折返次数、冷却时间和连续确认帧数共同判断告警，避免单帧检测结果直接刷屏。

不要说：

> 系统已经完全解决误报问题。

当前实现是规则和阈值层面的工程去抖，仍需要结合视频质量、摄像头点位和现场规则继续调优。
