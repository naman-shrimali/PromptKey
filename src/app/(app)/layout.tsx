import type { Metadata } from "next";
import "../globals.css";
import { Toaster } from "@/components/ui/sonner";
import { fontVariables } from "@/lib/fonts";
import { GlobalHeader } from "@/components/layout/global-header";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "PromptKey - Paste it. QR it. Share it.",
  description: "Long text in, tiny scannable link out — encrypted, no account needed.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className={`${fontVariables} antialiased font-sans bg-background text-foreground`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <GlobalHeader />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
