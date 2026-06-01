import { useState, useEffect } from "react"

export function useIsMobile(breakpoint = 1024) {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint)

    useEffect(() => {
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                setIsMobile(entry.contentRect.width < breakpoint)
            }
        })
        observer.observe(document.body)
        return () => observer.disconnect()
    }, [breakpoint])

    return isMobile
}