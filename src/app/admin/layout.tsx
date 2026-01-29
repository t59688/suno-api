import type { Metadata } from "next";
import MainLayout from "./components/MainLayout";

export const metadata: Metadata = {
  title: "账号池管理 - Suno API",
  description: "Suno API 账号池管理系统",
};

/**
 * 管理后台根布局
 * 不使用主站的 Header 和 Footer
 */
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 直接返回 children，不包裹 MainLayout
  return <>{children}</>;
}
