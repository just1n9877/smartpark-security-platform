'use client';

import { useEffect } from 'react';
import type { Metric } from 'web-vitals';

interface WebVitalsMetric {
  name: string;
  value: number;
  delta: number;
  id: string;
  entries: PerformanceEntry[];
}

export function WebVitalsMonitor() {
  useEffect(() => {
    // 动态导入 web-vitals
    const reportWebVitals = async (onPerfEntry?: (metric: WebVitalsMetric) => void) => {
      if (onPerfEntry && onPerfEntry instanceof Function) {
        try {
          const webVitals = await import('web-vitals');
          
          // 使用 onCLS
          if (webVitals.onCLS) {
            webVitals.onCLS((metric: Metric) => {
              console.log('🔵 CLS:', metric);
              onPerfEntry(metric);
            });
          }
          
          // 使用 onINP (Interaction to Next Paint, 替代 FID)
          if (webVitals.onINP) {
            webVitals.onINP((metric: Metric) => {
              console.log('🟢 INP:', metric);
              onPerfEntry(metric);
            });
          }
          
          // 使用 onLCP
          if (webVitals.onLCP) {
            webVitals.onLCP((metric: Metric) => {
              console.log('🟡 LCP:', metric);
              onPerfEntry(metric);
            });
          }
          
          // 使用 onFCP
          if (webVitals.onFCP) {
            webVitals.onFCP((metric: Metric) => {
              console.log('⚪ FCP:', metric);
              onPerfEntry(metric);
            });
          }
          
          // 使用 onTTFB
          if (webVitals.onTTFB) {
            webVitals.onTTFB((metric: Metric) => {
              console.log('🔴 TTFB:', metric);
              onPerfEntry(metric);
            });
          }
        } catch (error) {
          console.warn('Failed to load web-vitals:', error);
        }
      }
    };

    // 上报到分析服务
    const handleWebVitals = (metric: WebVitalsMetric) => {
      // 发送到分析服务（如 Vercel Analytics、自定义服务等）
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        delta: metric.delta,
        id: metric.id,
        timestamp: Date.now(),
      });

      // 使用 sendBeacon 发送数据（不阻塞页面卸载）
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics', body);
      }

      // 性能分级
      const performanceLevel = getPerformanceLevel(metric.name, metric.value);
      console.log(`📊 ${metric.name}: ${metric.value.toFixed(2)} ${performanceLevel}`);
    };

    reportWebVitals(handleWebVitals);
  }, []);

  return null;
}

// 性能等级判断
function getPerformanceLevel(name: string, value: number): string {
  const thresholds: Record<string, { good: number; needsImprovement: number }> = {
    CLS: { good: 0.1, needsImprovement: 0.25 },
    FID: { good: 100, needsImprovement: 300 },
    LCP: { good: 2500, needsImprovement: 4000 },
    FCP: { good: 1800, needsImprovement: 3000 },
    TTFB: { good: 800, needsImprovement: 1800 },
  };

  const threshold = thresholds[name];
  if (!threshold) return '';

  if (value <= threshold.good) return '✅ 优秀';
  if (value <= threshold.needsImprovement) return '⚠️ 需改进';
  return '❌ 较差';
}

// 单独的性能指标收集 Hook
export function usePerformanceMetrics() {
  useEffect(() => {
    // 收集 Navigation Timing
    const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigationTiming) {
      console.log('🕐 Navigation Timing:', {
        dns: navigationTiming.domainLookupEnd - navigationTiming.domainLookupStart,
        tcp: navigationTiming.connectEnd - navigationTiming.connectStart,
        ttfb: navigationTiming.responseStart - navigationTiming.requestStart,
        download: navigationTiming.responseEnd - navigationTiming.responseStart,
        total: navigationTiming.loadEventEnd - navigationTiming.startTime,
      });
    }

    // 收集 Resource Timing
    const resourceTiming = performance.getEntriesByType('resource');
    const slowResources = resourceTiming.filter(
      (resource) => (resource as PerformanceResourceTiming).transferSize && 
      (resource as PerformanceResourceTiming).duration > 1000
    );

    if (slowResources.length > 0) {
      console.warn('⚠️ 慢资源:', slowResources.map(r => ({
        name: r.name,
        duration: (r as PerformanceResourceTiming).duration.toFixed(2) + 'ms',
      })));
    }
  }, []);
}
