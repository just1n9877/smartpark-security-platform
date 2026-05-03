# 手动验收指南

这份文档用于跑通项目的主流程。它不是单元测试说明，而是一份可以照着操作的验收清单，适合本地联调、云服务器部署后自检，也适合答辩前快速确认系统状态。

默认地址：

- 后端：`http://127.0.0.1:8000`
- 前端：`http://127.0.0.1:3000`

默认账号：

- 管理员：`admin / admin123`
- 安保人员：`guard / guard123`

## 一、启动检查

### Docker 方式

```bash
cd /path/to/smartpark-security-platform
docker compose up --build
```

检查服务：

```bash
curl -s http://127.0.0.1:8000/health
```

浏览器打开 `http://127.0.0.1:3000`，能看到登录页即可。

### 源码方式

后端：

Windows PowerShell：

```powershell
cd C:\path\to\smartpark-security-platform
py -m pip install -r backend\requirements.txt
$env:PYTHONPATH="backend;."
py -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

macOS / Linux：

```bash
cd /path/to/smartpark-security-platform
python -m pip install -r backend/requirements.txt
PYTHONPATH=backend:. python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

前端：

```bash
cd frontend
npm install
npm run dev
```

## 二、登录与基础页面

先登录获取 token：

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .access_token)
```

如果没有 `jq`，也可以直接在前端登录，然后用页面完成后续验证。

基础接口检查：

```bash
curl -s http://127.0.0.1:8000/auth/me -H "Authorization: Bearer $TOKEN"
curl -s http://127.0.0.1:8000/dashboard/summary -H "Authorization: Bearer $TOKEN"
```

前端应能打开：

- `/dashboard`：仪表盘
- `/monitor`：实时监控
- `/alerts`：告警中心
- `/analytics`：数据分析
- `/settings`：系统设置

## 三、前端闭环页面检查

每个页面都应能看到真实后端请求，而不是只展示静态样例。浏览器开发者工具 Network 中不应长期存在 401/403/422/500；若接口失败，页面应展示可读错误。

建议逐页检查：

- `/dashboard`：`GET /dashboard/summary`、`GET /alerts?limit=5`、`GET /cameras` 成功；接口失败时顶部状态应显示 API 异常。
- `/analytics`：上传视频会先 `POST /jobs`，再 `POST /jobs/{id}/run`；任务列表来自 `GET /jobs?limit=20`，应显示真实轨迹、告警数量和失败原因。
- `/alerts`：列表来自 `GET /alerts?limit=200`；展开告警会请求 `GET /alerts/{id}/trajectory`；提交反馈会请求 `POST /alerts/{id}/feedback` 并刷新列表。
- `/monitor`：摄像头列表、添加摄像头、启动/停止分析分别对应 `/cameras` 和 `/cameras/{id}/start|stop`。
- `/rules`：新建、编辑、启用/停用、删除规则分别对应 `POST/PUT/DELETE /scene-rules`。
- `/face`：新增/编辑/停用人员、上传人脸、创建/撤销授权分别对应 `/face/persons`、`/face/persons/{id}/faces`、`/face/authorizations`。
- `/devices`：设备列表、新增、状态更新、删除来自 `/devices`，不再使用前端硬编码设备数据。
- `/settings`：所有 Tab 都应有真实后端闭环。`预警策略` 读写 `/settings`；`个人信息` 读写 `/auth/me`；`用户管理/角色权限` 使用 `/users`；`通知设置` 使用 `/users/me/notifications`；`安全设置` 使用 `/auth/change-password` 与 `/users/security-logs`。

本地联调时如果前端不是通过 `http://127.0.0.1:3000` 打开，需要确认后端 `CORS_ORIGINS` 包含实际前端 Origin，并确认 `NEXT_PUBLIC_API_BASE_URL` 指向浏览器可访问的后端地址。

## 四、视频任务主流程

准备一段可检测到人物的 mp4。Docker 模式建议放在 `data/videos/`，请求路径使用容器路径；源码模式使用本机绝对路径。

Docker 路径示例：

```text
/app/data/videos/demo.mp4
```

源码路径示例：

```text
C:/Users/you/Desktop/demo.mp4
```

提交任务：

