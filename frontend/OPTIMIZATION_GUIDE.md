# 前端优化建议

这份文档记录 SmartGuard AI 前端后续可以继续优化的方向。它不是当前功能承诺，而是维护和迭代时的参考清单。实际开发时应优先解决影响演示、验收和线上稳定性的问题。

## 一、优先级建议

| 优先级 | 方向 | 原因 |
|------|------|------|
| P0 | 错误边界、接口失败提示、登录态处理 | 直接影响用户是否能继续操作 |
| P1 | 加载状态、空状态、表单校验 | 提升演示完整度和日常可用性 |
| P1 | 可访问性和键盘关闭弹窗 | 提升交互质量，减少误操作 |
| P2 | 性能监控、埋点、图表增强 | 适合线上稳定运行后继续补充 |
| P3 | 国际化、复杂导出、完整 CI/CD | 视后续交付要求决定 |

## 二、性能优化

### 1. 首屏资源

登录页和仪表盘是用户最先看到的页面，应控制首屏资源体积。图片类资源建议使用 `next/image`，非首屏图表可以延后加载。

```tsx
import Image from 'next/image';

<Image
  src="/camera-preview.jpg"
  alt="摄像头预览"
  width={640}
  height={360}
  priority
/>
```

### 2. 组件懒加载

数据分析页图表较多，可以对非首屏图表做动态导入，减少首次进入页面的压力。

```tsx
const AnalyticsChart = dynamic(() => import('@/components/charts/Analytics'), {
  loading: () => <Skeleton />,
  ssr: false,
});
```

### 3. 数据刷新

已有页面使用 SWR。实时性要求高的页面可以设置刷新间隔，但不要所有页面都高频轮询。

```tsx
const { data, isLoading } = useSWR('/dashboard/summary', fetcher, {
  refreshInterval: 8000,
  revalidateOnFocus: true,
});
```

## 三、体验优化

### 1. 加载状态

列表和图表加载时，优先使用骨架屏或局部 loading，不要让整页空白。

```tsx
<div className="animate-pulse space-y-2">
  <div className="h-3 bg-slate-700 rounded w-full" />
  <div className="h-3 bg-slate-700 rounded w-2/3" />
</div>
```

### 2. 空状态

摄像头、告警、任务、人脸人员库都应有清楚的空状态，告诉用户下一步能做什么。

```tsx
<EmptyState
  icon={Camera}
  title="暂无摄像头"
  description="点击添加摄像头，开始配置监控点位。"
/>
```

### 3. 错误提示

接口失败时要区分常见原因：

- 未登录或 token 过期：引导回登录页
- 后端未启动：提示检查 `8000`
- CORS 问题：提示检查后端 `CORS_ORIGINS`
- 数据为空：不要当成错误

### 4. 弹窗交互

新增弹窗时建议同时支持：

- 右上角关闭按钮
- 点击遮罩关闭
- Esc 关闭
- 提交中禁用按钮

实时监控放大、忘记密码提示等交互可以沿用这一规则。

## 四、安全与校验

### 1. Token 使用

Token 读取、写入、清理逻辑应统一放在 API 工具层，避免页面里重复操作 localStorage。

### 2. 表单校验

摄像头、人员、人脸上传和规则配置建议逐步补充前端校验，避免无效请求进入后端。

```ts
const cameraSchema = z.object({
  name: z.string().min(1),
  rtsp_url: z.string().optional(),
  risk_level: z.number().min(1).max(5),
});
```

### 3. 日志脱敏

前端调试日志不要输出密码、完整 token、身份证号或其他敏感字段。

## 五、代码质量

### 1. 类型检查

提交前建议运行：

```bash
npm run ts-check
npm run lint
```

类型定义要尽量贴近后端响应。公共 API 类型优先放在 `src/lib/api.ts` 或专门的类型文件中。

### 2. 组件边界

页面负责组织数据和布局，复杂交互可以下沉为组件。不要为了单次使用过度抽象，但重复出现的卡片、空状态、弹窗可以统一。

### 3. 测试建议

后续可以补：

- 登录和注册流程测试
- 告警反馈流程测试
- 摄像头添加流程测试
- 系统设置阈值修改测试

E2E 测试可考虑 Playwright。

## 六、可访问性

建议逐步补齐：

- 图标按钮增加 `aria-label`
- 表单输入框有清楚的 placeholder 或 label
- 弹窗打开后焦点不丢失
- Esc 可以关闭弹窗
- 告警颜色之外再提供文字等级

这些优化不影响主流程，但会明显提升完成度。

## 七、图表和数据分析

数据分析页可以继续增强：

- 图表 tooltip 统一样式
- 空数据时显示说明
- 支持按摄像头、时间范围过滤
- 支持导出 CSV 或报告
- Holdout 评测结果展示更多解释字段

注意：图表数据必须来自后端真实 API 或明确标注为演示数据，不能混用。

## 八、部署与运维

线上部署建议固定一套流程：

```bash
git pull origin main
cd frontend
npm install
npm run build
pm2 restart smartpark
```

常见问题：

- 构建失败 `EACCES`：检查 `.next` 目录权限。
- 构建成功但页面没变：检查 PM2 是否重启、Nginx 是否指向正确端口。
- 公网登录失败：检查后端 `CORS_ORIGINS` 和前端 API 地址。

## 九、当前建议落地顺序

1. 保证登录、注册、忘记密码提示和 token 过期处理稳定。
2. 保证监控、告警、数据分析、系统设置页面都有可读的空状态和错误状态。
3. 为主要表单补前端校验。
4. 为关键弹窗补齐 Esc 和焦点体验。
5. 再考虑埋点、导出、国际化和自动化测试。
