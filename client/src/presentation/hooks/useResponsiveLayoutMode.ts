import { useAppStore } from '@/core/services/store';
import { useMediaQuery } from './useMediaQuery';

export function useResponsiveLayoutMode() {
    const isDesktopModeOnMobile = useAppStore((state) => state.isDesktopModeOnMobile);
    const isActualMobile = useMediaQuery('(max-width: 768px)');
    const isSmallMobile = useMediaQuery('(max-width: 480px)');
    const isLandscapeMobile = useMediaQuery('(max-width: 1024px) and (orientation: landscape)');
    const isCompactMobileLayout = isActualMobile && !isDesktopModeOnMobile;

    return {
        isActualMobile,
        isSmallMobile,
        isLandscapeMobile,
        isDesktopModeOnMobile,
        isCompactMobileLayout,
    };
}
