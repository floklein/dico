import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Le jeu du Dico",
    template: "%s | Le jeu du Dico",
  },
  description: "Jeu multijoueur de définitions et de bluff en français.",
  applicationName: "Le jeu du Dico",
  keywords: [
    "jeu multijoueur",
    "dictionnaire",
    "définitions",
    "bluff",
    "jeu de mots",
    "français",
  ],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Le jeu du Dico",
    title: "Le jeu du Dico",
    description: "Jeu multijoueur de définitions et de bluff en français.",
    url: "/",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Le jeu du Dico",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Le jeu du Dico",
    description: "Jeu multijoueur de définitions et de bluff en français.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
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