```bash
curl -s -X POST http://127.0.0.1:8000/jobs/run_local_path \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path":"/app/data/videos/demo.mp4"}'
```

返回里会有 `job_id`。假设为 `1`，轮询任务：

```bash
curl -s http://127.0.0.1:8000/jobs/1 -H "Authorization: Bearer $TOKEN"
```

验收看点：

- `status` 最终变为 `completed`
- `trajectory_points_count > 0` 表示检出了人物轨迹
- `alerts_count` 可以为 0，取决于视频内容和阈值
- 后端日志能看到任务启动和去抖参数，例如 `debounce M=...`

第一次运行 YOLO 可能会下载权重，CPU 环境下推理较慢，属于正常现象。

## 五、告警与证据

查询告警：

```bash
curl -s "http://127.0.0.1:8000/alerts?limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

重点检查：

- 告警字段包含 `level`、`alert_type`、`triggered_at`、`track_id`、`camera_id`、`job_id`
- 如有关键帧，路径可以通过 `/media/frames/...` 访问
- 前端告警中心能展开详情，看到原因、证据和反馈入口

如果没有告警，不一定是失败。短视频、没有明显停留或没有进入规则区域时，系统可能只生成轨迹不生成告警。

## 六、反馈闭环

对一条告警提交误报反馈。下面以告警 `1` 为例：

```bash
curl -s -X POST "http://127.0.0.1:8000/alerts/1/feedback" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"false_positive","note":"manual-test"}'
```

查看系统设置：

```bash
curl -s http://127.0.0.1:8000/settings \
  -H "Authorization: Bearer $TOKEN"
```

验收看点：

- `feedback_rollup` 有统计结果
- `effective` 显示当前生效阈值
- `unified_ml` 显示 ML 策略参数
- 多条误报达到阈值后，后台可自动提高确认帧数 M

前端路径为：告警中心提交反馈，然后到系统设置查看反馈统计和阈值。

## 七、数据分析与评测

数据分析页主要读取：

- `GET /dashboard/summary`
- `GET /dashboard/metrics`

如果要生成 Holdout 评测记录，可以使用管理员 token 调用：

```bash
curl -s -X POST http://127.0.0.1:8000/admin/evaluation/run \
  -H "Authorization: Bearer $TOKEN"
```

然后刷新前端 `/analytics` 页面，检查评测卡片和图表是否出现数据。

## 七、扩展能力检查

这些能力不一定每次都要跑，但可以用于完整验收：

1. 训练任务：`POST /admin/training/enqueue`，再查 `GET /admin/training/runs`。
2. 模型版本：`GET /admin/models/versions`，必要时用 `POST /admin/models/activate` 切换。
3. RTSP 流：摄像头配置 `rtsp_url` 后，调用 `POST /admin/streams/{camera_id}/start`。
4. 流式去重测试：项目根目录运行 `python tests/test_stream_dedupe.py -v`。
5. 轨迹可视化：前端告警中心展开带 `job_id` 的告警，查看叙事文案和轨迹折线。

## 八、数据口径检查

答辩和文档中请保持一致口径：

- `RepCount`、`LLSP` 是健身或重复动作视频，只用于算法验证。
- ShanghaiTech Campus 等公开数据可用于校园异常检测演示，但必须写清来源。
- 不要把公开数据或跨域视频写成“园区实拍”。
- 若使用自采园区视频，应单独说明采集来源和授权情况。

## 九、常见问题

### 1. `File not found`

`/jobs/run_local_path` 读取的是后端机器上的路径。Docker 模式要用容器路径，源码模式要用后端进程能访问到的本机路径。

### 2. 前端 `Failed to fetch`

先检查后端是否正常：

```bash
curl -s http://127.0.0.1:8000/health
```

如果前端部署在公网域名或 IP，需要把该来源加入后端 `CORS_ORIGINS`。

### 3. 页面能打开但没有数据

先确认是否已登录，再确认数据库里是否已有视频任务、告警或反馈。新库刚启动时，统计数据为 0 是正常的。

### 4. 服务器构建后页面还是旧的

确认 `git pull` 成功、`npm run build` 成功，并重启了实际对外服务的进程，例如：

```bash
pm2 restart smartpark
```
