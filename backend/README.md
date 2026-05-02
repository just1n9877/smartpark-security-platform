# 后端服务说明

## 一、模块定位

后端是整个智慧园区安防平台的数据和业务中心，负责登录鉴权、摄像头管理、视频任务调度、轨迹与告警入库、反馈闭环、系统配置和模型管理等能力。前端页面上的主要数据都来自这里。

当前后端基于 FastAPI + SQLAlchemy + SQLite 实现，默认数据库路径为：

```text
database/app.db
```

首次启动时会自动建表。对于旧库中已知缺失字段，服务会在启动时做必要的 SQLite 兼容迁移；当前还没有引入 Alembic。

## 二、环境准备

要求：

- Python 3.10+
- 建议使用虚拟环境

只启动基础 API：

Windows PowerShell：

```powershell
cd C:\path\to\smartpark-security-platform
py -m pip install -r backend\requirements.txt
```

macOS / Linux：

```bash
cd /path/to/smartpark-security-platform
python -m pip install -r backend/requirements.txt
```

如果要跑完整视频分析流水线，还需要在项目根目录安装视觉和轨迹相关依赖：

```bash
python -m pip install -r requirements.txt
python -m pip install -r backend/requirements.txt
```

## 三、启动方式

后端建议从项目根目录启动，便于同时加载 `backend/` 与项目根目录下的 `services/`：

Windows PowerShell：

```powershell
cd C:\path\to\smartpark-security-platform
$env:PYTHONPATH="backend;."
py -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

macOS / Linux：

```bash
cd /path/to/smartpark-security-platform
PYTHONPATH=backend:. python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

启动后访问：

- API 文档：<http://127.0.0.1:8000/docs>
- 健康检查：<http://127.0.0.1:8000/health>
- 静态证据文件：<http://127.0.0.1:8000/media/...>

## 四、默认账号

| 用户名 | 密码 | 角色 |
|------|------|------|
| `admin` | `admin123` | 管理员 |
| `guard` | `guard123` | 安保人员 |

密码使用 `bcrypt` 哈希后写入数据库。生产环境部署时应修改默认账号和 `JWT_SECRET`。

## 五、核心业务链路

1. 前端登录后获取 JWT。
2. 用户创建摄像头、场景规则或人员授权信息。
3. 用户上传视频或提交本地视频路径。
4. 后端创建分析任务，并在后台调用轨迹流水线。
5. 流水线写入轨迹点、轨迹摘要、关键帧和告警。
6. 前端查询任务详情、告警列表和统计图表。
7. 用户对告警提交反馈。
8. 系统统计误报情况，并在满足条件时自动收紧确认帧数 M。

## 六、主要环境变量

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | 覆盖默认 SQLite 数据库地址 |
| `JWT_SECRET` | JWT 签名密钥，生产环境必须修改 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token 有效期，默认 1440 分钟 |
| `CORS_ORIGINS` | 额外允许的前端来源，多个地址用逗号分隔 |
| `DATASET_VIDEO_ROOT` | 批处理脚本默认读取的视频根目录 |
| `STREAM_DEMO_MAX_FRAMES` | RTSP 演示最大帧数，`0` 表示不限制 |
| `DEEPSEEK_API_KEY` | DeepSeek API Key；配置后 AI 助手优先调用 DeepSeek |
| `DEEPSEEK_MODEL` | DeepSeek 模型名，默认 `deepseek-chat` |
| `DEEPSEEK_API_URL` | DeepSeek Chat Completions 地址，默认官方接口 |
| `DEEPSEEK_TIMEOUT_SEC` | DeepSeek 请求超时时间，默认 30 秒 |
| `DEEPSEEK_TEMPERATURE` | DeepSeek 回复随机性，默认 `0.3` |
| `MEDIAMTX_ENABLED` | 是否启用 MediaMTX WebRTC 网关，默认启用 |
| `MEDIAMTX_API_URL` | 后端访问 MediaMTX API 的地址，默认 `http://127.0.0.1:9997` |
| `MEDIAMTX_PUBLIC_WEBRTC_URL` | 浏览器访问 MediaMTX WebRTC 的地址，默认 `http://127.0.0.1:8889` |
| `MEDIAMTX_TIMEOUT_SEC` | MediaMTX API 请求超时时间，默认 5 秒 |

