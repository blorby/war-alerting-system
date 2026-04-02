import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LocaleHtmlAttrs } from "@/components/layout/LocaleHtmlAttrs";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "War Alerting System",
  description:
    "Live OSINT-powered situational awareness dashboard — tracking events in real time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${inter.variable} dark h-full antialiased`}>
      <head>
        <LocaleHtmlAttrs />
      </head>
      <body className="h-full overflow-hidden bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
