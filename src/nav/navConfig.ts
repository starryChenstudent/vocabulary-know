export type NavIconName =
  | 'home'
  | 'import'
  | 'test'
  | 'report'
  | 'error'
  | 'review'
  | 'words'
  | 'translate'
  | 'api'
  | 'tokens'
  | 'admin'
  | 'more';

export interface NavRouteItem {
  to: string;
  key: string;
  icon: NavIconName;
  end?: boolean;
}

export const MAIN_NAV_ROUTES: NavRouteItem[] = [
  { to: '/', key: 'home', icon: 'home' },
  { to: '/import', key: 'import', icon: 'import' },
  { to: '/test', key: 'test', icon: 'test' },
  { to: '/report', key: 'report', icon: 'report' },
  { to: '/error-book', key: 'errorBook', icon: 'error' },
  { to: '/review', key: 'review', icon: 'review' },
  { to: '/words', key: 'words', icon: 'words' },
  { to: '/translate', key: 'translate', icon: 'translate' },
  { to: '/settings/api', key: 'apiSettings', icon: 'api' },
  { to: '/tokens', key: 'tokenUsage', icon: 'tokens' },
];

export const ADMIN_NAV_ROUTE: NavRouteItem = {
  to: '/admin',
  key: 'admin',
  icon: 'admin',
  end: true,
};

export const MOBILE_PRIMARY_NAV_ROUTES: NavRouteItem[] = [
  { to: '/', key: 'home', icon: 'home' },
  { to: '/import', key: 'import', icon: 'import' },
  { to: '/test', key: 'test', icon: 'test' },
  { to: '/words', key: 'words', icon: 'words' },
];

export const MOBILE_SECONDARY_NAV_ROUTES: NavRouteItem[] = [
  { to: '/translate', key: 'translate', icon: 'translate' },
  { to: '/report', key: 'report', icon: 'report' },
  { to: '/error-book', key: 'errorBook', icon: 'error' },
  { to: '/review', key: 'review', icon: 'review' },
  { to: '/settings/api', key: 'apiSettings', icon: 'api' },
  { to: '/tokens', key: 'tokenUsage', icon: 'tokens' },
];

export const FLUID_PAGE_PATHS = new Set(['/settings/api', '/tokens']);

export function routeIsActive(pathname: string, to: string, end?: boolean): boolean {
  if (end || to === '/') return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}
