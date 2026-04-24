# 后端服务设计与使用说明

一、模块概述

后端基于 FastAPI + SQLAlchemy + SQLite，负责园区安防场景下的登录鉴权、告警管理、任务调度和参数配置。

当前这部分后端主要做了：

- 轨迹分析与告警流水线（YOLO + DeepSORT）
- 异步任务管理（本地视频分析）
- 预警阈值与去抖参数在线配置（`/settings`）
- 告警反馈闭环（反馈后可触发 M 值收紧）

默认数据库路径：`../database/app.db`

---

二、环境与安装

环境要求：

- Python 3.10+

安装说明：

```bash
cd backend
pip install -r requirements.txt
```

如果要跑完整轨迹流水线（比如 `POST /jobs/run_local_path` 或批处理脚本），还需要在项目根补装依赖：

```bash
pip install -r requirements.txt
pip install -r backend/requirements.txt
```

---

三、启动方式

在 `backend` 目录执行：

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

启动后访问：

- API 文档：<http://127.0.0.1:8000/docs>
- 健康检查：<http://127.0.0.1:8000/health>

---

四、数据与口径说明

1. `RepCount` 等健身/重复动作视频，只用于轨迹联调和算法验证。  
2. 文档里不要把这类数据写成“园区行人行走数据集”。  
3. 园区演示或上线建议使用自采视频，或明确标注来源的数据。  
4. 批处理脚本默认读取 `DATASET_VIDEO_ROOT`；未设置时会尝试 `<项目根>/data/RepCount/video/train`。

---

五、流水线参数来源

- 基准配置文件：`config/pipeline_alerts.yaml`
- 调用 `POST /jobs/run_local_path` 且未传 `config_path` 时，实际生效参数以数据库 `system_configs`（id=1）为准
- 任务启动日志会输出当前去抖配置（如 `debounce M=`）

参考文档：

- `docs/pipeline_alerts.md`
- `docs/demo_script.md`

---

六、默认账号

| 用户名 | 密码 | 角色 |
|------|------|------|
| admin | admin123 | admin |
| guard | guard123 | guard |

密码使用 `bcrypt` 哈希后存储。

---

七、环境变量

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | 覆盖默认 SQLite 路径 |
| `JWT_SECRET` | JWT 签名密钥（生产必须修改） |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 令牌有效期（默认 1440） |
| `DATASET_VIDEO_ROOT` | 批处理视频根目录 |

---

八、数据库说明

首次启动会自动 `create_all` 建表。若旧库缺少 `alerts.job_id` 列，系统会在启动时尝试 `ALTER TABLE` 补列。目前还没接入 Alembic 迁移。

---

九、核心 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/auth/me` | 当前用户信息 |
| GET | `/alerts` | 告警列表（支持 `level`、`skip`、`limit`） |
| GET | `/alerts/{id}` | 告警详情 |
| POST | `/alerts/{id}/feedback` | 提交反馈并异步更新误报统计 |
| GET | `/settings` | 查看当前生效阈值与误报统计 |
| PATCH | `/settings` | admin 修改阈值或恢复 YAML 默认值 |
| GET | `/dashboard/summary` | 大屏统计汇总 |
| GET | `/jobs` | 最近任务列表 |
| GET | `/jobs/{job_id}` | 任务详情、轨迹点和告警计数 |
| POST | `/jobs/run_local_path` | 异步分析本地视频并返回 `job_id` |

静态关键帧目录为项目根 `storage/frames/`，HTTP 访问路径为 `GET /media/frames/...`。

---

十、常用命令

1) curl 测试（bash）

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .access_token)

curl -s -X POST http://127.0.0.1:8000/jobs/run_local_path \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path":"D:/datasets/RepCount/video/train/some.mp4"}'

curl -s http://127.0.0.1:8000/jobs/1 -H "Authorization: Bearer $TOKEN"
```

2) 批处理脚本（项目根）

```bash
set PYTHONPATH=backend
python scripts/batch_extract_trajectories.py --root D:\path\to\mp4\folder
```

---

十一、阶段2自检建议

- 至少跑通 1 个含行人视频，`TrajectoryPoint` 数量大于 0
- `TrajectorySummary` 正常写入，宽松阈值下可触发告警
- `simple_intrusion_mode` 在 true/false 两种模式下行为符合预期
- 同一 `track_id` 在去抖冷却时间内不会重复告警
- 文档口径保持一致，不将跨域数据伪装成园区实景数据

---

十二、相关文档

- 项目总览：`README.md`
- 前端说明：`frontend/README.md`
- Docker 与验收：`docker-compose.yml`、`TESTING.md`
