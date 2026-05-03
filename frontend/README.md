# SmartGuard AI 前端说明

## 一、模块定位

前端是智慧园区安防平台的统一操作入口。用户通过这里完成登录注册、查看仪表盘、管理摄像头、提交视频分析、配置场景规则、处理告警、查看数据分析、管理系统参数以及使用 AI 助手。

当前前端基于 Next.js App Router 开发，界面采用深色科技风格。页面数据主要来自 FastAPI 后端，便于展示真实的业务流程和数据闭环。

## 二、技术栈

- Next.js 16 + React + TypeScript
- Tailwind CSS 4
- shadcn/ui 基础组件
- Recharts 图表
- Lucide React 图标
- SWR 数据刷新

## 三、环境变量

复制示例配置：

```bash
copy .env.example .env.local
```

核心变量：

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

如果前端部署在公网，浏览器必须能访问这个 API 地址；同时后端需要在 `CORS_ORIGINS` 中放行前端来源。

## 四、本地开发

先在项目根目录启动后端：

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

再启动前端：

```bash
cd frontend
npm install
npm run dev
```

访问：

```text
http://127.0.0.1:3000
```

默认账号：

- `admin / admin123`
- `guard / guard123`

## 五、生产构建

```bash
cd frontend
npm run build
npm run start
```

如果使用 PM2：

```bash
pm2 restart smartpark
```

构建后若页面仍是旧版本，通常是没有重启实际对外服务的进程，或 Nginx/PM2 指向了旧目录。

## 六、页面说明

| 路由 | 说明 |
|------|------|
| `/login` | 登录、注册、忘记密码提示 |
| `/dashboard` | 今日告警、摄像头、任务状态和快捷入口 |
| `/monitor` | 摄像头列表、添加摄像头、监控画面放大查看 |
| `/alerts` | 告警列表、详情、轨迹、反馈 |
| `/rules` | 区域、越线、门、方向和敏感点规则配置 |
| `/face` | 人员库、人脸模板、授权规则和识别记录 |
| `/analytics` | 告警趋势、反馈统计、Holdout 评测 |
| `/assistant` | AI 助手问答 |
| `/devices` | 设备与运行状态展示 |
| `/settings` | 阈值、反馈统计、ML 策略和系统参数 |

暂未正式接入的能力会在页面中以说明文字标出，便于区分已完成能力和后续扩展能力。

## 七、目录结构

```text
src/
├── app/                 # Next.js 页面路由
├── components/          # 业务组件和 UI 组件
├── constants/           # 告警级别、状态等常量
├── hooks/               # 自定义 hooks
├── lib/                 # API、工具函数和校验逻辑
└── types/               # 前端类型定义
```

## 八、实现约定

1. 页面数据优先通过 `src/lib/api.ts` 调后端接口，不在页面里散写 API 地址。
2. 组件样式优先使用 Tailwind 和现有科技风主题。
3. 图表统一使用 Recharts。
4. 提示消息统一走 Toast 系统。
5. 提交前建议运行类型检查和 lint。

常用命令：

```bash
npm run dev       # 开发环境
npm run build     # 生产构建
npm run start     # 生产运行
npm run lint      # 代码检查
npm run ts-check  # 类型检查
```

## 九、联调排查

### 登录提示 `Failed to fetch`

先确认后端健康检查：

```bash
curl -s http://127.0.0.1:8000/health
```

如果前端来源是公网 IP 或域名，需要把该来源加入后端 `CORS_ORIGINS`。

### 页面显示 0 或空列表

新数据库没有任务和告警时，统计为 0 是正常现象。先跑一条视频任务，再刷新仪表盘和数据分析页。

### 线上构建后页面没变化

检查三件事：

1. `git log -1 --oneline` 是否为最新提交。
2. `npm run build` 是否在实际部署目录执行成功。
3. PM2、Docker 或 Nginx 是否已经重启并指向该目录。

## 十、相关文档

- 项目总览：`../README.md`
- 后端说明：`../backend/README.md`
- 手动验收：`../TESTING.md`
