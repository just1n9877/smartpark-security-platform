import { z } from 'zod';

// 摄像头验证 Schema
export const CameraSchema = z.object({
  name: z.string()
    .min(2, '名称至少2个字符')
    .max(50, '名称最多50个字符'),
  location: z.string()
    .min(2, '位置至少2个字符')
    .max(100, '位置最多100个字符'),
  area: z.enum(['entrance', 'lobby', 'parking', 'perimeter', 'public', 'office', 'dining', 'dormitory']),
  rtsp: z.string()
    .url('RTSP 地址格式不正确')
    .optional()
    .or(z.literal('')),
  status: z.enum(['online', 'warning', 'offline']).optional(),
});

// 用户验证 Schema
export const UserSchema = z.object({
  username: z.string()
    .min(3, '用户名至少3个字符')
    .max(20, '用户名最多20个字符')
    .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线'),
  email: z.string()
    .email('邮箱格式不正确'),
  password: z.string()
    .min(8, '密码至少8个字符')
    .regex(/[A-Z]/, '密码必须包含大写字母')
    .regex(/[a-z]/, '密码必须包含小写字母')
    .regex(/[0-9]/, '密码必须包含数字'),
  role: z.enum(['admin', 'operator', 'viewer']),
  phone: z.string()
    .regex(/^1[3-9]\d{9}$/, '手机号格式不正确')
    .optional(),
});

// 告警验证 Schema
export const AlertSchema = z.object({
  type: z.enum(['intrusion', 'face', 'fire', 'gather', 'other']),
  level: z.enum(['critical', 'warning', 'medium', 'low']),
  location: z.string().min(2).max(100),
  description: z.string()
    .min(5, '描述至少5个字符')
    .max(500, '描述最多500个字符'),
  status: z.enum(['pending', 'handling', 'resolved', 'falseAlarm']).optional(),
});

// 登录验证 Schema
export const LoginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

// 设备验证 Schema
export const DeviceSchema = z.object({
  name: z.string().min(2).max(50),
  type: z.enum(['server', 'storage', 'network', 'sensor']),
  ip: z.string()
    .refine((val) => {
      // 简单的 IP 地址验证
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(val)) return false;
      const parts = val.split('.');
      return parts.every(part => parseInt(part, 10) <= 255);
    }, 'IP 地址格式不正确')
    .optional(),
  location: z.string().max(100).optional(),
});

// 搜索验证 Schema
export const SearchSchema = z.object({
  keyword: z.string().min(1, '搜索关键词不能为空').max(100),
  type: z.enum(['all', 'cameras', 'alerts', 'users']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// 通用分页参数 Schema
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// 类型导出
export type CameraInput = z.infer<typeof CameraSchema>;
export type UserInput = z.infer<typeof UserSchema>;
export type AlertInput = z.infer<typeof AlertSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type DeviceInput = z.infer<typeof DeviceSchema>;
export type SearchInput = z.infer<typeof SearchSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
