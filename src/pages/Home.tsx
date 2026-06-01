import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type StatsOverview } from '../api/client';
import { useLocale } from '../components/LocaleProvider';
import { useAuth } from '../context/AuthContext';
import { useNow } from '../hooks/useTime';
import { formatFullDate, getGreeting } from '../utils/time';
import './Home.css';

const ACTIONS = [
  { to: '/import', titleKey: 'home.importTitle', descKey: 'home.importDesc', tone: 'teal', symbol: '↑' },
  { to: '/test', titleKey: 'home.testTitle', descKey: 'home.testDesc', tone: 'green', symbol: 'Aa' },
  {
    to: '/review',
    titleKey: 'home.reviewTitle',
    descKey: 'home.reviewDesc',
    tone: 'purple',
    symbol: '↻',
    countKey: 'weeklyReviewCount' as const,
  },
  {
    to: '/error-book',
    titleKey: 'home.errorTitle',
    descKey: 'home.errorDesc',
    tone: 'red',
    symbol: '×',
    countKey: 'errorBookCount' as const,
  },
  { to: '/report', titleKey: 'home.reportTitle', descKey: 'home.reportDesc', tone: 'amber', symbol: '▤' },
  { to: '/words', titleKey: 'home.wordsTitle', descKey: 'home.wordsDesc', tone: 'slate', symbol: '≡' },
] as const;

export default function Home() {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const now = useNow(60000);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state">{t('common.loading')}</div>;

  const getDesc = (descKey: string, countKey?: 'weeklyReviewCount' | 'errorBookCount') => {
    if (countKey && stats) {
      return t(descKey, { count: stats[countKey] });
    }
    return t(descKey);
  };

  return (
    <div className="home fade-in">
      <section className="hero card">
        <p className="hero-time">
          {t('home.heroTime', {
            greeting: getGreeting(now, t),
            username: user?.username ?? '',
            date: formatFullDate(now, locale),
          })}
        </p>
        <h1>
          Vocabulary <span className="brand-accent">iknow</span>
        </h1>
        <p className="hero-desc">{t('home.desc')}</p>
      </section>

      <section className="stat-grid">
        <div className="stat-item stat-item--accent">
          <div className="stat-value">{stats?.totalWords ?? 0}</div>
          <div className="stat-label">{t('home.totalWords')}</div>
        </div>
        <div className="stat-item stat-item--success">
          <div className="stat-value">{stats?.todayTests ?? 0}</div>
          <div className="stat-label">{t('home.todayTests')}</div>
        </div>
        <div className="stat-item stat-item--purple">
          <div className="stat-value">{stats?.todayAccuracy ?? 0}%</div>
          <div className="stat-label">{t('home.todayAccuracy')}</div>
        </div>
        <div className="stat-item stat-item--warning">
          <div className="stat-value">{stats?.streakDays ?? 0}</div>
          <div className="stat-label">{t('home.streakDays')}</div>
        </div>
      </section>

      <section className="action-grid">
        {ACTIONS.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className={`action-card action-card--${action.tone}`}
          >
            <div className={`action-icon action-icon--${action.tone}`}>
              <span>{action.symbol}</span>
            </div>
            <div>
              <h3>{t(action.titleKey)}</h3>
              <p>{getDesc(action.descKey, 'countKey' in action ? action.countKey : undefined)}</p>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
