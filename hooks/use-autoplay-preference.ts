'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'kondense.autoplay-next-lesson'
const DEFAULT_ENABLED = true

/**
 * Per-device preference for autoplaying the next lesson when a video
 * finishes. Backed by localStorage — quick, syncs nothing across
 * devices, which is the right default for a "playback behavior" pref.
 *
 * `ready` flips to `true` once the stored value has been read; UI
 * should align with the SSR-safe default until then to avoid a
 * hydration mismatch warning.
 */
export function useAutoplayPreference() {
  const [enabled, setEnabledState] = useState(DEFAULT_ENABLED)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored !== null) setEnabledState(stored === 'true')
    } catch {
      // localStorage can throw in private browsing modes — fall back
      // to the default and keep going.
    }
    setReady(true)
  }, [])

  const setEnabled = (value: boolean) => {
    setEnabledState(value)
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value))
    } catch {
      // ignore
    }
  }

  return { enabled, ready, setEnabled }
}
