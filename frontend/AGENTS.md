# SmartGuard AI 安防系统 - 管理员前端

## 项目概述

智慧园区AI安防系统管理员前端，采用深色科技风格设计，提供高端大气、丝滑流畅的交互体验。

## 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript 5
- **样式**: Tailwind CSS 4 + 自定义科技风 CSS
- **图标**: Lucide React
- **字体**: Orbitron (标题), Inter (正文)
- **图表**: Recharts
- **组件库**: shadcn/ui

## 项目结构

```
src/
├── app/                      # Next.js App Router
│   ├── alerts/              # 告警中心页面
│   ├── assistant/           # AI助手页面
│   ├── dashboard/           # 仪表盘页面
│   ├── devices/             # 设备管理页面
│   ├── face/                # 人脸识别页面
│   ├── login/               # 登录页面
│   ├── monitor/             # 实时监控页面
│   └── settings/            # 系统设置页面
├── components/
│   ├── charts/              # 图表组件
│   │   └── index.tsx        # 图表组件库
│   ├── ui/                  # UI组件
│   │   ├── TechComponents.tsx # 科技风组件
│   │   └── Toast.tsx         # Toast通知系统
│   ├── ClientLayout.tsx      # 客户端布局
│   └── Sidebar.tsx           # 侧边栏组件
├── constants/               # 常量定义
│   └── index.ts             # 告警级别、状态等配置
├── types/                   # TypeScript类型
│   └── index.ts             # 全局类型定义
└── hooks/                   # 自定义Hooks
```

## 开发规范

### TypeScript 严格检查

项目要求严格的 TypeScript 类型检查，运行以下命令进行验证：

```bash
pnpm ts-check
```

**类型定义注意事项：**

1. **StatCard 组件**：color 属性必须是 `'cyan' | 'amber' | 'emerald' | 'purple'` 字面量类型，不能是普通字符串
2. **Header 组件**：支持 children prop，可以在标题栏右侧添加自定义操作按钮
3. **所有 Props 类型**：必须明确定义并导出，避免 any 类型

## 页面结构

### 1. 登录页面 (`/login`)
- 粒子动画背景
- 鼠标跟随光效
- 霓虹发光效果
- 表单验证

### 2. 仪表盘 (`/dashboard`)
- 实时统计卡片（摄像头、告警、人员、健康度）
- 实时告警列表（可展开详情）
- 摄像头状态监控
- 系统性能指标
- 快捷操作入口

### 3. 实时监控 (`/monitor`)
- 网格/列表视图切换
- AI检测统计
- 视频播放控制
- 添加摄像头弹窗

### 4. 告警中心 (`/alerts`)
- 多级别告警（紧急/高危/中等/低）
- 告警状态管理（待处理/处理中/已解决）
- 批量操作
- 告警详情展开

### 5. 人脸识别 (`/face`)
- 人员管理（网格/列表视图）
- Tab切换（人员/通行记录）
- 添加人员弹窗
- 识别置信度展示

### 6. AI助手 (`/assistant`)
- 智能对话界面
- 快捷问题
- AI建议操作
- 打字机效果

### 7. 设备管理 (`/devices`)
- 设备状态监控
- 性能指标（CPU/内存/磁盘）
- 设备详情展开
- 筛选和搜索

### 8. 系统设置 (`/settings`)
- 个人信息管理
- 用户管理
- 角色权限
- 通知设置
- 安全设置

## 公共组件

### UI组件 (`components/ui/`)

| 组件 | 说明 |
|------|------|
| `TechCard` | 科技风卡片，支持 hover/glow 效果 |
| `StatCard` | 统计卡片，显示数值、趋势、图标 |
| `Badge` | 徽章组件，支持多种变体 |
| `StatusDot` | 状态指示器 |
| `ProgressBar` | 进度条组件 |
| `EmptyState` | 空状态展示 |
| `Skeleton` | 骨架屏组件 |
| `LoadingSpinner` | 加载动画 |
| `LoadingOverlay` | 全屏加载遮罩 |
| `Toast` | 通知提示系统 |

### 图表组件 (`components/charts/`)

| 组件 | 说明 |
|------|------|
| `AreaChartComponent` | 面积图 |
| `PieChartComponent` | 饼图/环形图 |
| `BarChartComponent` | 柱状图 |
| `LineChartComponent` | 折线图 |
| `LiveChart` | 实时数据图表（自动更新） |

## 设计特点

- **深色科技风**: 深蓝黑底色 (#030712)
- **霓虹渐变**: 蓝绿渐变 (#06b6d4 / #10b981)
- **毛玻璃效果**: backdrop-filter blur
- **动态光效**: 鼠标跟随光效
- **丝滑动画**: 悬浮发光、脉冲、扫描线效果
- **科技网格背景**: 增强科技感

## 类型定义 (`src/types/`)

```typescript
// 告警类型
type AlertLevel = 'critical' | 'warning' | 'medium' | 'low';
type AlertStatus = 'pending' | 'handling' | 'resolved' | 'falseAlarm';

// 摄像头类型
type CameraStatus = 'online' | 'warning' | 'offline';

// 组件Props类型
interface AlertRecord { ... }
interface CameraRecord { ... }
interface StatData { ... }
```

## 常量配置 (`src/constants/`)

```typescript
ALERT_LEVELS      // 告警级别配置（颜色、标签、优先级）
ALERT_STATUS      // 告警状态配置
CAMERA_STATUS     // 摄像头状态配置
THEME_COLORS      // 主题颜色
ANIMATION         // 动画时长配置
SPACING           // 间距配置
```

## 侧边栏功能

- 展开/收缩按钮（带动画）
- 状态保存到 localStorage
- 鼠标悬停显示按钮
- 平滑宽度过渡动画
- 悬浮显示菜单提示

## Toast 通知系统

```tsx
import { useToast } from '@/components/ui/Toast';

function MyComponent() {
  const { toast } = useToast();
  
  // 使用
  toast.success('操作成功', '数据已保存');
  toast.error('操作失败', '请重试');
  toast.warning('警告', '请注意');
  toast.info('提示', '有新消息');
}
```

## 运行命令

```bash
# 开发环境
pnpm dev

# 构建
pnpm build

# 生产环境
pnpm start

# 代码检查
pnpm lint
```

## 访问地址

http://${COZE_PROJECT_DOMAIN_DEFAULT}

## 注意事项

- 默认账号: admin / admin123
- 侧边栏状态会保存到浏览器 localStorage
- 图表组件使用 Recharts 库
- Toast 通知系统已全局注册，无需手动引入
