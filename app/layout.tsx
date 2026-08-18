import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { ProfileProvider } from "@/context/ProfileContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const THEME_BOOT = `(function(){try{var t=localStorage.getItem("coach-nutrition:theme");if(t==="dark"||(t!=="light"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Coach Nutrition",
  description: "Suivi nutrition, batchcooking et coaching pour Alexis & Élodie",
  applicationName: "Coach Nutrition",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Coach Nutrition",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F4F8" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Script id="theme-boot" strategy="beforeInteractive">
          {THEME_BOOT}
        </Script>
        <ThemeProvider>
          <ProfileProvider>
            <AppShell>{children}</AppShell>
          </ProfileProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
