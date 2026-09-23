import type { Metadata } from "next";
import "./globals.css";
import "./refinement.css";
export const metadata: Metadata = {
  title: "GhostForms — Dê forma ao desconhecido",
  description: "Crie formulários e descubra novas respostas.",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/ghost.png", apple: "/brand/ghost.png" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
