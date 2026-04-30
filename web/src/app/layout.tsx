import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moodle AI",
  description: "Dashboard de tarefas Moodle Unisinos"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

