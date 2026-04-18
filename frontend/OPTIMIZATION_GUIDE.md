# SmartGuard AI 安防系统 - 全方位优化建议

## 📊 一、性能优化

### 1.1 首屏加载优化
```typescript
// 建议：使用 next/image 优化图片
import Image from 'next/image';

<Image
  src="/camera-preview.jpg"
  alt="摄像头预览"
  width={640}
  height={360}
  priority // 优先加载首屏图片
  placeholder="blur" // 模糊占位
/>
```

### 1.2 代码分割与懒加载
```typescript
// 建议：动态导入非首屏组件
const AnalyticsChart = dynamic(() => import('@/components/charts/Analytics'), {
  loading: () => <Skeleton />,
  ssr: false
});

// 建议：路由级别的代码分割
// Next.js 自动支持，但可优化第三方库
```

### 1.3 缓存策略
```typescript
// 建议：在 API routes 中添加缓存头
export async function GET(request: Request) {
  return Response.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
```

### 1.4 性能监控
```typescript
// 建议：添加 Web Vitals 监控
// 在 layout.tsx 中添加
'use client';
import { WebVitals } from '@/components/WebVitals';

export function WebVitalsMonitor() {
  useEffect(() => {
    import('web-vitals').then(({ getCLS, getFID, getLCP }) => {
      getCLS(console.log);
      getFID(console.log);
      getLCP(console.log);
    });
  }, []);
  return null;
}
```

## 🎨 二、用户体验优化

### 2.1 加载状态优化
```typescript
// 建议：骨架屏替代 Spinner
<Card>
  <CardHeader>
    <Skeleton className="h-4 w-[250px]" />
  </CardHeader>
  <CardContent>
    <Skeleton className="h-4 w-[200px]" />
  </CardContent>
</Card>

// 建议：添加内容加载动画
<div className="animate-pulse">
  <div className="h-2 bg-slate-700 rounded w-full mb-2"></div>
  <div className="h-2 bg-slate-700 rounded w-3/4"></div>
</div>
```

### 2.2 错误处理优化
```typescript
// 建议：友好的错误边界
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error:', error, errorInfo);
    // 上报到监控服务
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <AlertTriangle className="w-12 h-12 text-amber-400 mb-4" />
          <h3>页面出现了一些问题</h3>
          <Button onClick={() => this.setState({ hasError: false })}>
            重试
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### 2.3 空状态优化
```typescript
// 建议：为每个列表添加空状态组件
<EmptyState
  icon={Camera}
  title="暂无摄像头"
  description="点击下方按钮添加第一个摄像头"
  action={
    <Button onClick={() => setShowAddModal(true)}>
      <Plus className="w-4 h-4 mr-2" />
      添加摄像头
    </Button>
  }
/>
```

### 2.4 交互反馈优化
```typescript
// 建议：按钮点击涟漪效果
<button className="relative overflow-hidden active:scale-95 transition-transform">
  <span className="absolute inset-0 bg-white/20 animate-ping opacity-0" />
  点击我
</button>

// 建议：表单提交状态
<Button disabled={isLoading}>
  {isLoading ? (
    <>
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      提交中...
    </>
  ) : '提交'}
</Button>
```

## 🔒 三、安全性优化

### 3.1 认证与授权
```typescript
// 建议：添加 API 路由鉴权中间件
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function middleware(request: Request) {
  const token = request.headers.get('authorization');
  
  if (!token) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const decoded = await verifyToken(token);
    request.headers.set('user', JSON.stringify(decoded));
  } catch {
    return NextResponse.json({ error: 'Token 无效' }, { status: 401 });
  }
}
```

### 3.2 输入验证
```typescript
// 建议：使用 Zod 进行严格验证
import { z } from 'zod';

const cameraSchema = z.object({
  name: z.string().min(2).max(50),
  location: z.string().min(2).max(100),
  rtsp: z.string().url().optional(),
  area: z.enum(['entrance', 'lobby', 'parking', 'perimeter', 'public'])
});

