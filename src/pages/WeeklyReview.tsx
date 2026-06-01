import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type WeeklyReviewWord, RESULT_LABELS } from '../api/client';
import './WeeklyReview.css';

export default function WeeklyReview() {
  const [words, setWords] = useState<WeeklyReviewWord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getWeeklyReview()
      .then(setWords)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state">加载中...</div>;

  return (
    <div className="review-page fade-in">
      <div className="page-header">
        <h1 className="page-title">每周强化复习</h1>
        <p className="page-desc">
          基于过去 7 天的错误记录和遗忘情况，智能生成个性化复习题库
        </p>
      </div>

      {words.length === 0 ? (
        <div className="empty-state card">
          <p>暂无需要复习的单词</p>
          <p>继续每日测试，系统会根据你的错误自动推荐复习内容</p>
        </div>
      ) : (
        <>
          <div className="review-action">
            <Link to="/test?type=review" className="btn btn-primary btn-lg">
              开始强化复习 ({words.length} 词)
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
                    优先级 {Math.round(rw.priority)}
                  </div>
                </div>
                <div className="review-stats">
                  <span>7日错误 {rw.errorCount7d} 次</span>
                  <span>不会 {rw.unknownCount7d} 次</span>
                  {rw.daysSinceLastCorrect !== null && rw.daysSinceLastCorrect < 999 && (
                    <span>{rw.daysSinceLastCorrect} 天未答对</span>
                  )}
                  {rw.daysSinceLastCorrect === 999 && (
                    <span>从未答对</span>
                  )}
                </div>
                <div className="recent-errors">
                  {rw.recentErrors.map((e, i) => (
                    <span key={i} className="badge badge-muted">
                      {RESULT_LABELS[e]}
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
