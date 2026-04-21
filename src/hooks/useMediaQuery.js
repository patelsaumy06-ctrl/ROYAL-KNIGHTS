import { useState, useEffect } from 'react';

const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1280,
};

/**
 * Responsive breakpoint hook.
 * Returns { isMobile, isTablet, isDesktop } so components can
 * conditionally adjust their inline styles.
 *
 * - isMobile:  width < 768
 * - isTablet:  768 <= width < 1024
 * - isDesktop: width >= 1024
 */
export function useMediaQuery() {
  const getState = () => {
    const w = window.innerWidth;
    return {
      isMobile: w < BREAKPOINTS.mobile,
      isTablet: w >= BREAKPOINTS.mobile && w < BREAKPOINTS.tablet,
      isDesktop: w >= BREAKPOINTS.tablet,
    };
  };

  const [state, setState] = useState(getState);

  useEffect(() => {
    const handleResize = () => setState(getState());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return state;
}
