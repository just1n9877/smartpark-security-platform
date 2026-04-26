# 反馈闭环演示脚本

## 一、演示目标

这段演示用于说明系统不是“只会报一次警”，而是能根据用户反馈调整后续策略。建议在答辩或验收时，用同一段视频做前后对比。

要证明的链路是：

1. 系统先按当前阈值生成告警。
2. 用户把部分告警标记为误报。
3. 后端统计最近误报比例。
4. 当误报比例过高时，系统自动提高确认帧数 M。
5. 同一视频再次运行时，告警会更谨慎。

数据口径提醒：`RepCount`、`LLSP` 只能说是算法验证视频，不要说成园区实拍。

## 二、前置条件

- 后端已启动：`http://127.0.0.1:8000`
- 前端已启动：`http://127.0.0.1:3000`
- 使用管理员账号：`admin / admin123`
- 准备一段能稳定检出人物的 mp4

建议先打开后端日志窗口，便于观察 `debounce M=` 和自动调参日志。

## 三、推荐演示流程

### 第一步：恢复基线参数

在前端进入“系统设置”，点击恢复 YAML 默认值。也可以直接调用：

```bash
curl -s -X PATCH http://127.0.0.1:8000/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reset_to_yaml_defaults": true}'
```

记录当前确认帧数 M，默认通常为 4。

### 第二步：第一次运行视频

提交固定视频路径：

```bash
curl -s -X POST http://127.0.0.1:8000/jobs/run_local_path \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path":"C:/path/to/demo.mp4"}'
```

任务完成后记录：

- `GET /jobs/{id}` 中的 `alerts_count`
- 告警中心中的告警等级和原因
- 后端日志中的 `debounce M=...`

### 第三步：提交误报反馈

对同一批告警提交 `false_positive`。建议至少提交 3 条，便于触发滚动窗口统计。

```bash
curl -s -X POST http://127.0.0.1:8000/alerts/1/feedback \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"false_positive","note":"demo"}'
```

如果误报率达到阈值，后端日志会出现类似：

```text
[system_config] auto-tune: ... consecutive_frames 4 -> 5
```

### 第四步：再次运行同一视频

继续使用完全相同的视频路径再跑一次任务。对比两次结果：

- 第二次 `debounce M` 应该更高
- 告警数量可能减少
- 高等级告警可能出现得更晚

如果效果不明显，通常是视频太短、目标停留时间太弱，或本来就没有触发足够多告警。可以换一段更长的视频，或使用 B 方案。

## 四、备选演示方式

如果现场时间有限，可以直接手动调整 M，快速展示“参数变化会影响告警行为”：

1. 跑一次视频，记录告警数量。
2. 通过 `PATCH /settings` 把 `consecutive_frames_for_escalation` 调大，例如 8。
3. 再跑同一视频。
4. 对比 `alerts_count`、告警等级和日志中的 `debounce M`。

这个方案不展示自动调参，但能快速说明规则阈值确实参与了流水线。

## 五、验收话术建议

可以这样说明：

> 系统会记录用户对告警的反馈，并统计最近窗口内的误报比例。当误报比例偏高时，后端会自动提高连续确认帧数，让后续告警更谨慎。这一机制可以降低短时抖动或偶发误检带来的告警噪声。

不要这样说：

> 系统已经可以完全自动学习所有误报并保证不再误报。

当前闭环是规则阈值层面的演示闭环，不是完整生产级在线学习系统。

## 六、相关接口

- `GET /settings`：查看生效阈值、YAML 基线、反馈统计和 ML 策略
- `PATCH /settings`：管理员调整阈值或恢复默认值
- `POST /alerts/{id}/feedback`：提交告警反馈
- `GET /jobs/{id}`：查看任务结果
