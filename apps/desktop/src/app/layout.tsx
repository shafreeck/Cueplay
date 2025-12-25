import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import { I18nProvider } from "@/components/i18n-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cueplay Desktop",
  description: "Synchronized Playback Client",
};

export function generateViewport() {
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.className)}>
        <div data-tauri-drag-region className="fixed left-0 top-0 h-8 w-full z-50 bg-transparent" />

        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('touchstart', function(event) {
                if (event.touches.length > 1) {
                  event.preventDefault();
                }
              }, { passive: false });
              document.addEventListener('gesturestart', function(event) {
                event.preventDefault();
              }, { passive: false });
            `,
          }}
        />
        <div className="contents">
          <I18nProvider>
            {children}
          </I18nProvider>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
