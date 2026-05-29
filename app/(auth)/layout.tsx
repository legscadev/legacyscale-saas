import { notFound } from 'next/navigation'

export default function AuthLayout({
  children: _children,
}: {
  children: React.ReactNode
}) {
  // Auth UI is temporarily disabled while sharing the landing page with
  // stakeholders. notFound() renders our root /not-found page (404) and
  // works during build prerender (a thrown Error would fail the build).
  // Re-enable by replacing this with the original Logo + container
  // layout (preserved in git history of 0.11).
  notFound()
}
