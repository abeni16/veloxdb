import { describe, expect, it } from 'vitest'

import { useSettings } from '@/lib/settings'

describe('maxQueryRows wiring', () => {
  it('settings default matches the backend MAX_QUERY_ROWS fallback', () => {
    // When maxRows is omitted from QueryRequest, the Rust backend
    // falls back to MAX_QUERY_ROWS = 1000. The Zustand settings default
    // must stay in sync so the UI-preferred value is honoured.
    expect(useSettings.getState().maxQueryRows).toBe(1000)
  })

  it('settings store allows custom maxQueryRows values', () => {
    const prev = useSettings.getState().maxQueryRows
    useSettings.setState({ maxQueryRows: 5000 })
    expect(useSettings.getState().maxQueryRows).toBe(5000)
    // Restore
    useSettings.setState({ maxQueryRows: prev })
  })
})
