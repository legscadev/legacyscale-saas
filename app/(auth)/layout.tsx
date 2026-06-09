export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Subtle ambient atmosphere — barely-there brand blob in the
          corner so the page doesn't feel flat. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl dark:bg-brand-500/[0.1]"
      />

      <main className="relative w-full max-w-sm">{children}</main>
    </div>
  )
}
