import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type WeeklyReviewWord, type ResultType } from '../api/client';
import { useLocale } from '../components/LocaleProvider';
import './WeeklyReview.css';

export default function WeeklyReview() {
  const { t } = useLocale();
  const [words, setWords] = useState<WeeklyReviewWord[]>([]);
  const [loading, setLoading] = useState(true);

  const resultLabel = (type: ResultType) => t(`result.${type}`);

  useEffect(() => {
    api
      .getWeeklyReview()
      .then(setWords)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state">{t('common.loading')}</div>;

  return (
    <div className="review-page fade-in">
      <div className="page-header">
        <h1 className="page-title">{t('review.title')}</h1>
        <p className="page-desc">{t('review.desc')}</p>
      </div>

      {words.length === 0 ? (
        <div className="empty-state card">
          <p>{t('review.empty')}</p>
          <p>{t('review.emptyHint')}</p>
        </div>
      ) : (
        <>
          <div className="review-action">
            <Link to="/test?type=review" className="btn btn-primary btn-lg">
              {t('review.startReview', { count: words.length })}
            </Link>
          </div>

          <div className="review-list">
            {words.map((rw) => (
              <div key={rw.word.id} className="card review-item">
                <div className="review-item-top">
                  <div>
                    <span className="mono review-en">{rw.word.english}</span>
                    <span className="review-cn">{rw.word.chinese}</span>
                  </div>
                  <div className="priority-badge">
                    {t('review.priority', { score: Math.round(rw.priority) })}
                  </div>
                </div>
                <div className="review-stats">
                  <span>{t('review.errors7d', { count: rw.errorCount7d })}</span>
                  <span>{t('review.unknown7d', { count: rw.unknownCount7d })}</span>
                  {rw.daysSinceLastCorrect !== null && rw.daysSinceLastCorrect < 999 && (
                    <span>
                      {t('review.daysSinceCorrect', { days: rw.daysSinceLastCorrect })}
                    </span>
                  )}
                  {rw.daysSinceLastCorrect === 999 && <span>{t('review.neverCorrect')}</span>}
                </div>
                <div className="recent-errors">
                  {rw.recentErrors.map((e, i) => (
                    <span key={i} className="badge badge-muted">
                      {resultLabel(e)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
