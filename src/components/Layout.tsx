import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import ClockDisplay from './ClockDisplay';
import ThemeToggle from './ThemeToggle';
import LocaleToggle from './LocaleToggle';
import MobileUserMenu from './MobileUserMenu';
import MobileBottomNav from './MobileBottomNav';
import AppLogo from './AppLogo';
import IcpFooter from './IcpFooter';
import NavIcon from './NavIcon';
import { useAuth } from '../context/AuthContext';
import { useLocale } from './LocaleProvider';
import { ADMIN_NAV_ROUTE, FLUID_PAGE_PATHS, MAIN_NAV_ROUTES } from '../nav/navConfig';
import './Layout.css';

const STORAGE_KEY = 'vocabulary-iknow-sidebar-collapsed';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const { pathname } = useLocation();
  const fluidPage = FLUID_PAGE_PATHS.has(pathname);
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

  const navItems = user?.is_admin
    ? [...MAIN_NAV_ROUTES, ADMIN_NAV_ROUTE]
    : [...MAIN_NAV_ROUTES];

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
              end={item.end ?? item.to === '/'}
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
