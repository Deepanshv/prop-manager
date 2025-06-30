
import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * A hook to determine if the current device is mobile based on screen width.
 * This hook is safe for server-side rendering (SSR) environments like Next.js.
 * It initially returns `false` on the server and during the initial client render,
 * then updates to the correct value after the component has mounted on the client.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    // This effect only runs on the client, after the initial render.
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    
    // Set the state to the actual value on the client.
    setIsMobile(mql.matches)

    const onChange = () => {
      setIsMobile(mql.matches)
    }

    mql.addEventListener("change", onChange)

    return () => {
      mql.removeEventListener("change", onChange)
    }
  }, [])

  return isMobile
}
