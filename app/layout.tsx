import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartGrid Command Center",
  description: "AI-powered San Francisco urban power-grid command center"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
