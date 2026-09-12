import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";
import "@copilotkit/react-core/v2/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Incident assistant — Agents, Everywhere",
  description: "Pick an incident, ask your assistant, and add a follow-up.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The boot script below stamps `class="dark"` on this element before React
    // hydrates, so the server markup and the client DOM legitimately disagree
    // for one attribute. Suppressing the warning here is the intended escape
    // hatch; it does not extend to children.
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Spline+Sans+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* Must run before first paint, so it is inline in <head> rather than
            a next/script — anything deferred paints the wrong theme first. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
