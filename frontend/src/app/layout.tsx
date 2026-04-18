import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import { ClientLayout } from '@/components/ClientLayout';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'SmartGuard AI | 智慧园区AI安防系统',
    template: '%s | SmartGuard AI',
  },
  description: '智慧园区AI安防系统 - 高端大气、安全可靠的管理平台',
  keywords: ['智慧园区', 'AI安防', '监控系统', '人脸识别', '智能安防'],
  authors: [{ name: 'SmartGuard Team' }],
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {isDev && <Inspector />}
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