export async function POST(request: Request) {
  const body = await request.json();
  const result = cameraSchema.safeParse(body);
  
  if (!result.success) {
    return NextResponse.json(
      { error: '数据验证失败', details: result.error },
      { status: 400 }
    );
  }
  
  // 处理数据
}
```

### 3.3 XSS 防护
```typescript
// 建议：所有用户输入进行转义
import DOMPurify from 'dompurify';

// 在渲染用户输入时
const sanitizedInput = DOMPurify.sanitize(userInput);

// 建议：React 自动转义，但小心 dangerouslySetInnerHTML
```

### 3.4 敏感数据保护
```typescript
// 建议：日志脱敏
export function logSensitiveData(data: any) {
  const sanitized = {
    ...data,
    password: '[REDACTED]',
    token: '[REDACTED]',
    ssn: '***-**-' + data.ssn?.slice(-4)
  };
  console.log(sanitized);
}
```

## 🧪 四、代码质量优化

### 4.1 TypeScript 严格模式
```json
// tsconfig.json 建议配置
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### 4.2 测试覆盖
```typescript
// 建议：添加单元测试
// 使用 Vitest
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardPage } from '@/app/dashboard/page';

describe('DashboardPage', () => {
  it('renders statistics cards', () => {
    render(<DashboardPage />);
    expect(screen.getByText('在线摄像头')).toBeInTheDocument();
  });
});

// 建议：添加 E2E 测试
// 使用 Playwright
import { test, expect } from '@playwright/test';

test('添加摄像头流程', async ({ page }) => {
  await page.goto('/monitor');
  await page.click('button:has-text("添加摄像头")');
  await page.fill('input[placeholder="请输入摄像头名称"]', '测试摄像头');
  await page.fill('input[placeholder="请输入安装位置"]', '1号楼');
  await page.click('button:has-text("确认添加")');
  await expect(page.getByText('测试摄像头')).toBeVisible();
});
```

### 4.3 代码规范
```typescript
// 建议：统一的 API 响应格式
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
}

// 建议：统一错误处理
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

## ♿ 五、可访问性优化（A11y）

### 5.1 语义化 HTML
```typescript
// 建议：使用正确的语义标签
<main role="main">
  <header role="banner">
    <nav role="navigation" aria-label="主导航">
      <ul>
        <li><a href="/dashboard" aria-current="page">仪表盘</a></li>
      </ul>
    </nav>
  </header>
</main>

// 建议：为非语义元素添加角色
<div role="alert" aria-live="polite">
  {notification}
</div>
```

### 5.2 键盘导航
```typescript
// 建议：添加焦点管理
<div
  onKeyDown={(e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  }}
  tabIndex={0}
>
  可聚焦内容
</div>

// 建议：模态框焦点陷阱
import { FocusTrap } from 'focus-trap-react';

<FocusTrap>
  <Modal>
    <button aria-label="关闭">×</button>
  </Modal>
</FocusTrap>
```

### 5.3 ARIA 属性
```typescript
// 建议：为图标按钮添加标签
<button aria-label="删除摄像头">
  <Trash className="w-5 h-5" />
</button>

// 建议：进度条 ARIA
<div
  role="progressbar"
  aria-valuenow={65}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label="系统健康度"
>
  <div style={{ width: '65%' }} />
</div>

// 建议：数据表格标题
<table aria-label="告警列表">
  <thead>
    <tr>
      <th scope="col">时间</th>
      <th scope="col">类型</th>
    </tr>
  </thead>
</table>
```

## 📈 六、数据可视化优化

### 6.1 图表交互
```typescript
// 建议：添加图表工具提示
<ResponsiveContainer width="100%" height={300}>
  <AreaChart data={data}>
    <Tooltip
      contentStyle={{
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(6, 182, 212, 0.3)',
        borderRadius: '8px'
      }}
    />
    <Area
      type="monotone"
      dataKey="count"
      stroke="#06b6d4"
      fill="url(#gradient)"
    />
  </AreaChart>
