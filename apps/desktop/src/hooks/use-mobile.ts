
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
    const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

    React.useEffect(() => {
        const mqlPortrait = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
        const mqlLandscape = window.matchMedia(`(pointer: coarse) and (max-height: 600px)`)

        const onChange = () => {
            const isPortraitMobile = window.innerWidth < MOBILE_BREAKPOINT
            const isLandscapeMobile = window.matchMedia("(pointer: coarse)").matches && window.innerHeight < 600
            setIsMobile(isPortraitMobile || isLandscapeMobile)
        }

        mqlPortrait.addEventListener("change", onChange)
        mqlLandscape.addEventListener("change", onChange)

        // Initial check
        onChange()

        return () => {
            mqlPortrait.removeEventListener("change", onChange)
            mqlLandscape.removeEventListener("change", onChange)
        }
    }, [])

    return !!isMobile
}
