'use client';

import { useState, useEffect } from 'react';

export type ScreenSize = 'mobile' | 'tablet' | 'desktop';

export function useScreenSize() {
  const [screenSize, setScreenSize] = useState<ScreenSize>('desktop');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      
      if (width < 768) {
        setScreenSize('mobile');
        setSidebarCollapsed(true);
      } else if (width < 1024) {
        setScreenSize('tablet');
        setSidebarCollapsed(true);
      } else {
        setScreenSize('desktop');
        setSidebarCollapsed(false);
      }
    };

    // 初始检查
    checkScreenSize();

    // 监听窗口大小变化
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  return { screenSize, sidebarCollapsed, setSidebarCollapsed };
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}
