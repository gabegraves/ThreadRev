import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { ConsoleOverlay } from "@/components/shell/console-overlay";
import { MobileHeader } from "@/components/shell/mobile-header";
import { THEME_INIT } from "@/components/shell/theme-toggle";
import "@copilotkit/react-core/v2/styles.css";
import "./globals.css";

// Inter for everything readable, JetBrains Mono for ids, hashes, timestamps and
// micro-labels. No display serif: this is a data-dense review surface.
const sans = Inter({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: "ThreadRev — Review console",
  description: "The reviewed thread, its findings, and the evidence behind them.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the stored theme class before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="font-sans antialiased">
        <Providers>
          <div className="flex min-h-[calc(100dvh/var(--app-zoom,1))] flex-col bg-background text-foreground md:flex-row">
            <MobileHeader />
            {/* AppSidebar reads search params for sub-tab state; Suspense keeps the shell prerenderable. */}
            <Suspense fallback={null}>
              <AppSidebar />
            </Suspense>
            <main className="flex min-w-0 flex-1 flex-col">
              <div className="mx-auto flex w-full max-w-[1800px] flex-grow flex-col gap-5 px-3 pt-city-content pb-10 sm:px-4 lg:px-6">{children}</div>
            </main>
          </div>
          <ConsoleOverlay />
        </Providers>
      </body>
    </html>
  );
}
