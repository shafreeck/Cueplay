import { useEffect } from 'react';

/**
 * Enhanced Spatial Navigation for TV Remote Control.
 * Handles Arrow keys to move focus spatially.
 * Prioritizes active Dialogs/Modals to prevent focus escape.
 */
export function useTVNavigation() {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // only handle arrow keys
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

            // Ignore if focus is in an input/textarea (native editing)
            // UNLESS the input is read-only or we drastically need to escape
            const activeElement = document.activeElement as HTMLElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
                // Allow simple left/right to move cursor inside input, so usually we return.
                // But for Up/Down we might want to navigate away? 
                // For now, let's stick to standard behavior: if input is focused, let it handle arrows.
                return;
            }

            console.log('[TV-Nav] Key:', e.key, 'Active:', activeElement);

            // 1. Determine Scope: active Dialog or Body
            // Radix UI often uses role="dialog" or id starting with "radix-"
            let container: Document | Element = document;

            // Try to find the top-most active modal/dialog
            const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [data-state="open"].fixed'));
            // Filter only visible dialogs
            const activeDialog = dialogs.reverse().find(d => {
                const style = window.getComputedStyle(d);
                return style.display !== 'none' && style.visibility !== 'hidden' && style.pointerEvents !== 'none';
            });

            if (activeDialog) {
                container = activeDialog;
                console.log('[TV-Nav] Scoping to Dialog:', activeDialog);
            }

            // 2. Find Candidates
            const selector = 'a, button, input, textarea, [tabindex]:not([tabindex="-1"])';
            const allElements = Array.from(container.querySelectorAll(selector)) as HTMLElement[];

            const candidates = allElements.filter(el => {
                const rect = el.getBoundingClientRect();
                // Must be visible and in viewport (or at least have size)
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 &&
                    style.visibility !== 'hidden' &&
                    style.display !== 'none' &&
                    !el.hasAttribute('disabled');
            });

            if (candidates.length === 0) return;

            // Stop default scrolling
            e.preventDefault();
            e.stopPropagation();

            // If nothing focused (within our scope), focus the first one
            if (!activeElement || !container.contains(activeElement) || activeElement === document.body) {
                candidates[0].focus();
                console.log('[TV-Nav] Initial focus to:', candidates[0]);
                return;
            }

            // 3. Calculate Best Candidate
            const currentRect = activeElement.getBoundingClientRect();
            const currentCenter = {
                x: currentRect.left + currentRect.width / 2,
                y: currentRect.top + currentRect.height / 2
            };

            let bestCandidate: HTMLElement | null = null;
            let minDistance = Infinity;

            // Heuristic weights to prefer "straight line" vs "diagonal"
            // We punish misalignment in the non-travel axis
            const ALIGNMENT_WEIGHT = 3;

            candidates.forEach(el => {
                if (el === activeElement) return;

                const rect = el.getBoundingClientRect();
                const center = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                };

                let isValidDirection = false;
                let mainAxisDist = 0;
                let crossAxisDist = 0;

                switch (e.key) {
                    case 'ArrowUp':
                        isValidDirection = center.y < currentCenter.y; // Target is above
                        if (isValidDirection) {
                            mainAxisDist = currentCenter.y - center.y;
                            crossAxisDist = Math.abs(center.x - currentCenter.x);
                        }
                        break;
                    case 'ArrowDown':
                        isValidDirection = center.y > currentCenter.y; // Target is below
                        if (isValidDirection) {
                            mainAxisDist = center.y - currentCenter.y;
                            crossAxisDist = Math.abs(center.x - currentCenter.x);
                        }
                        break;
                    case 'ArrowLeft':
                        isValidDirection = center.x < currentCenter.x; // Target is left
                        if (isValidDirection) {
                            mainAxisDist = currentCenter.x - center.x;
                            crossAxisDist = Math.abs(center.y - currentCenter.y);
                        }
                        break;
                    case 'ArrowRight':
                        isValidDirection = center.x > currentCenter.x; // Target is right
                        if (isValidDirection) {
                            mainAxisDist = center.x - currentCenter.x;
                            crossAxisDist = Math.abs(center.y - currentCenter.y);
                        }
                        break;
                }

                if (isValidDirection) {
                    // We require some reasonable overlap or proximity?
                    // Actually, just pure distance with penalty for cross-axis is best for general grids.
                    const score = mainAxisDist + (crossAxisDist * ALIGNMENT_WEIGHT);

                    if (score < minDistance) {
                        minDistance = score;
                        bestCandidate = el;
                    }
                }
            });

            if (bestCandidate) {
                (bestCandidate as HTMLElement).focus();
                console.log('[TV-Nav] Jump to:', bestCandidate);
            } else {
                console.log('[TV-Nav] No candidate found');
            }
        };

        // Use Capture phase to intercept before Shadcn/Radix traps
        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, []);
}
