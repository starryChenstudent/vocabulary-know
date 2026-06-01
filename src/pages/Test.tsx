import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  api,
  type TestQuestion,
  type TestMode,
  type ResultType,
  MODE_LABELS,
  RESULT_LABELS,
} from '../api/client';
import { useElapsedTimer } from '../hooks/useTime';
import { formatDuration } from '../utils/time';
import './Test.css';

type TestType = 'daily' | 'review';

interface AnswerRecord {
  question: TestQuestion;
  userAnswer: string;
  resultType: ResultType;
  expected: string;
}

export default function Test() {
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type') === 'review' ? 'review' : 'daily';
  const [testType, setTestType] = useState<TestType>(initialType);
  const [testMode, setTestMode] = useState<TestMode | null>(null);
  const [todayWordCount, setTodayWordCount] = useState<number | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastResult, setLastResult] = useState<{
    resultType: ResultType;
    expected: string;
  } | null>(null);
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const elapsedSeconds = useElapsedTimer(started && !finished && questions.length > 0);

  const loadReviewTest = useCallback(async () => {
    setLoading(true);
    setStarted(false);
    setFinished(false);
    setTestMode(null);
    setRecords([]);
    setCurrentIndex(0);
    try {
      const qs = await api.getWeeklyReviewTest();
      setQuestions(qs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDailyTest = useCallback(async (mode: TestMode) => {
    setLoading(true);
    setStarted(false);
    setFinished(false);
    setTestMode(mode);
    setRecords([]);
    setCurrentIndex(0);
    try {
      const qs = await api.getDailyTest(mode);
      setQuestions(qs);
      if (qs.length > 0) {
        setStarted(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const resetDailySelection = useCallback(() => {
    setStarted(false);
    setFinished(false);
    setTestMode(null);
    setQuestions([]);
    setRecords([]);
    setCurrentIndex(0);
    setShowFeedback(false);
    setUserAnswer('');
    setLastResult(null);
  }, []);

  useEffect(() => {
    if (testType === 'review') {
      loadReviewTest();
      return;
    }

    resetDailySelection();
    setLoading(true);
    api
      .getStats()
      .then((stats) => setTodayWordCount(stats.todayNewWords))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [testType, loadReviewTest, resetDailySelection]);

  const current = questions[currentIndex];

  const handleSubmit = async () => {
    if (!current) return;

    try {
      const res = await api.submitAnswer(current.wordId, current.mode, userAnswer);
      setLastResult({ resultType: res.resultType, expected: res.expected });
      setShowFeedback(true);
      setRecords((prev) => [
        ...prev,
        {
          question: current,
          userAnswer,
          resultType: res.resultType,
          expected: res.expected,
        },
      ]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNext = () => {
    setShowFeedback(false);
    setUserAnswer('');
    setLastResult(null);
    if (currentIndex + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleSkip = async () => {
    if (!current) return;
    try {
      const res = await api.submitAnswer(current.wordId, current.mode, '');
      setLastResult({ resultType: res.resultType, expected: res.expected });
      setShowFeedback(true);
      setRecords((prev) => [
        ...prev,
        {
          question: current,
          userAnswer: '',
          resultType: res.resultType,
          expected: res.expected,
        },
      ]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStart = () => {
    if (questions.length === 0) return;
    setStarted(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !showFeedback) {
      handleSubmit();
    } else if (e.key === 'Enter' && showFeedback) {
      handleNext();
    }
  };

  const stats = {
    correct: records.filter((r) => r.resultType === 'correct').length,
    total: records.length,
  };

  if (loading && testType === 'daily' && !started) {
    return <div className="empty-state">加载中...</div>;
  }

  if (loading && testType === 'review' && questions.length === 0) {
    return <div className="empty-state">加载测试题...</div>;
  }

  if (testType === 'daily' && todayWordCount === 0) {
    return (
      <div className="test-page fade-in">
        <div className="page-header">
          <h1 className="page-title">每日测试</h1>
        </div>
        <div className="empty-state card">
          <p>今日还没有新词</p>
          <p>请先导入今日单词，再进行每日测试</p>
        </div>
      </div>
    );
  }

  if (testType === 'review' && questions.length === 0) {
    return (
      <div className="test-page fade-in">
        <div className="page-header">
          <h1 className="page-title">每日测试</h1>
        </div>
        <div className="empty-state card">
          <p>暂无待复习单词</p>
          <p>完成测试后，错误单词会自动进入复习列表</p>
        </div>
      </div>
    );
  }

  if (finished) {
    const accuracy =
      stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    return (
      <div className="test-page fade-in">
        <div className="card test-result-card">
          <h2>测试完成</h2>
          <div className="stat-grid test-result-stats">
            <div className="stat-item stat-item--success">
              <div className="stat-value">{stats.correct}</div>
              <div className="stat-label">正确</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">总题数</div>
            </div>
            <div className="stat-item stat-item--accent">
              <div className="stat-value">{accuracy}%</div>
              <div className="stat-label">正确率</div>
            </div>
            <div className="stat-item stat-item--purple">
              <div className="stat-value">{formatDuration(elapsedSeconds)}</div>
              <div className="stat-label">用时</div>
            </div>
          </div>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => {
              if (testType === 'daily') {
                resetDailySelection();
              } else {
                loadReviewTest();
              }
            }}
          >
            {testType === 'daily' ? '返回选择模式' : '再来一轮'}
          </button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="test-page fade-in">
        <div className="page-header">
          <h1 className="page-title">每日测试</h1>
          <p className="page-desc">
            {testType === 'daily'
              ? '仅测试今日导入的单词，英→中与中→英分开进行'
              : '针对近 7 天错误单词的强化复习'}
          </p>
        </div>

        <div className="tab-bar">
          <button
            className={`tab ${testType === 'daily' ? 'active' : ''}`}
            onClick={() => setTestType('daily')}
          >
            每日测试
          </button>
          <button
            className={`tab ${testType === 'review' ? 'active' : ''}`}
            onClick={() => setTestType('review')}
          >
            强化复习
          </button>
        </div>

        {testType === 'daily' ? (
          <div className="card test-start-card">
            <div className="test-info">
              <p>
                今日新词 <strong>{todayWordCount ?? 0}</strong> 个
              </p>
              <p className="test-info-detail">每日测试只覆盖今天导入的单词，请选择一种模式开始</p>
            </div>
            <div className="test-mode-actions">
              <button
                className="btn btn-primary btn-lg test-mode-btn"
                onClick={() => loadDailyTest('en_to_cn')}
                disabled={loading}
              >
                <span className="test-mode-label">{MODE_LABELS.en_to_cn}</span>
                <span className="test-mode-desc">看英文，输入中文释义</span>
              </button>
              <button
                className="btn btn-primary btn-lg test-mode-btn"
                onClick={() => loadDailyTest('cn_to_en')}
                disabled={loading}
              >
                <span className="test-mode-label">{MODE_LABELS.cn_to_en}</span>
                <span className="test-mode-desc">看中文，拼写英文单词</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="card test-start-card">
            <div className="test-info">
              <p>
                共 <strong>{questions.length}</strong> 道题
              </p>
              <p className="test-info-detail">根据近期错误类型自动匹配复习模式</p>
            </div>
            <button className="btn btn-primary btn-lg" onClick={handleStart}>
              开始复习
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="test-page fade-in">
      <div className="test-header">
        <span className="badge badge-purple">
          {testType === 'daily' && testMode
            ? MODE_LABELS[testMode]
            : MODE_LABELS[current.mode]}
        </span>
        <span className="test-progress">
          {currentIndex + 1} / {questions.length}
        </span>
        <span className="test-timer">{formatDuration(elapsedSeconds)}</span>
      </div>

      <div className="progress-bar" style={{ marginBottom: 24 }}>
        <div
          className="progress-fill"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="card test-card">
        <div className="test-prompt">
          {current.mode === 'en_to_cn' ? (
            <span className="mono prompt-en">{current.prompt}</span>
          ) : (
            <span className="prompt-cn">{current.prompt}</span>
          )}
        </div>
        <p className="test-hint">
          {current.mode === 'en_to_cn' ? '请输入中文释义' : '请拼写英文单词'}
        </p>

        {!showFeedback ? (
          <>
            <input
              ref={inputRef}
              className="input test-input"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder={current.mode === 'en_to_cn' ? '中文释义...' : 'English...'}
            />
            <div className="test-actions">
              <button className="btn btn-secondary" onClick={handleSkip}>
                不会
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={!userAnswer.trim()}
              >
                确认
              </button>
            </div>
          </>
        ) : (
          <div className="feedback fade-in">
            <div
              className={`feedback-result ${
                lastResult?.resultType === 'correct' ? 'correct' : 'wrong'
              }`}
            >
              {lastResult && RESULT_LABELS[lastResult.resultType]}
            </div>
            {lastResult?.resultType !== 'correct' && (
              <p className="feedback-answer">
                正确答案：<strong>{lastResult?.expected}</strong>
              </p>
            )}
            <button className="btn btn-primary btn-lg" onClick={handleNext}>
              {currentIndex + 1 >= questions.length ? '查看结果' : '下一题'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
