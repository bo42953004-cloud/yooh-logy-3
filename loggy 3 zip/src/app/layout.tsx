import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Code Studio & Spreadsheet",
  description:
    "A VS Code-style AI studio for HTML, CSS and JavaScript, plus an Excel-style spreadsheet that computes tasks without stopping.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
