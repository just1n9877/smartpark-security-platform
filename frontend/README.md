# SmartGuard AI 前端系统说明

一、项目概述

这是智慧园区安防系统的管理员前端，基于 Next.js App Router 开发，负责登录注册、告警、监控、场景规则、人脸识别/人员授权、视频分析、AI 助手和系统设置等页面交互。

技术栈如下：

- Next.js 16 + React + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Recharts（图表）
- Lucide React（图标）

---

二、联调目标

前端目前已经和本项目 FastAPI 后端直连联调，重点覆盖：

1. 登录注册鉴权
2. 告警列表与反馈
3. 仪表盘统计
4. 数据分析和视频任务
5. 摄像头与场景规则配置
6. 人脸识别、人员库和授权状态
7. AI 助手

暂未实现或后端暂缺的能力，会在界面里用占位文案标出来，避免演示时夸大能力。

---

三、本地启动

1) 启动后端（8000）：

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

2) 配置前端环境变量：

```bash
cd frontend
copy .env.example .env.local
```

默认 `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`。

3) 安装依赖并启动前端（3000）：

```bash
cd frontend
pnpm install
pnpm dev
```

访问地址：<http://127.0.0.1:3000>

默认测试账号：

- `admin` / `admin123`
- `guard` / `guard123`

---

四、构建与运行

```bash
cd frontend
pnpm build
pnpm start
```

如果还要走旧调试入口（`src/server.ts`）：

```bash
pnpm dev:coze
```

---

五、目录结构

```text
src/
├── app/                 # 路由页面（App Router）
├── components/          # 业务组件与 UI 组件
├── constants/           # 业务常量
├── hooks/               # 自定义 hooks
├── lib/                 # 工具函数
└── types/               # TypeScript 类型定义
```

---

六、页面模块

- `/login`：登录/注册页（动画背景、表单校验、邮箱绑定）
- `/dashboard`：总览卡片、告警摘要、系统状态
- `/monitor`：实时监控视图
- `/alerts`：告警列表、详情、反馈
- `/rules`：场景规则配置（区域、越线、门、方向、敏感点）
- `/face`：人脸识别、人员库、人脸模板、授权配置、识别记录
- `/assistant`：AI 助手交互页（调用后端助手 API）
- `/devices`：设备状态与性能
- `/settings`：用户、权限、通知和安全设置

---

七、开发约定

1. 包管理器统一使用 `pnpm`。  
2. 基础组件优先复用 `src/components/ui/`（shadcn）。  
3. TypeScript 保持严格类型，提交前建议跑一遍 `pnpm ts-check`。  
4. 样式统一用 Tailwind 和现有主题变量，尽量不要混搭写法。  
5. 业务组件放在 `src/components/`，可复用逻辑优先下沉。

---

八、常用命令

```bash
pnpm dev       # 开发环境
pnpm build     # 生产构建
pnpm start     # 生产运行
pnpm lint      # 代码检查
pnpm ts-check  # 类型检查
```

---

九、补充说明

- 后端 CORS 已放行本地常用端口（比如 `3000`）
- 侧边栏状态会持久化到 `localStorage`
- 图表统一使用 Recharts，提示消息统一走 Toast 系统

---

十、相关文档

- 项目总 README：`../README.md`
- 后端说明：`../backend/README.md`
