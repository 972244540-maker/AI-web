import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI 疗愈助手',
  description: '帮助大学生缓解焦虑的AI伙伴',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
