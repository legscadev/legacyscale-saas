"use client"

import { useEffect, useState } from "react"

interface Parsed {
  prefix: string
  target: number
  suffix: string
  decimals: number
  commas: boolean
}

/** Splits "1,284" / "61%" / "$4.9k" into prefix, number, and suffix. */
function parse(value: string): Parsed | null {
  const m = value.match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/)
  if (!m) return null
  const raw = m[2]
  const numStr = raw.replace(/,/g, "")
  const target = parseFloat(numStr)
  if (Number.isNaN(target)) return null
  return {
    prefix: m[1],
    target,
    suffix: m[3],
    decimals: numStr.includes(".") ? numStr.split(".")[1].length : 0,
    commas: raw.includes(","),
  }
}

function format(n: number, p: Parsed): string {
  const num = p.commas
    ? Math.round(n).toLocaleString()
    : p.decimals > 0
      ? n.toFixed(p.decimals)
      : String(Math.round(n))
  return `${p.prefix}${num}${p.suffix}`
}

/** Animated number that counts up to its value on mount. */
export function CountUp({ value, duration = 900 }: { value: string; duration?: number }) {
  const [display, setDisplay] = useState(() => {
    const p = parse(value)
    return p ? format(0, p) : value
  })

  useEffect(() => {
    const p = parse(value)
    if (!p) {
      const id = requestAnimationFrame(() => setDisplay(value))
      return () => cancelAnimationFrame(id)
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) {
      const id = requestAnimationFrame(() => setDisplay(format(p.target, p)))
      return () => cancelAnimationFrame(id)
    }
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(format(p.target * eased, p))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <span className="tabular-nums">{display}</span>
}
