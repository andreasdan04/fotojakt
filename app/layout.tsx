import type { Metadata, Viewport } from "next";
import "./globals.css";
import SeasonalTheme from './seasonal-theme';
import ColorTheme from './color-theme';
import {isPinkRibbonActive} from '@/lib/pink-ribbon';

export const metadata: Metadata = {
  title: "Foto Jakt – Venner og grupper",
  description: "Fotojakt med venner i private grupper. Finn motivet, ta et bilde og konkurrer om sesongseieren.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Foto Jakt", statusBarStyle: "default" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#19324e" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nb" suppressHydrationWarning>
      <body className="antialiased" data-pink-ribbon={String(isPinkRibbonActive())} suppressHydrationWarning><ColorTheme><SeasonalTheme/>{children}</ColorTheme></body>
    </html>
  );
}
