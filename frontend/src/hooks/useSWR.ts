import { useState } from 'react';
import useSWR, { SWRConfiguration, Key } from 'swr';

type FetchError = Error & { status?: number };
type JsonObject = Record<string, unknown>;

// 统一的 fetcher
const fetcher = async (url: string) => {
  const res = await fetch(url);
  
  if (!res.ok) {
    const error: FetchError = new Error('An error occurred while fetching the data.');
    error.status = res.status;
    throw error;
  }
  
  return res.json();
};

// 基础 SWR Hook
export function useFetch<T = unknown>(
  key: Key,
  options?: SWRConfiguration<T>
) {
  return useSWR<T>(key, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 2000,
    ...options,
  });
}

// 实时数据 SWR Hook（自动轮询）
export function useRealtimeData<T = unknown>(
  key: Key,
  refreshInterval = 5000,
  options?: SWRConfiguration<T>
) {
  return useSWR<T>(key, fetcher, {
    refreshInterval,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    ...options,
  });
}

// 摄像头数据 Hook
export function useCameras() {
  return useRealtimeData('/api/cameras', 10000); // 10秒刷新
}

// 告警数据 Hook
export function useAlerts(filter?: { level?: string; status?: string }) {
  const key = filter 
    ? `/api/alerts?${new URLSearchParams(filter).toString()}`
    : '/api/alerts';
  
  return useRealtimeData(key, 5000); // 5秒刷新
}

// 用户数据 Hook
export function useUsers(page = 1, limit = 20) {
  return useFetch(`/api/users?page=${page}&limit=${limit}`);
}

// 统计数据 Hook
export function useStatistics() {
  return useRealtimeData('/api/statistics', 30000); // 30秒刷新
}

// 设备数据 Hook
export function useDevices() {
  return useFetch('/api/devices');
}

// 搜索 Hook
export function useSearch(keyword: string, type = 'all') {
  return useFetch(
    keyword ? `/api/search?q=${keyword}&type=${type}` : null,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );
}

// 分页数据接口
interface PaginationData<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 分页 Hook
export function usePaginatedData<T = unknown>(
  endpoint: string,
  options?: SWRConfiguration<PaginationData<T>> & { page?: number; limit?: number }
) {
  const { page = 1, limit = 20, ...swrOptions } = options || {};
  const { data, error, isLoading, mutate } = useSWR<PaginationData<T>>(
    `${endpoint}?page=${page}&limit=${limit}`,
    fetcher,
    swrOptions
  );

  return {
    data: data?.data || ([] as T[]),
    pagination: data?.pagination,
    isLoading,
    isError: error,
    mutate,
    setPage: (newPage: number) => {
      console.log('Page changed to:', newPage);
    },
  };
}

// 乐观更新 Hook
export function useOptimisticUpdate<T = unknown>(key: Key) {
  const { data, mutate } = useFetch<T>(key);

  const optimisticUpdate = async (
    updateFn: (data: T | undefined) => T,
    rollbackFn?: () => void
  ) => {
    // 保存旧数据
    const oldData = data;

    // 乐观更新
    await mutate(updateFn(data), false);

    try {
      // 发送请求
      // await sendUpdate();
      
      // 重新验证
      await mutate();
    } catch (err) {
      // 回滚
      await mutate(oldData, false);
      rollbackFn?.();
      throw err;
    }
  };

  return { data, optimisticUpdate };
}

// 表单提交 Hook
export function useFormSubmit<T = unknown>(
  endpoint: string,
  options?: {
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  }
) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (formData: JsonObject) => {
    setIsSubmitting(true);
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('提交失败');
      }

      const result = (await response.json()) as T;
      options?.onSuccess?.(result);
      return result;
    } catch (err) {
      const error = err as Error;
      options?.onError?.(error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { submit, isSubmitting };
}

// 错误处理 Hook
export function useErrorHandler() {
  const handleError = (error: unknown) => {
    console.error('Error:', error);
    const fetchError = error as FetchError;
    
    // 根据错误类型显示不同的消息
    if (fetchError.status === 401) {
      // 未授权，跳转登录
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } else if (fetchError.status === 403) {
      // 权限不足
      console.error('权限不足');
    } else if (fetchError.status === 404) {
      // 资源不存在
      console.error('资源不存在');
    } else {
      // 其他错误
      console.error(fetchError.message || '发生错误');
    }
  };

  return { handleError };
}

// 数据预取 Hook
export function usePrefetch(keys: Key[]) {
  const prefetch = async () => {
    for (const key of keys) {
      if (key) {
        await fetcher(key as string);
      }
    }
  };

  return { prefetch };
}
