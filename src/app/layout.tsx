import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "PropertyHub — إدارة الأملاك والعقارات",
  description: "نظام متكامل لإدارة العقارات والوحدات والمستأجرين والعقود والمدفوعات والقيود المحاسبية",
  applicationName: "PropertyHub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
