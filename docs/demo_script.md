# 阶段4 演示脚本：反馈驱动阈值（同视频前后对比）

一、演示目标

用同一段视频做两次任务，证明这条闭环真的生效：

1. 用户反馈误报
2. 系统自动收紧阈值（确认帧数 M 增大）
3. 同视频第二次运行告警行为发生变化

口径提醒：RepCount/LLSP 只用于算法验证，不写成园区实拍数据。

---

二、前置条件

- 后端启动：`cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- 前端启动：`cd frontend`，配置 `.env.local` 后执行 `pnpm dev`
- 管理员账号：`admin / admin123`

---

三、推荐演示流程（A方案）

### 第1步：先把参数恢复到 YAML 基线

- 登录 admin -> 系统设置 -> 预警策略 -> 点击“恢复 YAML 默认”
- 或调用 `PATCH /settings`，请求体：`{"reset_to_yaml_defaults": true}`
- 记录当前确认帧数 M（一般默认是 4）

### 第2步：第一次跑视频并记录结果

- 调用 `POST /jobs/run_local_path`，提交固定视频路径
- 任务完成后记下 `GET /jobs/{id}` 的 `alerts_count`
- 日志里应看到类似：`[pipeline job=...] debounce M=4 ...`

### 第3步：制造误报反馈，触发自动收紧

- 对多条告警提交 `false_positive`（建议至少 3 条）
- 如果窗口内误报率达到阈值（默认 `high_fp_threshold=0.4`），系统会异步把 M 提高 1
- 控制台会出现类似日志：`[system_config] auto-tune: ... 4 -> 5`

### 第4步：同一视频再跑一次

- 继续用完全相同的视频路径再跑一次任务
- 预期现象：告警数量变少，或者 `alert` 出现更晚
- 日志中的 `debounce M=` 应该已经是 5（或更高）

如果差异不明显，通常是视频太短或停留太弱，可换稍长片段再测。

---

四、备选演示流程（B方案）

如果你只想快速展示“参数改了，结果变了”，不走自动调参，也可以这样做：

1. 先跑视频 A，记录告警条数和最高级别
2. `PATCH /settings` 手动把 `consecutive_frames_for_escalation` 调大（如 8）
3. 再跑同一视频 A
4. 对比前后告警条数/级别变化

---

五、验收对照

| 验收点 | 观察方式 |
|------|------|
| 改配置后行为变化 | 对比两次任务 `alerts_count` + 日志中的 `debounce M=` |
| 反馈闭环成立 | `POST /alerts/{id}/feedback` + `GET/PATCH /settings` |
| 数据口径诚实 | 演示口述与 README、验收文档一致 |

---

六、API 速查

- `GET /settings`：查看生效阈值、YAML 基线、调参配置、误报统计
- `PATCH /settings`：admin 修改阈值或恢复默认
- `GET /auth/me`：查看当前用户角色（前端控制是否显示重置按钮）
