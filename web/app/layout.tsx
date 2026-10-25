import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenHome",
  description: "聚合门禁与家电控制的设备控制台",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN"><body>{children}</body></html>
  );
}
