import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from './LocaleProvider';
import './MobileUserMenu.css';

export default function MobileUserMenu() {
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const initial = user.username.slice(0, 1).toUpperCase();

  return (
    <div ref={rootRef} className="mobile-user-menu">
      {open && (
        <div className="mobile-user-menu-panel" role="menu" aria-label={t('userMenu.title')}>
          <div className="mobile-user-menu-name">{user.username}</div>
          {user.is_admin && (
            <span className="mobile-user-menu-badge">{t('admin.adminRole')}</span>
          )}
          <button
            type="button"
            className="mobile-user-menu-logout"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            {t('common.logout')}
          </button>
        </div>
      )}

      <button
        type="button"
        className="mobile-user-menu-trigger"
        aria-label={t('userMenu.title')}
        aria-expanded={open}
        aria-haspopup="menu"
        title={user.username}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="mobile-user-menu-avatar">{initial}</span>
      </button>
    </div>
  );
}
