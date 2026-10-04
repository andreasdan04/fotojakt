'use client';

import {useEffect} from 'react';
import {isPinkRibbonActive, PINK_RIBBON_START, PINK_RIBBON_END} from '@/lib/pink-ribbon';

export default function SeasonalTheme() {
  useEffect(() => {
    let boundaryTimer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(boundaryTimer);
      const now = Date.now();
      document.body.dataset.pinkRibbon = String(isPinkRibbonActive(now));
      const next = now < PINK_RIBBON_START ? PINK_RIBBON_START : PINK_RIBBON_END;
      if (next > now && next - now < 2147483647) boundaryTimer = setTimeout(update, next - now + 50);
    };
    update();
    const timer = setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => {
      clearInterval(timer);
      clearTimeout(boundaryTimer);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
    };
  }, []);
  return null;
}
