"use client"

import * as React from "react"
import * as ReactDOM from "react-dom"

export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  return mounted ? ReactDOM.createPortal(children, document.body) : null
}
