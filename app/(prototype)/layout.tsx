import type { Metadata } from "next"

import { PrototypeNavigator } from "@/components/prototype/shell/prototype-navigator"

export const metadata: Metadata = {
  title: "Legacy Scale — Product Prototype",
  description: "Clickable high-fidelity prototype of the Legacy Scale platform.",
}

export default function PrototypeRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <PrototypeNavigator />
    </>
  )
}
