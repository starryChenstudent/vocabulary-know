import { useEffect, useState } from 'react';
import { api, type ErrorWordEntry, type ResultType } from '../api/client';
import { useLocale } from '../components/LocaleProvider';
import './ErrorBook.css';

export default function ErrorBook() {
  const { t } = useLocale();
  const [entries, setEntries] = useState<ErrorWordEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const resultLabel = (type: ResultType) => t(`result.${type}`);

  useEffect(() => {
    api
      .getErrorBook()
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state">{t('common.loading')}</div>;

  return (
    <div className="error-book-page fade-in">
      <div className="page-header">
        <h1 className="page-title">{t('errorBook.title')}</h1>
        <p className="page-desc">{t('errorBook.desc')}</p>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state card">
          <p>{t('errorBook.empty')}</p>
          <p>{t('errorBook.emptyHint')}</p>
        </div>
      ) : (
        <div className="error-list">
          {entries.map((entry) => (
            <div key={entry.word.id} className="card error-item">
              <div className="error-item-header">
                <div>
                  <span className="mono error-en">{entry.word.english}</span>
                  <span className="error-cn">{entry.word.chinese}</span>
                </div>
                <span className="badge badge-error">
                  {t('errorBook.errorTimes', { count: entry.errorCount })}
                </span>
              </div>
              <div className="error-item-meta">
                <span>
                  {t('errorBook.lastError')}
                  <span className={`badge badge-${getBadgeType(entry.lastError)}`}>
                    {resultLabel(entry.lastError)}
                  </span>
                </span>
                <span className="error-date">{entry.lastErrorDate}</span>
              </div>
              <div className="error-types">
                {entry.errorTypes.spelling_error > 0 && (
                  <span className="badge badge-error">
                    {t('errorBook.spelling')} {entry.errorTypes.spelling_error}
                  </span>
                )}
                {entry.errorTypes.meaning_wrong > 0 && (
                  <span className="badge badge-warning">
                    {t('errorBook.meaning')} {entry.errorTypes.meaning_wrong}
                  </span>
                )}
                {entry.errorTypes.unknown > 0 && (
                  <span className="badge badge-muted">
                    {t('errorBook.unknownShort')} {entry.errorTypes.unknown}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getBadgeType(result: string): string {
  switch (result) {
    case 'spelling_error':
      return 'error';
    case 'meaning_wrong':
      return 'warning';
    default:
      return 'muted';
  }
}
