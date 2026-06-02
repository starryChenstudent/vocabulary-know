import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useLocale } from './LocaleProvider';
import './MobileBottomNav.css';

type NavIconName =
  | 'home'
  | 'import'
  | 'test'
  | 'report'
  | 'error'
  | 'review'
  | 'words'
  | 'admin'
  | 'api'
  | 'more';

interface NavRouteItem {
  to: string;
  key: string;
  icon: NavIconName;
  end?: boolean;
}

const MOBILE_PRIMARY_ROUTES: NavRouteItem[] = [
  { to: '/', key: 'home', icon: 'home' },
  { to: '/import', key: 'import', icon: 'import' },
  { to: '/test', key: 'test', icon: 'test' },
  { to: '/words', key: 'words', icon: 'words' },
];

const MOBILE_SECONDARY_ROUTES: NavRouteItem[] = [
  { to: '/report', key: 'report', icon: 'report' },
  { to: '/error-book', key: 'errorBook', icon: 'error' },
  { to: '/review', key: 'review', icon: 'review' },
  { to: '/settings/api', key: 'apiSettings', icon: 'api' },
];

const ADMIN_ROUTE: NavRouteItem = { to: '/admin', key: 'admin', icon: 'admin', end: true };

function NavIcon({ name }: { name: NavIconName }) {
  switch (name) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
        </svg>
      );
    case 'import':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
          <path d="M4 20h16" />
        </svg>
      );
    case 'test':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 6h16M4 12h10M4 18h7" />
        </svg>
      );
    case 'report':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 20V10M12 20V4M18 20v-7" />
        </svg>
      );
    case 'error':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="8" />
          <path d="M9.5 9.5 14.5 14.5M14.5 9.5 9.5 14.5" />
        </svg>
      );
    case 'review':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M20 12a8 8 0 1 1-2.34-5.66" />
          <path d="M20 4v5h-5" />
        </svg>
      );
    case 'words':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M7 6h11M7 12h11M7 18h11M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
      );
    case 'admin':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3 4 7v6c0 5 3.4 9.3 8 10 4.6-.7 8-5 8-10V7l-8-4Z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case 'api':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M8 9h8M8 13h5" />
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 20v1M17 20v1" />
        </svg>
      );
    case 'more':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

function routeIsActive(pathname: string, to: string, end?: boolean): boolean {
  if (end || to === '/') return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

interface MobileBottomNavProps {
  showAdmin: boolean;
}

export default function MobileBottomNav({ showAdmin }: MobileBottomNavProps) {
  const { t } = useLocale();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const secondaryRoutes = showAdmin
    ? [...MOBILE_SECONDARY_ROUTES, ADMIN_ROUTE]
    : MOBILE_SECONDARY_ROUTES;

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
        {MOBILE_PRIMARY_ROUTES.map((item) => (
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
