import type { Metadata } from "next";

import "./globals.css";

import { cn } from "@/lib/utils";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { ActiveThemeProvider } from "@/components/active-theme";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Dono Utilities",
  description:
    "A fully responsive analytics dashboard featuring dynamic charts, interactive tables, a collapsible sidebar, and a light/dark mode theme switcher. Built with modern web technologies, it ensures seamless performance across devices, offering an intuitive user interface for data visualization and exploration.",
  icons: {
    icon: "/siteicon.png",
    apple: "/siteicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "bg-background overscroll-none font-sans antialiased",
          "theme-blue-scaled",
          "theme-scaled"
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          enableColorScheme
        >
          <ActiveThemeProvider initialTheme="blue-scaled">
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
          </ActiveThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

