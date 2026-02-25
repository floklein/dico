import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Le jeu du Dico",
  description: "Jeu multijoueur de définitions et de bluff en français.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
