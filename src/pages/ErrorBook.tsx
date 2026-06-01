import { useEffect, useState } from 'react';
import { api, type ErrorWordEntry, RESULT_LABELS } from '../api/client';
import './ErrorBook.css';

export default function ErrorBook() {
  const [entries, setEntries] = useState<ErrorWordEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getErrorBook()
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state">加载中...</div>;

  return (
    <div className="error-book-page fade-in">
      <div className="page-header">
        <h1 className="page-title">错词本</h1>
        <p className="page-desc">自动汇总所有测试中的错误记录</p>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state card">
          <p>暂无错词记录</p>
          <p>完成测试后，错误的单词会自动收录到这里</p>
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
                <span className="badge badge-error">{entry.errorCount} 次错误</span>
              </div>
              <div className="error-item-meta">
                <span>
                  最近错误：
                  <span className={`badge badge-${getBadgeType(entry.lastError)}`}>
                    {RESULT_LABELS[entry.lastError]}
                  </span>
                </span>
                <span className="error-date">{entry.lastErrorDate}</span>
              </div>
              <div className="error-types">
                {entry.errorTypes.spelling_error > 0 && (
                  <span className="badge badge-error">
                    拼写 {entry.errorTypes.spelling_error}
                  </span>
                )}
                {entry.errorTypes.meaning_wrong > 0 && (
                  <span className="badge badge-warning">
                    释义 {entry.errorTypes.meaning_wrong}
                  </span>
                )}
                {entry.errorTypes.unknown > 0 && (
                  <span className="badge badge-muted">
                    不会 {entry.errorTypes.unknown}
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
