import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type TestQuestion, type TestMode, type ResultType } from '../api/client';
import PronounceButton from '../components/PronounceButton';
import { useLocale } from '../components/LocaleProvider';
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
  const { t, locale } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const elapsedSeconds = useElapsedTimer(started && !finished && questions.length > 0);

  const modeLabel = (mode: TestMode) => (mode === 'en_to_cn' ? t('test.enToCn') : t('test.cnToEn'));
  const resultLabel = (type: ResultType) => t(`result.${type}`);

  const changeTestType = (type: TestType) => {
    setTestType(type);
    setSearchParams(type === 'review' ? { type: 'review' } : {});
  };

  const testTypeTabs = (
    <div className="tab-bar test-type-tabs">
      <button
        type="button"
        className={`tab ${testType === 'daily' ? 'active' : ''}`}
        onClick={() => changeTestType('daily')}
      >
        {t('test.title')}
      </button>
      <button
        type="button"
        className={`tab ${testType === 'review' ? 'active' : ''}`}
        onClick={() => changeTestType('review')}
      >
        {t('test.reviewTitle')}
      </button>
    </div>
  );

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
  const englishWord =
    current && (current.mode === 'en_to_cn' ? current.prompt : current.answer);

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

  const exitTest = () => {
    setShowExitConfirm(false);
    setShowFeedback(false);
    setUserAnswer('');
    setLastResult(null);
    setCurrentIndex(0);
    setRecords([]);
    setFinished(false);
    if (testType === 'daily') {
      resetDailySelection();
    } else {
      setStarted(false);
    }
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
    return <div className="empty-state">{t('common.loading')}</div>;
  }

  if (loading && testType === 'review' && questions.length === 0) {
    return <div className="empty-state">{t('test.loadingQuestions')}</div>;
  }

  if (testType === 'daily' && todayWordCount === 0) {
    return (
      <div className="test-page fade-in">
        <div className="page-header">
          <h1 className="page-title">{t('test.title')}</h1>
        </div>
        <div className="empty-state card">
          <p>{t('test.noNewWords')}</p>
          <p>{t('test.noNewWordsHint')}</p>
        </div>
      </div>
    );
  }

  if (testType === 'review' && questions.length === 0) {
    return (
      <div className="test-page fade-in">
        <div className="page-header">
          <h1 className="page-title">{t('test.reviewTitle')}</h1>
        </div>
        {testTypeTabs}
        <div className="empty-state card">
          <p>{t('test.noReviewWords')}</p>
          <p>{t('test.noReviewWordsHint')}</p>
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
          <h2>{t('test.finished')}</h2>
          <div className="stat-grid test-result-stats">
            <div className="stat-item stat-item--success">
              <div className="stat-value">{stats.correct}</div>
              <div className="stat-label">{t('common.correct')}</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">{t('test.totalQuestions')}</div>
            </div>
            <div className="stat-item stat-item--accent">
              <div className="stat-value">{accuracy}%</div>
              <div className="stat-label">{t('test.accuracy')}</div>
            </div>
            <div className="stat-item stat-item--purple">
              <div className="stat-value">{formatDuration(elapsedSeconds, locale)}</div>
              <div className="stat-label">{t('test.duration')}</div>
            </div>
          </div>
          <div
            className={`test-result-actions${testType === 'review' ? ' test-result-actions--dual' : ''}`}
          >
            {testType === 'review' ? (
              <>
                <button type="button" className="btn btn-secondary btn-lg" onClick={() => changeTestType('daily')}>
                  {t('test.backToDaily')}
                </button>
                <button type="button" className="btn btn-primary btn-lg" onClick={() => loadReviewTest()}>
                  {t('test.anotherRound')}
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary btn-lg" onClick={resetDailySelection}>
                {t('test.backToMode')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="test-page fade-in">
        <div className="page-header">
          <h1 className="page-title">{t('test.title')}</h1>
          <p className="page-desc">
            {testType === 'daily' ? t('test.dailyDesc') : t('test.reviewDesc')}
          </p>
        </div>

        {testTypeTabs}

        {testType === 'daily' ? (
          <div className="card test-start-card">
            <div className="test-info">
              <p>{t('test.todayNewWords', { count: todayWordCount ?? 0 })}</p>
              <p className="test-info-detail">{t('test.dailyHint')}</p>
            </div>
            <div className="test-mode-actions">
              <button
                className="btn btn-primary btn-lg test-mode-btn"
                onClick={() => loadDailyTest('en_to_cn')}
                disabled={loading}
              >
                <span className="test-mode-label">{modeLabel('en_to_cn')}</span>
                <span className="test-mode-desc">{t('test.enToCnDesc')}</span>
              </button>
              <button
                className="btn btn-primary btn-lg test-mode-btn"
                onClick={() => loadDailyTest('cn_to_en')}
                disabled={loading}
              >
                <span className="test-mode-label">{modeLabel('cn_to_en')}</span>
                <span className="test-mode-desc">{t('test.cnToEnDesc')}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="card test-start-card">
            <div className="test-info">
              <p>{t('test.reviewCount', { count: questions.length })}</p>
              <p className="test-info-detail">{t('test.reviewHint')}</p>
            </div>
            <button className="btn btn-primary btn-lg" onClick={handleStart}>
              {t('test.startReview')}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="test-page fade-in">
      {testTypeTabs}
      <div className="test-header">
        <div className="test-header__meta">
          <span className="badge badge-purple">
            {testType === 'daily' && testMode ? modeLabel(testMode) : modeLabel(current.mode)}
          </span>
          <span className="test-progress">
            {currentIndex + 1} / {questions.length}
          </span>
          <span className="test-timer">{formatDuration(elapsedSeconds, locale)}</span>
        </div>
        <button
          type="button"
          className="btn btn-secondary test-exit-btn"
          onClick={() => setShowExitConfirm(true)}
        >
          {t('test.exitTest')}
        </button>
      </div>

      <div className="progress-bar" style={{ marginBottom: 24 }}>
        <div
          className="progress-fill"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="card test-card">
        <div className="test-prompt">
          <div className="test-prompt-row">
            {current.mode === 'en_to_cn' ? (
              <span className="mono prompt-en">{current.prompt}</span>
            ) : (
              <span className="prompt-cn">{current.prompt}</span>
            )}
            {englishWord && <PronounceButton word={englishWord} />}
          </div>
        </div>
        <p className="test-hint">
          {current.mode === 'en_to_cn' ? t('test.hintEnToCn') : t('test.hintCnToEn')}
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
              placeholder={
                current.mode === 'en_to_cn'
                  ? t('test.placeholderEnToCn')
                  : t('test.placeholderCnToEn')
              }
            />
            <div className="test-actions">
              <button className="btn btn-secondary" onClick={handleSkip}>
                {t('test.dontKnow')}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={!userAnswer.trim()}
              >
                {t('common.confirm')}
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
              {lastResult && resultLabel(lastResult.resultType)}
            </div>
            {lastResult?.resultType !== 'correct' && (
              <p className="feedback-answer">
                {t('test.correctAnswer')}
                <strong>{lastResult?.expected}</strong>
              </p>
            )}
            <button className="btn btn-primary btn-lg" onClick={handleNext}>
              {currentIndex + 1 >= questions.length ? t('test.viewResult') : t('test.nextQuestion')}
            </button>
          </div>
        )}
      </div>

      {showExitConfirm && (
        <div
          className="test-exit-backdrop"
          role="presentation"
          onClick={() => setShowExitConfirm(false)}
        >
          <div
            className="test-exit-modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="test-exit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="test-exit-title">{t('test.exitConfirmTitle')}</h3>
            <p className="test-exit-modal__desc">{t('test.exitConfirmMessage')}</p>
            <div className="test-exit-modal__actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowExitConfirm(false)}
              >
                {t('test.continueTest')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={exitTest}>
                {t('test.confirmExit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
