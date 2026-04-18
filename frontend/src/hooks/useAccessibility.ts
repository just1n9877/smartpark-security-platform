'use client';

import { useCallback, useRef, useEffect } from 'react';

interface FocusTrapOptions {
  initialFocus?: boolean;
  returnFocus?: boolean;
  escapeExits?: string[];
}

// 焦点陷阱 Hook
export function useFocusTrap(options: FocusTrapOptions = {}) {
  const { initialFocus = true, returnFocus = true, escapeExits = ['Escape'] } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // 获取所有可聚焦元素
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    
    const focusableSelectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ];

    return Array.from(
      containerRef.current.querySelectorAll(focusableSelectors.join(','))
    ) as HTMLElement[];
  }, []);

  // 焦点移到第一个元素
  const focusFirstElement = useCallback(() => {
    const focusable = getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  }, [getFocusableElements]);

  // 焦点移到最后一个元素
  const focusLastElement = useCallback(() => {
    const focusable = getFocusableElements();
    if (focusable.length > 0) {
      focusable[focusable.length - 1].focus();
    }
  }, [getFocusableElements]);

  // 处理键盘事件
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const focusable = getFocusableElements();
    if (focusable.length === 0) return;

    // Tab 键循环焦点
    if (e.key === 'Tab') {
      const focusedElement = document.activeElement as HTMLElement;
      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (focusedElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (focusedElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }

    // Escape 键关闭
    if (escapeExits.includes(e.key)) {
      e.preventDefault();
      // 触发关闭回调
      const closeButton = containerRef.current?.querySelector('[data-close-modal]') as HTMLElement;
      closeButton?.click();
    }
  }, [getFocusableElements, escapeExits]);

  useEffect(() => {
    if (!containerRef.current) return;

    // 保存之前的焦点
    if (returnFocus) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }

    // 设置初始焦点
    if (initialFocus) {
      setTimeout(focusFirstElement, 0);
    }

    // 添加键盘事件监听
    const container = containerRef.current;
    container.addEventListener('keydown', handleKeyDown);

    // 清理
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      
      // 恢复之前的焦点
      if (returnFocus && previousFocusRef.current) {
        setTimeout(() => {
          previousFocusRef.current?.focus();
        }, 0);
      }
    };
  }, [initialFocus, returnFocus, escapeExits, focusFirstElement, handleKeyDown]);

  return { containerRef, focusFirstElement, focusLastElement };
}

// 快捷键 Hook
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean } = {}
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const modifiersMatch = 
        (!options.ctrl || e.ctrlKey) &&
        (!options.alt || e.altKey) &&
        (!options.shift || e.shiftKey) &&
        (!options.meta || e.metaKey);

      if (e.key.toLowerCase() === key.toLowerCase() && modifiersMatch) {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, callback, options]);
}

// 屏幕阅读器 announcer
export function useAnnouncer() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', priority);
    announcer.setAttribute('aria-atomic', 'true');
    announcer.setAttribute('class', 'sr-only');
    announcer.textContent = message;
    
    document.body.appendChild(announcer);
    
    setTimeout(() => {
      document.body.removeChild(announcer);
    }, 1000);
  }, []);

  return { announce };
}

// 元素可见性检测
export function useIntersectionObserver(
  callback: (isVisible: boolean) => void,
  options: IntersectionObserverInit = {}
) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      callback(entry.isIntersecting);
    }, options);

    observer.observe(element);

    return () => observer.disconnect();
  }, [callback, options]);

  return ref;
}

// ARIA 属性工具
export const aria = {
  // 按钮
  button: (label?: string) => ({
    role: 'button',
    'aria-label': label,
  }),

  // 标签
  label: (id: string) => ({
    id,
  }),

  // 输入框
  input: (id: string, label: string, invalid?: string) => ({
    id,
    'aria-labelledby': `${id}-label`,
    'aria-describedby': invalid ? `${id}-error` : undefined,
    'aria-invalid': invalid ? true : undefined,
  }),

  // 列表
  list: (label?: string) => ({
    role: 'list',
    'aria-label': label,
  }),

  // 列表项
  listItem: () => ({
    role: 'listitem',
  }),

  // 进度条
  progressBar: (value: number, min = 0, max = 100, label?: string) => ({
    role: 'progressbar',
    'aria-valuenow': value,
    'aria-valuemin': min,
    'aria-valuemax': max,
    'aria-label': label,
  }),

  // 警报
  alert: (live: 'polite' | 'assertive' = 'polite') => ({
    role: 'alert',
    'aria-live': live,
  }),

  // 表格
  table: (caption?: string) => ({
    role: 'table',
    'aria-label': caption,
  }),

  // 网格
  grid: (label?: string) => ({
    role: 'grid',
    'aria-label': label,
  }),

  // 对话框
  dialog: (title: string, describedBy?: string) => ({
    role: 'dialog',
    'aria-labelledby': `${title}-title`,
    'aria-describedby': describedBy,
  }),

  // 模态框
  modal: (title: string) => ({
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': `${title}-title`,
  }),

  // 导航
  navigation: (label?: string) => ({
    role: 'navigation',
    'aria-label': label,
  }),

  // 主要内容
  main: () => ({
    role: 'main',
  }),

  // 页眉
  banner: () => ({
    role: 'banner',
  }),

  // 内容信息
  contentInfo: () => ({
    role: 'contentinfo',
  }),
};
