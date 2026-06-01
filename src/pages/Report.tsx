import { useEffect, useState } from 'react';
import { api, type DailyReport } from '../api/client';
import './Report.css';

export default function Report() {
  const [today, setToday] = useState<DailyReport | null>(null);
  const [history, setHistory] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getDailyReport(), api.getReportHistory(7)])
      .then(([t, h]) => {
        setToday(t);
        setHistory(h.reverse());
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state">加载中...</div>;

  const maxTests = Math.max(...history.map((h) => h.totalTests), 1);

  return (
    <div className="report-page fade-in">
      <div className="page-header">
        <h1 className="page-title">学习报告</h1>
        <p className="page-desc">每日测试数据汇总与 7 日趋势</p>
      </div>

      {today && (
        <section className="card report-section">
          <h2 className="section-title">今日报告 · {today.date}</h2>

          <div className="stat-grid">
            <div className="stat-item">
              <div className="stat-value">{today.totalTests}</div>
              <div className="stat-label">测试次数</div>
            </div>
            <div className="stat-item stat-item--success">
              <div className="stat-value">{today.accuracy}%</div>
              <div className="stat-label">正确率</div>
            </div>
            <div className="stat-item stat-item--accent">
              <div className="stat-value">{today.newWordsAdded}</div>
              <div className="stat-label">新增单词</div>
            </div>
          </div>

          <div className="result-breakdown">
            <div className="breakdown-item">
              <span className="badge badge-success">正确 {today.correct}</span>
            </div>
            <div className="breakdown-item">
              <span className="badge badge-error">拼写错误 {today.spellingError}</span>
            </div>
            <div className="breakdown-item">
              <span className="badge badge-warning">释义错误 {today.meaningWrong}</span>
            </div>
            <div className="breakdown-item">
              <span className="badge badge-muted">完全不会 {today.unknown}</span>
            </div>
          </div>

          <div className="mode-split">
            <span>英→中：{today.enToCnTests} 次</span>
            <span>中→英：{today.cnToEnTests} 次</span>
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="section-title">7 日趋势</h2>
        <div className="chart">
          {history.map((day) => (
            <div key={day.date} className="chart-bar-group">
              <div className="chart-bar-wrapper">
                <div
                  className="chart-bar"
                  style={{ height: `${(day.totalTests / maxTests) * 100}%` }}
                  title={`${day.date}: ${day.totalTests} 次, ${day.accuracy}%`}
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
                <span>{day.totalTests} 次</span>
                <span style={{ color: 'var(--success)' }}>{day.correct} 正确</span>
                <span>{day.accuracy}%</span>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
