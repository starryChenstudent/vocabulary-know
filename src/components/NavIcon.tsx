import type { NavIconName } from '../nav/navConfig';

export default function NavIcon({ name }: { name: NavIconName }) {
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
    case 'translate':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m5 8 6 6M11 14l6-6" />
          <path d="M4 20h8M14 4h6v6" />
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
    case 'tokens':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v8M9.5 10.5h5M9.5 13.5h5" />
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
