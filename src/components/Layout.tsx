import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import ClockDisplay from './ClockDisplay';
import ThemeToggle from './ThemeToggle';
import LocaleToggle from './LocaleToggle';
import MobileUserMenu from './MobileUserMenu';
import MobileBottomNav from './MobileBottomNav';
import AppLogo from './AppLogo';
import IcpFooter from './IcpFooter';
import { useAuth } from '../context/AuthContext';
import { useLocale } from './LocaleProvider';
import './Layout.css';

const NAV_ROUTES = [
  { to: '/', key: 'home', icon: 'home' as const },
  { to: '/import', key: 'import', icon: 'import' as const },
  { to: '/test', key: 'test', icon: 'test' as const },
  { to: '/report', key: 'report', icon: 'report' as const },
  { to: '/error-book', key: 'errorBook', icon: 'error' as const },
  { to: '/review', key: 'review', icon: 'review' as const },
  { to: '/words', key: 'words', icon: 'words' as const },
  { to: '/settings/api', key: 'apiSettings', icon: 'api' as const },
] as const;

const ADMIN_NAV_ROUTES = [
  { to: '/admin', key: 'admin', icon: 'admin' as const, end: true as const },
] as const;

type NavIconName =
  | (typeof NAV_ROUTES)[number]['icon']
  | (typeof ADMIN_NAV_ROUTES)[number]['icon'];

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
  }
}

const STORAGE_KEY = 'vocabulary-iknow-sidebar-collapsed';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const { pathname } = useLocation();
  const fluidPage = pathname === '/settings/api';
  const homePage = pathname === '/';
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [collapsed]);

  const navItems = user?.is_admin ? [...NAV_ROUTES, ...ADMIN_NAV_ROUTES] : [...NAV_ROUTES];

  return (
    <div className={`layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <NavLink to="/" className="logo" end title="Vocabulary iknow">
          <AppLogo className="logo-mark" />
          <div className="logo-copy">
            <span className="logo-text">Vocabulary</span>
            <span className="logo-accent">iknow</span>
          </div>
        </NavLink>

        <ClockDisplay collapsed={collapsed} />

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              end={'end' in item ? item.end : item.to === '/'}
              title={collapsed ? t(`nav.${item.key}`) : undefined}
            >
              <span className="nav-icon">
                <NavIcon name={item.icon} />
              </span>
              <span className="nav-label">{t(`nav.${item.key}`)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" title={user?.username}>
            <span className="sidebar-user-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="4" />
                <path d="M5 20c0-3.314 3.134-6 7-6s7 2.686 7 6" />
              </svg>
            </span>
            <span className="sidebar-user-name">{user?.username}</span>
            <button
              type="button"
              className="sidebar-logout"
              onClick={() => logout()}
              title={t('common.logout')}
              aria-label={t('common.logoutAria')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M10 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2" />
                <path d="M14 12H4m0 0 3-3m-3 3 3 3" />
              </svg>
            </button>
          </div>
          <LocaleToggle collapsed={collapsed} />
          <ThemeToggle collapsed={collapsed} />
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? t('common.expand') : t('common.collapse')}
            title={collapsed ? t('common.expand') : t('common.collapse')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              {collapsed ? (
                <path d="M9 6l6 6-6 6" />
              ) : (
                <path d="M15 18l-6-6 6-6" />
              )}
            </svg>
            <span className="sidebar-toggle-text">
              {collapsed ? t('common.expand') : t('common.collapse')}
            </span>
          </button>
        </div>
      </aside>

      <div className="layout-shell">
        <main className={`main${fluidPage ? ' main--fluid' : ''}${homePage ? ' main--home' : ''}`}>
          <div
            className={`container${fluidPage ? ' container--fluid' : ''}${homePage ? ' container--home' : ''}`}
          >
            {children}
          </div>
        </main>
        <IcpFooter variant="app" />
      </div>

      <div className="mobile-status-bar">
        <MobileUserMenu />
        <div className="mobile-status-bar__tools">
          <ClockDisplay variant="mobile" />
          <LocaleToggle variant="mobile" />
          <ThemeToggle variant="mobile" />
        </div>
      </div>

      <MobileBottomNav showAdmin={Boolean(user?.is_admin)} />
    </div>
  );
}
