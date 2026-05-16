import { useState, useEffect, useCallback, useRef } from 'react'

export default function useResizable(defaultWidth, options = {}) {
  const { min = 100, max = 600, side = 'right', storageKey } = options

  // Load saved width from localStorage
  const [width, setWidth] = useState(() => {
    if (!storageKey) return defaultWidth
    try { const v = localStorage.getItem(storageKey); if (v) return parseInt(v) || defaultWidth }
    catch { return defaultWidth }
    return defaultWidth
  })

  const [dragging, setDragging] = useState(false)
  const startRef = useRef({ x: 0, w: 0 })

  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    startRef.current = { x: e.clientX, w: width }
    setDragging(true)
  }, [width])

  // Persist on drag end
  useEffect(() => {
    if (!dragging && storageKey) {
      try { localStorage.setItem(storageKey, String(width)) } catch {}
    }
  }, [dragging])

  useEffect(() => {
    if (!dragging) return
    function onMove(e) {
      const delta = e.clientX - startRef.current.x
      const newW = side === 'left'
        ? startRef.current.w - delta  // drag left = panel grows
        : startRef.current.w + delta  // drag right = panel grows
      setWidth(Math.min(max, Math.max(min, newW)))
    }
    function onUp() { setDragging(false) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, min, max, side])

  return { width, dragging, onMouseDown }
}
