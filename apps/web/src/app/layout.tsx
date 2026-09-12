import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { AppSidebar } from "@/components/shell/app-sidebar";
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
          <div className="flex min-h-dvh flex-col bg-background text-foreground md:flex-row">
            <MobileHeader />
            <AppSidebar />
            <main className="min-w-0 flex-1">
              <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
