export default function AuthLayout({
  children: _children,
}: {
  children: React.ReactNode
}) {
  // Auth UI is temporarily disabled while sharing the landing page with
  // stakeholders. Throwing here triggers the root error boundary (500)
  // for any direct access to /login, /signup, /forgot-password, or
  // /reset-password. Re-enable by replacing the throw with the original
  // Logo + container layout (preserved in git history of 0.11).
  throw new Error('Authentication is temporarily disabled.')
}
