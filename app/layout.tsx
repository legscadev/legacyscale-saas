import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getBranding } from "@/lib/branding/get-branding"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

// Dynamic metadata so the browser tab title + favicon reflect the
// caller's active tenant. Falls back to the Kondense platform
// defaults when tenancy is off, when there's no signed-in caller, or
// when a tenant hasn't set its own brand. Cached per request through
// `getBranding()`.
export async function generateMetadata(): Promise<Metadata> {
  const b = await getBranding()
  return {
    title: b.productName,
    description: b.tagline ?? b.productName,
    icons: { icon: b.faviconUrl },
  }
}

// Runs before React hydration. Reads the persisted theme and applies
// the `dark` class so the first paint matches the user's preference
// (no flash). Defaults to dark when no preference is stored.
const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    if (t !== 'light' && t !== 'dark') t = 'dark';
    document.documentElement.classList.toggle('dark', t === 'dark');
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.variable
        )}
      >
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  )
}
