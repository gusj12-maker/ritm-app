import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ритм",
  description: "Твой личный помощник",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        {/* Скрипт Телеграма */}
        <script src="https://telegram.org/js/telegram-web-app.js" async></script>
        {/* Отладчик для телефона */}
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script dangerouslySetInnerHTML={{ __html: `if (typeof window !== 'undefined') { window.eruda && window.eruda.init(); }` }} />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}