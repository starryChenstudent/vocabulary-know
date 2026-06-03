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

  const getDesc = (
    descKey: string,
    countKey?: 'weeklyReviewCount' | 'errorBookCount',
    actionTo?: string
  ) => {
    if (actionTo === '/test' && stats) {
      return t('home.testDesc', {
        study: stats.todayStudyWords,
        new: stats.todayNewWords,
        due: stats.todayDueWords,
      });
    }
    if (countKey && stats) {
      return t(descKey, { count: stats[countKey] });
    }
    return t(descKey);
  };

  const studyTotal = stats?.todayStudyWords ?? 0;
  const studied = stats?.todayStudiedWords ?? 0;
  const progressPct =
    studyTotal > 0 ? Math.min(100, Math.round((studied / studyTotal) * 100)) : 0;
  const hasStudy = studyTotal > 0;

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
        <div className="stat-item stat-item--purple">
          <div className="stat-value">{stats?.todayAccuracy ?? 0}%</div>
          <div className="stat-label">{t('home.todayAccuracy')}</div>
        </div>
        <div className="stat-item stat-item--warning">
          <div className="stat-value">{stats?.streakDays ?? 0}</div>
          <div className="stat-label">{t('home.streakDays')}</div>
        </div>
      </section>

      <section className="today-mission card">
        <div className="today-mission__head">
          <h2 className="today-mission__title">{t('home.todayMissionTitle')}</h2>
          {hasStudy && (
            <span className="today-mission__summary">
              {t('home.missionProgress', { done: studied, total: studyTotal })}
              {(stats?.todayTests ?? 0) > 0 && (
                <>
                  <span className="today-mission__sep">·</span>
                  {t('home.missionAccuracy', { accuracy: stats?.todayAccuracy ?? 0 })}
                </>
              )}
            </span>
          )}
        </div>

        {hasStudy ? (
          <>
            <div className="today-mission__chips">
              <div className="mission-chip mission-chip--new">
                <span className="mission-chip__value">{stats?.todayNewWords ?? 0}</span>
                <span className="mission-chip__label">{t('home.missionNew')}</span>
              </div>
              <div className="mission-chip mission-chip--due">
                <span className="mission-chip__value">{stats?.todayDueWords ?? 0}</span>
                <span className="mission-chip__label">{t('home.missionDue')}</span>
              </div>
              <div className="mission-chip mission-chip--urgent">
                <span className="mission-chip__value">{stats?.weeklyReviewCount ?? 0}</span>
                <span className="mission-chip__label">{t('home.missionUrgent')}</span>
              </div>
            </div>

            <div className="today-mission__progress" aria-hidden="true">
              <div
                className="today-mission__progress-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="today-mission__actions">
              <Link to="/test" className="btn btn-primary btn-lg today-mission__cta">
                {t('home.startStudy')}
              </Link>
              <Link to="/test?mode=dictation" className="btn btn-secondary btn-lg today-mission__sub">
                {t('home.startDictation')}
              </Link>
              {(stats?.weeklyReviewCount ?? 0) > 0 && (
                <Link to="/review" className="btn btn-secondary btn-lg today-mission__sub">
                  {t('home.reviewTitle')}
                </Link>
              )}
            </div>
          </>
        ) : (
          <div className="today-mission__empty">
            <p>{t('home.missionEmpty')}</p>
            <p className="today-mission__empty-hint">{t('home.missionEmptyHint')}</p>
            <Link to="/import" className="btn btn-primary btn-lg today-mission__cta">
              {t('home.goImport')}
            </Link>
          </div>
        )}
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
              <p>{getDesc(action.descKey, 'countKey' in action ? action.countKey : undefined, action.to)}</p>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
