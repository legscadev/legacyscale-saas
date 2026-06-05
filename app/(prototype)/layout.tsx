import type { Metadata } from "next"

import { PrototypeNavigator } from "@/components/prototype/shell/prototype-navigator"

export const metadata: Metadata = {
  title: "Kondense — Product Prototype",
  description: "Clickable high-fidelity prototype of the Kondense platform.",
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
