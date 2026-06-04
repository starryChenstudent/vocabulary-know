import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useLocale } from './LocaleProvider';
import NavIcon from './NavIcon';
import {
  ADMIN_NAV_ROUTE,
  MOBILE_PRIMARY_NAV_ROUTES,
  MOBILE_SECONDARY_NAV_ROUTES,
  routeIsActive,
} from '../nav/navConfig';
import './MobileBottomNav.css';

interface MobileBottomNavProps {
  showAdmin: boolean;
}

export default function MobileBottomNav({ showAdmin }: MobileBottomNavProps) {
  const { t } = useLocale();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const secondaryRoutes = showAdmin
    ? [...MOBILE_SECONDARY_NAV_ROUTES, ADMIN_NAV_ROUTE]
    : MOBILE_SECONDARY_NAV_ROUTES;

  const moreActive = secondaryRoutes.some((item) => routeIsActive(pathname, item.to, item.end));

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreOpen]);

  return (
    <div ref={rootRef} className="mobile-bottom-nav-root">
      {moreOpen && (
        <>
          <div className="mobile-more-backdrop" aria-hidden onClick={() => setMoreOpen(false)} />
          <div className="mobile-more-sheet is-open" role="dialog" aria-label={t('nav.moreMenu')}>
            <div className="mobile-more-sheet__head">
              <h2 className="mobile-more-sheet__title">{t('nav.moreMenu')}</h2>
              <button
                type="button"
                className="mobile-more-sheet__close"
                onClick={() => setMoreOpen(false)}
                aria-label={t('common.close')}
              >
                ×
              </button>
            </div>
            <div className="mobile-more-sheet__grid">
              {secondaryRoutes.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `mobile-more-link${isActive ? ' active' : ''}`
                  }
                  end={item.end ?? item.to === '/'}
                  onClick={() => setMoreOpen(false)}
                >
                  <span className="mobile-more-link__icon">
                    <NavIcon name={item.icon} />
                  </span>
                  <span className="mobile-more-link__label">{t(`nav.${item.key}`)}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </>
      )}

      <nav className="nav-mobile" aria-label={t('nav.mobileMain')}>
        {MOBILE_PRIMARY_NAV_ROUTES.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-mobile-link ${isActive ? 'active' : ''}`}
            end={item.to === '/'}
          >
            <span className="nav-mobile-icon">
              <NavIcon name={item.icon} />
            </span>
            <span className="nav-mobile-label">{t(`nav.${item.key}`)}</span>
          </NavLink>
        ))}

        <button
          type="button"
          className={`nav-mobile-link nav-mobile-link--more${moreActive ? ' active' : ''}${moreOpen ? ' is-open' : ''}`}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          onClick={() => setMoreOpen((open) => !open)}
        >
          <span className="nav-mobile-icon">
            <NavIcon name="more" />
          </span>
          <span className="nav-mobile-label">{t('nav.more')}</span>
        </button>
      </nav>
    </div>
  );
}
