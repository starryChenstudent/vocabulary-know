import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type StatsOverview } from '../api/client';
import { useNow } from '../hooks/useTime';
import { formatFullDate, getGreeting } from '../utils/time';
import './Home.css';

const ACTIONS = [
  { to: '/import', title: '导入单词', desc: '拍照或粘贴文本，OCR 自动识别', tone: 'teal', symbol: '↑' },
  { to: '/test', title: '每日测试', desc: '只测今日导入的新词', tone: 'green', symbol: 'Aa' },
  { to: '/review', title: '强化复习', desc: 'weeklyReviewCount 个待复习单词', tone: 'purple', symbol: '↻' },
  { to: '/error-book', title: '错词本', desc: 'errorBookCount 个错误记录', tone: 'red', symbol: '×' },
  { to: '/report', title: '学习报告', desc: '查看每日学习数据与趋势', tone: 'amber', symbol: '▤' },
  { to: '/words', title: '词库管理', desc: '浏览、编辑、删除单词', tone: 'slate', symbol: '≡' },
] as const;

export default function Home() {
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

  if (loading) return <div className="empty-state">加载中...</div>;

  const getDesc = (key: string) => {
    if (!stats) return key;
    return key
      .replace('weeklyReviewCount', String(stats.weeklyReviewCount))
      .replace('errorBookCount', String(stats.errorBookCount));
  };

  return (
    <div className="home fade-in">
      <section className="hero card">
        <p className="hero-time">
          {getGreeting(now)} · {formatFullDate(now)}
        </p>
        <h1>
          Vocabulary <span className="brand-accent">iknow</span>
        </h1>
        <p className="hero-desc">
          拍照导入单词，每日双模式测试，错误驱动复习，形成完整记忆闭环
        </p>
      </section>

      <section className="stat-grid">
        <div className="stat-item stat-item--accent">
          <div className="stat-value">{stats?.totalWords ?? 0}</div>
          <div className="stat-label">词库总量</div>
        </div>
        <div className="stat-item stat-item--success">
          <div className="stat-value">{stats?.todayTests ?? 0}</div>
          <div className="stat-label">今日测试</div>
        </div>
        <div className="stat-item stat-item--purple">
          <div className="stat-value">{stats?.todayAccuracy ?? 0}%</div>
          <div className="stat-label">今日正确率</div>
        </div>
        <div className="stat-item stat-item--warning">
          <div className="stat-value">{stats?.streakDays ?? 0}</div>
          <div className="stat-label">连续学习天</div>
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
              <h3>{action.title}</h3>
              <p>{getDesc(action.desc)}</p>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