本地常见端口如 `3000`、`3001`、`5000`、`5173` 已默认放行。公网部署时，需要把实际前端地址加入 `CORS_ORIGINS`。
如果没有配置 `DEEPSEEK_API_KEY`，AI 助手会自动使用本地规则回复，不影响基础功能。

## 七、核心 API 分组

### 鉴权

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/auth/login` | 登录并返回 token |
| `POST` | `/auth/register` | 注册普通安保账号 |
| `GET` | `/auth/me` | 查询当前用户 |

### 视频任务

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/jobs` | 最近任务列表 |
| `POST` | `/jobs` | 上传视频或登记本地路径 |
| `POST` | `/jobs/run_local_path` | 直接分析后端可访问的本地视频 |
| `POST` | `/jobs/{job_id}/run` | 启动已登记任务 |
| `GET` | `/jobs/{job_id}` | 任务详情、轨迹点数量和告警数量 |

### 摄像头与实时流

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/cameras` | 摄像头列表 |
| `POST` | `/cameras` | 添加摄像头 |
| `POST` | `/cameras/{camera_id}/start` | 启动后端 RTSP 分析 worker |
| `POST` | `/cameras/{camera_id}/stop` | 停止后端 RTSP 分析 worker |
| `POST` | `/cameras/{camera_id}/webrtc` | 注册 MediaMTX 路径并返回 WebRTC 播放地址 |

### 告警与反馈

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/alerts` | 告警列表 |
| `GET` | `/alerts/{id}` | 告警详情 |
| `GET` | `/alerts/{id}/trajectory` | 告警关联轨迹和叙事说明 |
| `POST` | `/alerts/{id}/feedback` | 提交或更新告警反馈 |

### 配置与统计

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/settings` | 当前阈值、反馈统计和 ML 策略 |
| `PATCH` | `/settings` | 管理员修改阈值或恢复 YAML 默认值 |
| `GET` | `/dashboard/summary` | 仪表盘汇总 |
| `GET` | `/dashboard/metrics` | 数据分析页指标和评测历史 |

### 管理员能力

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/admin/training/runs` | 训练任务列表 |
| `POST` | `/admin/training/enqueue` | 入队全量训练 |
| `GET` | `/admin/models/versions` | 模型版本列表 |
| `POST` | `/admin/models/activate` | 激活指定模型版本 |
| `POST` | `/admin/evaluation/run` | 执行 Holdout 评测 |
| `GET` | `/admin/evaluation/latest` | 最近评测报告 |
| `POST` | `/admin/streams/{camera_id}/start` | 启动 RTSP worker |
| `POST` | `/admin/streams/{camera_id}/stop` | 停止 RTSP worker |
| `GET` | `/admin/streams/active` | 查看当前活跃流 |

## 八、流水线参数

基准参数在：

```text
config/pipeline_alerts.yaml
```

通过 API 启动视频任务时，系统会读取 YAML 基线，并合并数据库中 `system_configs` 的生效配置。任务启动日志会打印当前去抖参数，例如：

```text
debounce M=4
```

相关说明见：

- `docs/pipeline_alerts.md`
- `docs/demo_script.md`

## 九、常用命令

登录：

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .access_token)
```

提交视频任务：

```bash
curl -s -X POST http://127.0.0.1:8000/jobs/run_local_path \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path":"D:/datasets/demo.mp4"}'
```

查询任务：

```bash
curl -s http://127.0.0.1:8000/jobs/1 \
  -H "Authorization: Bearer $TOKEN"
```

批处理脚本：

```bash
set PYTHONPATH=backend
python scripts/batch_extract_trajectories.py --root D:\path\to\mp4\folder
```

## 十、数据口径

`RepCount`、`LLSP` 等视频适合用于轨迹和算法验证。园区场景演示建议使用自采视频；如使用公开数据，材料中应说明数据集正式名称、来源和许可范围。
