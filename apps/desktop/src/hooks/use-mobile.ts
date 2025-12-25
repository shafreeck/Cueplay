
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
    const [isMobile, setIsMobile] = React.useState<boolean>(false)
    const [isLandscapeMobile, setIsLandscapeMobile] = React.useState<boolean>(false)

    React.useEffect(() => {
        const mqlPortrait = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)

        const onChange = () => {
            // Using a slight delay or ensuring we get fresh values
            const width = window.innerWidth
            const height = window.innerHeight
            const isCoarse = window.matchMedia("(pointer: coarse)").matches

            const isPortraitMobile = width < MOBILE_BREAKPOINT
            const isLandscape = isCoarse &&
                height < 600 &&
                width > height

            setIsMobile(isPortraitMobile || isLandscape)
            setIsLandscapeMobile(isLandscape)
        }

        mqlPortrait.addEventListener("change", onChange)
        window.addEventListener("resize", onChange)
        window.addEventListener("orientationchange", onChange)

        // Initial check
        onChange()

        // Additional check after a short delay to catch late layout updates on some mobile browsers
        const timer = setTimeout(onChange, 100);

        return () => {
            mqlPortrait.removeEventListener("change", onChange)
            window.removeEventListener("resize", onChange)
            window.removeEventListener("orientationchange", onChange)
            clearTimeout(timer)
        }
    }, [])

    return { isMobile, isLandscapeMobile }
}