</ResponsiveContainer>
```

### 6.2 实时数据优化
```typescript
// 建议：使用 SWR 进行数据获取和缓存
import useSWR from 'swr';

const { data, error, isLoading } = useSWR('/api/alerts', fetcher, {
  refreshInterval: 5000, // 5秒刷新
  revalidateOnFocus: true,
  dedupingInterval: 2000
});
```

### 6.3 数据导出
```typescript
// 建议：支持多种格式导出
export async function exportData(format: 'csv' | 'xlsx' | 'pdf') {
  const data = await fetchData();
  
  switch (format) {
    case 'csv':
      return exportToCSV(data);
    case 'xlsx':
      return exportToExcel(data);
    case 'pdf':
      return exportToPDF(data);
  }
}
```

## 🌐 七、国际化（i18n）

### 7.1 基础配置
```typescript
// 建议：使用 next-intl
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default
}));
```

### 7.2 组件国际化
```typescript
// 建议：提取可翻译文本
import { useTranslations } from 'next-intl';

export function AlertCard() {
  const t = useTranslations('Alert');
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
    </Card>
  );
}
```

## 🔄 八、状态管理优化

### 8.1 全局状态
```typescript
// 建议：使用 Context 分离关注点
const SystemContext = createContext<SystemState | null>(null);

export function SystemProvider({ children }) {
  const [state, dispatch] = useReducer(systemReducer, initialState);
  
  return (
    <SystemContext.Provider value={{ state, dispatch }}>
      {children}
    </SystemContext.Provider>
  );
}
```

### 8.2 表单状态
```typescript
// 建议：使用 React Hook Form
import { useForm } from 'react-hook-form';

export function AddCameraForm() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name', { required: true })} />
      {errors.name && <span>名称必填</span>}
      <button type="submit">提交</button>
    </form>
  );
}
```

## 📊 九、监控与日志

### 9.1 前端监控
```typescript
// 建议：集成 Sentry
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});

// 建议：自定义错误边界
Sentry.captureException(error, {
  extra: {
    componentStack: error.stack,
    userId: currentUser.id
  }
});
```

### 9.2 用户行为分析
```typescript
// 建议：埋点追踪
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  analytics.track(eventName, {
    ...properties,
    timestamp: Date.now(),
    page: router.pathname
  });
}

// 使用
trackEvent('camera_added', { cameraId: newCamera.id });
```

### 9.3 性能监控
```typescript
// 建议：监控关键指标
const observer = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    if (entry.entryType === 'navigation') {
      console.log('Page Load Time:', entry.loadEventEnd - entry.fetchStart);
    }
  });
});

observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });
```

## 🚀 十、部署与 CI/CD

### 10.1 构建优化
```typescript
// next.config.js 优化
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // 生产环境优化
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // 图片优化
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
  },
  
  // 实验性功能
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
  },
};

module.exports = nextConfig;
```

### 10.2 CI/CD 配置
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm ts-check
      - run: pnpm build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pnpm build
      - run: pnpm start
```

## 📋 实施优先级建议

### P0 - 紧急重要
1. ✅ 性能监控（Sentry）
2. ✅ 错误边界
3. 🔲 安全性加固（认证、输入验证）

### P1 - 重要不紧急
1. 🔲 可访问性优化
2. 🔲 测试覆盖率提升
3. 🔲 国际化准备

### P2 - 紧急不重要
1. ✅ 骨架屏（已在计划中）
2. 🔲 空状态优化
3. 🔲 交互反馈优化

### P3 - 不紧急不重要
1. 🔲 行为分析埋点
2. 🔲 高级图表功能
3. 🔲 国际化完整实现

## 🎯 成功指标

- **性能指标**
  - LCP < 2.5s
  - FID < 100ms
  - CLS < 0.1
  - 首屏加载 < 3s

- **质量指标**
  - 测试覆盖率 > 80%
  - Lighthouse 评分 > 90
  - 可访问性评分 > 95

- **业务指标**
  - 用户满意度 > 90%
  - 功能使用率 > 70%
  - 错误率 < 0.1%
