# 智慧园区安防 AI 管理与仿真平台

## 一、项目概述

本项目面向智慧园区安防管理场景，提供从视频接入、轨迹分析、场景规则、告警分级到误报反馈的完整演示闭环。系统不只展示静态页面，而是把前端操作、后端接口、轨迹流水线和告警数据串在一起，方便在本地或服务器上完成一轮可复现的功能验证。

当前版本已经覆盖登录注册、摄像头管理、视频任务分析、场景规则配置、人脸识别/人员授权、告警中心、数据分析、系统设置和 AI 助手等模块。前端采用 Next.js，不是 Vue3 + Element Plus；后端采用 FastAPI，默认使用 SQLite 便于部署和演示。

## 二、技术架构

系统采用前后端分离设计，核心链路如下：

1. 前端展示层：提供登录、仪表盘、实时监控、规则配置、人脸识别、告警中心、数据分析、系统设置和 AI 助手页面。
2. 后端服务层：负责鉴权、摄像头、任务、规则、人员、人脸模板、告警、反馈和配置管理。
3. 轨迹分析层：通过 YOLO + DeepSORT 生成带 `track_id`、`camera_id`、时间戳和坐标历史的轨迹数据。
4. 场景规则层：支持区域、越线、门/入口、方向和敏感点靠近等规则。
5. 告警决策层：根据轨迹、规则、人员授权和阈值策略生成分级告警。
6. 数据存储层：结构化数据写入 `database/`，上传视频、关键帧和识别证据写入 `storage/`。

主要技术栈：

- 后端：FastAPI + SQLAlchemy + SQLite
- 前端：Next.js 16 + React + TypeScript + Tailwind CSS
- 视觉与轨迹：YOLO + DeepSORT
- 告警配置：`config/pipeline_alerts.yaml` + 数据库生效配置
- 部署方式：源码启动或 Docker Compose

## 三、核心能力

- 前端统一入口：登录、上传视频、启动分析、查看任务、配置摄像头和规则、处理告警都可以在前端完成。
- 事件驱动告警：检测过程仍然逐帧执行，但告警不再由单帧直接触发，而是由轨迹状态和复合事件共同决定。
- 场景规则配置：支持 `area`、`line_crossing`、`door`、`direction`、`object_proximity` 五类规则。
- 分级与去抖：后端根据风险区域、摄像头点位、时间段、人员授权、事件类型和连续确认帧生成告警等级，避免一帧一告警。
- 人脸识别与授权：可录入人员、上传人脸照片、配置授权规则，并将身份状态参与告警分级。
- 反馈闭环：告警反馈会进入误报统计，高误报时可自动收紧确认帧数 M，形成可演示的策略调整闭环。
- 数据分析：仪表盘和数据分析页读取后端真实 API，包括任务、告警、反馈、评测结果等。
- AI 助手：基于系统内的告警、摄像头和规则数据，提供面向运维场景的问答入口。

## 四、快速启动

### 1. Docker 方式

适合新机器或演示环境：

```bash
cd /path/to/smartpark-security-platform
docker compose up --build
```

启动后访问：

- 前端页面：<http://127.0.0.1:3000>
- 后端接口文档：<http://127.0.0.1:8000/docs>
- 健康检查：<http://127.0.0.1:8000/health>

Docker 模式下，如果要跑本地视频任务，请把 mp4 放到宿主机 `data/videos/`，接口请求里使用容器路径，例如：

```text
/app/data/videos/demo.mp4
```

### 2. 源码方式

后端：

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

如果要运行完整轨迹流水线，还需要在项目根目录安装根依赖：

```bash
pip install -r requirements.txt
pip install -r backend/requirements.txt
```

前端：

```bash
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

默认 API 地址为 `http://127.0.0.1:8000`，前端访问地址为 `http://127.0.0.1:3000`。

默认账号：

| 用户名 | 密码 | 角色 |
|------|------|------|
| `admin` | `admin123` | 管理员 |
| `guard` | `guard123` | 安保人员 |

## 五、推荐验收路径

最小闭环建议按下面顺序跑：

1. 打开前端并使用 `admin / admin123` 登录。
2. 在实时监控或设备页面确认摄像头数据可以加载。
3. 准备一段可检出人物的 mp4，提交视频任务。
4. 等待任务完成，检查轨迹点、告警数量和关键帧。
5. 进入告警中心，查看告警等级、原因、轨迹和证据。
6. 对告警提交误报反馈。
7. 进入系统设置，查看反馈统计和当前生效阈值。
8. 进入数据分析页，确认统计卡片和图表可以从后端加载。

更完整的命令级验证见 `TESTING.md`。

## 六、数据使用说明

项目中涉及的公开数据和样例视频必须如实说明来源。

- `RepCount`、`LLSP` 属于健身或重复动作视频，只能用于轨迹流水线和算法验证，不能写成“园区行人行走数据集”。
- ShanghaiTech Campus 等公开校园异常检测数据可以用于演示，但需要写清正式名称、论文信息、下载来源和许可范围。
- 如果做园区实际演示，建议使用自采视频，或明确说明数据不是甲方园区实拍。
- 大体积原始数据不建议提交到 Git，推荐放在本地或服务器数据目录，并在文档中写明路径和来源。

Shanghai 类帧序列转 mp4 的方法见 `docs/dataset_shanghai.md`。

## 七、当前边界

- 浏览器不能直接播放原生 RTSP。后端可以拉流分析，但前端实时播放需要 HLS 或 WebRTC 网关。
- 跨摄像头同一人高精度续接需要 Re-ID 模型和现场拓扑标定；当前版本已保留可扩展结构。
- 本地人脸识别实现适合演示人员库、授权状态和告警分级闭环；生产环境建议接入企业级人脸系统或更强的人脸模型。
- 无目标检出时，轨迹点和告警为空是正常结果，不代表接口失败。

## 八、文档索引

- 后端说明：`backend/README.md`
- 前端说明：`frontend/README.md`
- 手动验证：`TESTING.md`
- P0 验收：`docs/acceptance_p0.md`
- 告警阈值与去抖：`docs/pipeline_alerts.md`
- 反馈闭环演示：`docs/demo_script.md`
- Shanghai 数据接入：`docs/dataset_shanghai.md`
- Docker 配置：`docker-compose.yml`、`docker/Dockerfile.backend`、`docker/Dockerfile.frontend`
