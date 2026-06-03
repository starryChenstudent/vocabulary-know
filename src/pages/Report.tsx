import { useEffect, useState } from 'react';
import { api, type DailyReport } from '../api/client';
import { useLocale } from '../components/LocaleProvider';
import './Report.css';

export default function Report() {
  const { t } = useLocale();
  const [today, setToday] = useState<DailyReport | null>(null);
  const [history, setHistory] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getDailyReport(), api.getReportHistory(7)])
      .then(([todayReport, historyReport]) => {
        setToday(todayReport);
        setHistory(historyReport.reverse());
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state">{t('common.loading')}</div>;

  const maxTests = Math.max(...history.map((h) => h.totalTests), 1);

  return (
    <div className="report-page fade-in">
      <div className="page-header">
        <h1 className="page-title">{t('report.title')}</h1>
        <p className="page-desc">{t('report.desc')}</p>
      </div>

      {today && (
        <section className="card report-section">
          <h2 className="section-title">{t('report.todayReport', { date: today.date })}</h2>

          <div className="stat-grid">
            <div className="stat-item">
              <div className="stat-value">{today.totalTests}</div>
              <div className="stat-label">{t('report.testCount')}</div>
            </div>
            <div className="stat-item stat-item--success">
              <div className="stat-value">{today.accuracy}%</div>
              <div className="stat-label">{t('report.accuracy')}</div>
            </div>
            <div className="stat-item stat-item--accent">
              <div className="stat-value">{today.newWordsAdded}</div>
              <div className="stat-label">{t('report.newWords')}</div>
            </div>
          </div>

          <div className="result-breakdown">
            <div className="breakdown-item">
              <span className="badge badge-success">
                {t('common.correct')} {today.correct}
              </span>
            </div>
            <div className="breakdown-item">
              <span className="badge badge-error">
                {t('report.spellingError')} {today.spellingError}
              </span>
            </div>
            <div className="breakdown-item">
              <span className="badge badge-warning">
                {t('report.meaningWrong')} {today.meaningWrong}
              </span>
            </div>
            <div className="breakdown-item">
              <span className="badge badge-muted">
                {t('report.unknown')} {today.unknown}
              </span>
            </div>
          </div>

          <div className="mode-split">
            <span>{t('report.enToCn', { count: today.enToCnTests })}</span>
            <span>{t('report.cnToEn', { count: today.cnToEnTests })}</span>
            <span>{t('report.dictation', { count: today.dictationTests ?? 0 })}</span>
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="section-title">{t('report.trend7d')}</h2>
        <div className="chart">
          {history.map((day) => (
            <div key={day.date} className="chart-bar-group">
              <div className="chart-bar-wrapper">
                <div
                  className="chart-bar"
                  style={{ height: `${(day.totalTests / maxTests) * 100}%` }}
                  title={t('report.chartTitle', {
                    date: day.date,
                    tests: day.totalTests,
                    accuracy: day.accuracy,
                  })}
                />
              </div>
              <span className="chart-label">{day.date.slice(5)}</span>
              <span className="chart-accuracy">{day.accuracy}%</span>
            </div>
          ))}
        </div>

        <div className="history-table">
          {history
            .slice()
            .reverse()
            .map((day) => (
              <div key={day.date} className="history-row">
                <span className="history-date">{day.date}</span>
                <span>
                  {day.totalTests} {t('common.times')}
                </span>
                <span style={{ color: 'var(--success)' }}>
                  {day.correct} {t('common.correct')}
                </span>
                <span>{day.accuracy}%</span>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
