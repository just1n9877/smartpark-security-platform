import { NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';

// 统一 API 响应接口
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
  requestId?: string;
}

// 分页响应接口
export interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 生成请求 ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 创建成功响应
export function successResponse<T>(data: T, requestId?: string): NextResponse<ApiResponse<T>> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: Date.now(),
    requestId: requestId || generateRequestId(),
  };

  return NextResponse.json(response, { status: 200 });
}

// 创建创建成功响应（201）
export function createdResponse<T>(data: T, requestId?: string): NextResponse<ApiResponse<T>> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: Date.now(),
    requestId: requestId || generateRequestId(),
  };

  return NextResponse.json(response, { status: 201 });
}

// 创建分页响应
export function paginatedResponse<T>(
  data: T,
  pagination: { page: number; limit: number; total: number },
  requestId?: string
): NextResponse<PaginatedResponse<T>> {
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
    timestamp: Date.now(),
    requestId: requestId || generateRequestId(),
  };

  return NextResponse.json(response, { status: 200 });
}

// 错误代码枚举
export const ErrorCodes = {
  // 通用错误
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  
  // 业务错误
  CAMERA_NOT_FOUND: 'CAMERA_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  ALERT_NOT_FOUND: 'ALERT_NOT_FOUND',
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
  
  // 认证错误
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  
  // 业务规则错误
  CAMERA_ALREADY_EXISTS: 'CAMERA_ALREADY_EXISTS',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  MAX_CAMERAS_REACHED: 'MAX_CAMERAS_REACHED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// 创建错误响应
export function errorResponse(
  code: ErrorCode,
  message: string,
  details?: any,
  statusCode: number = 400,
  requestId?: string
): NextResponse<ApiResponse> {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    timestamp: Date.now(),
    requestId: requestId || generateRequestId(),
  };

  return NextResponse.json(response, { status: statusCode });
}

// 常用错误响应快捷方法
export const ApiErrors = {
  badRequest: (message: string, details?: any) => 
    errorResponse(ErrorCodes.BAD_REQUEST, message, details, 400),
  
  unauthorized: (message = '未授权访问') => 
    errorResponse(ErrorCodes.UNAUTHORIZED, message, undefined, 401),
  
  forbidden: (message = '权限不足') => 
    errorResponse(ErrorCodes.FORBIDDEN, message, undefined, 403),
  
  notFound: (resource: string) => 
    errorResponse(ErrorCodes.NOT_FOUND, `${resource} 不存在`, undefined, 404),
  
  internal: (message = '服务器内部错误') => 
    errorResponse(ErrorCodes.INTERNAL_ERROR, message, undefined, 500),
  
  validation: (errors: ZodError) => 
    errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      '数据验证失败',
      errors.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
      400
    ),
};

// 验证请求数据
export async function validateRequest<T>(
  schema: ZodSchema<T>,
  request: Request
): Promise<{ success: true; data: T } | { success: false; response: NextResponse<ApiResponse> }> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, response: ApiErrors.validation(error) };
    }
    return { success: false, response: ApiErrors.badRequest('无效的请求数据') };
  }
}

// 验证查询参数
export function validateQuery<T>(
  schema: ZodSchema<T>,
  params: URLSearchParams
): { success: true; data: T } | { success: false; response: NextResponse<ApiResponse> } {
  try {
    const data = schema.parse(Object.fromEntries(params));
    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, response: ApiErrors.validation(error) };
    }
    return { success: false, response: ApiErrors.badRequest('无效的查询参数') };
  }
}

// 日志工具（带脱敏）
export function logApiRequest(
  method: string,
  path: string,
  data?: any,
  userId?: string
) {
  const sanitizedData = sanitizeLogData(data);
  
  console.log(`[API] ${method} ${path}`, {
    ...sanitizedData,
    userId,
    timestamp: new Date().toISOString(),
  });
}

export function logApiError(
  method: string,
  path: string,
  error: any,
  userId?: string
) {
  console.error(`[API ERROR] ${method} ${path}`, {
    error: error.message || error,
    stack: error.stack,
    userId,
    timestamp: new Date().toISOString(),
  });
}

// 日志脱敏
function sanitizeLogData(data: any): any {
  if (!data) return data;
  
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];
  const sanitized = { ...data };
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}
