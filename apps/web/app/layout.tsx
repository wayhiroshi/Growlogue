import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Growlogue",
    template: "%s | Growlogue"
  },
  description: "今日の行動を、成長物語へ。",
  applicationName: "Growlogue",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Growlogue"
  }
};

export const viewport: Viewport = {
  themeColor: "#173f35",
  colorScheme: "light"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
