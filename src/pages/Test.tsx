import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type TestQuestion, type TestMode, type ResultType } from '../api/client';
import PronounceButton from '../components/PronounceButton';
import DictationPlayer from '../components/DictationPlayer';
import { useLocale } from '../components/LocaleProvider';
import { useDictationSettings } from '../hooks/useDictationSettings';
import { useElapsedTimer } from '../hooks/useTime';
import { formatDuration } from '../utils/time';
import { primeAudioPlayback, preloadWordAudio } from '../utils/dictionaryAudio';
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
  const { settings: dictationSettings, setSettings: setDictationSettings } = useDictationSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = searchParams.get('type') === 'review' ? 'review' : 'daily';
  const [testType, setTestType] = useState<TestType>(initialType);
  const [testMode, setTestMode] = useState<TestMode | null>(null);
  const [dailyStats, setDailyStats] = useState<{
    new: number;
    due: number;
    study: number;
  } | null>(null);
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
    submittedAnswer: string;
  } | null>(null);
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dictationAutoStartedRef = useRef(false);
  const elapsedSeconds = useElapsedTimer(started && !finished && questions.length > 0);

  const modeLabel = (mode: TestMode) => {
    if (mode === 'en_to_cn') return t('test.enToCn');
    if (mode === 'cn_to_en') return t('test.cnToEn');
    return t('test.dictation');
  };
  const resultLabel = (type: ResultType) => t(`result.${type}`);

  const dictationSpeedLabel =
    dictationSettings.playbackRate === 0.75
      ? t('test.dictationSpeedSlow')
      : dictationSettings.playbackRate === 1.25
        ? t('test.dictationSpeedFast')
        : t('test.dictationSpeedNormal');

  const dictationAccentLabel =
    dictationSettings.accent === 'us'
      ? t('test.dictationAccentUs')
      : dictationSettings.accent === 'uk'
        ? t('test.dictationAccentUk')
        : t('test.dictationAccentAny');

  const dictationSettingsSummary = t('test.dictationSettingsSummary', {
    count: dictationSettings.playCount,
    speed: dictationSpeedLabel,
    accent: dictationAccentLabel,
  });

  const loadDailyTest = useCallback(async (mode: TestMode) => {
    setLoading(true);
    setStarted(false);
    setFinished(false);
    setTestMode(mode);
    setRecords([]);
    setCurrentIndex(0);
    try {
      const qs = await api.getDailyTest(mode);
      if (qs.length > 0 && mode === 'dictation') {
        await preloadWordAudio(qs[0].answer, {
          accent: dictationSettings.accent,
          playbackRate: dictationSettings.playbackRate,
        });
      }
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
  }, [dictationSettings.accent, dictationSettings.playbackRate]);

  const startDailyTest = useCallback(async (mode: TestMode) => {
    if (mode === 'dictation') {
      await primeAudioPlayback();
    }
    await loadDailyTest(mode);
  }, [loadDailyTest]);

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
      .then((stats) =>
        setDailyStats({
          new: stats.todayNewWords,
          due: stats.todayDueWords,
          study: stats.todayStudyWords,
        })
      )
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [testType, loadReviewTest, resetDailySelection]);

  useEffect(() => {
    if (testType !== 'daily') return;
    if (searchParams.get('mode') !== 'dictation') return;
    if (dictationAutoStartedRef.current || loading || started) return;
    if (!dailyStats || dailyStats.study === 0) return;

    dictationAutoStartedRef.current = true;
    void startDailyTest('dictation');
    setSearchParams({}, { replace: true });
  }, [testType, searchParams, loading, started, dailyStats, setSearchParams, startDailyTest]);

  const current = questions[currentIndex];
  const isDictation = current?.mode === 'dictation';
  const englishWord =
    current &&
    (current.mode === 'en_to_cn' ? current.prompt : current.answer);

  const handleSubmit = async () => {
    if (!current) return;

    try {
      const res = await api.submitAnswer(current.wordId, current.mode, userAnswer);
      setLastResult({
        resultType: res.resultType,
        expected: res.expected,
        submittedAnswer: userAnswer,
      });
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
      const nextIndex = currentIndex + 1;
      const next = questions[nextIndex];
      if (next?.mode === 'dictation') {
        void preloadWordAudio(next.answer, {
          accent: dictationSettings.accent,
          playbackRate: dictationSettings.playbackRate,
        });
      }
      setCurrentIndex(nextIndex);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleSkip = async () => {
    if (!current) return;
    try {
      const res = await api.submitAnswer(current.wordId, current.mode, '');
      setLastResult({
        resultType: res.resultType,
        expected: res.expected,
        submittedAnswer: '',
      });
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

  if (testType === 'daily' && dailyStats?.study === 0) {
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
        <div className="page-header test-page-header">
          <div className="test-page-header__text">
            <h1 className="page-title">{t('test.title')}</h1>
            <p className="page-desc">
              {testType === 'daily' ? t('test.dailyDesc') : t('test.reviewDesc')}
            </p>
          </div>
          {testTypeTabs}
        </div>

        {testType === 'daily' ? (
          <>
            <section className="test-overview card">
              <div className="test-overview__hero">
                <span className="test-overview__count">{dailyStats?.study ?? 0}</span>
                <div className="test-overview__meta">
                  <h2 className="test-overview__title">{t('test.missionStudyToday')}</h2>
                  <div className="test-overview__pills">
                    <span className="test-pill test-pill--new">
                      {t('home.missionNew')} {dailyStats?.new ?? 0}
                    </span>
                    <span className="test-pill test-pill--due">
                      {t('home.missionDue')} {dailyStats?.due ?? 0}
                    </span>
                  </div>
                </div>
              </div>
              <p className="test-overview__hint">{t('test.dailyHint')}</p>
            </section>

            <section className="test-mode-section">
              <h2 className="test-mode-section__title">{t('test.selectMode')}</h2>
              <div className="test-mode-list">
                <button
                  type="button"
                  className="test-mode-item test-mode-item--green"
                  onClick={() => startDailyTest('en_to_cn')}
                  disabled={loading}
                >
                  <span className="test-mode-item__icon" aria-hidden>
                    A
                  </span>
                  <span className="test-mode-item__body">
                    <strong>{modeLabel('en_to_cn')}</strong>
                    <span>{t('test.enToCnDesc')}</span>
                  </span>
                  <span className="test-mode-item__chevron" aria-hidden>
                    ›
                  </span>
                </button>
                <button
                  type="button"
                  className="test-mode-item test-mode-item--teal"
                  onClick={() => startDailyTest('cn_to_en')}
                  disabled={loading}
                >
                  <span className="test-mode-item__icon" aria-hidden>
                    中
                  </span>
                  <span className="test-mode-item__body">
                    <strong>{modeLabel('cn_to_en')}</strong>
                    <span>{t('test.cnToEnDesc')}</span>
                  </span>
                  <span className="test-mode-item__chevron" aria-hidden>
                    ›
                  </span>
                </button>
                <button
                  type="button"
                  className="test-mode-item test-mode-item--purple"
                  onClick={() => startDailyTest('dictation')}
                  disabled={loading}
                >
                  <span className="test-mode-item__icon" aria-hidden>
                    ♪
                  </span>
                  <span className="test-mode-item__body">
                    <strong>{modeLabel('dictation')}</strong>
                    <span>{t('test.dictationDesc')}</span>
                  </span>
                  <span className="test-mode-item__chevron" aria-hidden>
                    ›
                  </span>
                </button>
              </div>
            </section>

            <details className="test-dictation-panel card">
              <summary className="test-dictation-panel__summary">
                <span className="test-dictation-panel__label">{t('test.dictationSettingsTitle')}</span>
                <span className="test-dictation-panel__preview">{dictationSettingsSummary}</span>
              </summary>
              <div className="dictation-settings">
                <div className="dictation-settings__grid">
                  <label className="dictation-settings__field">
                    <span>{t('test.dictationPlayCount')}</span>
                    <div className="dictation-settings__segmented">
                      {([1, 2, 3] as const).map((count) => (
                        <button
                          key={count}
                          type="button"
                          className={`dictation-settings__option${
                            dictationSettings.playCount === count ? ' active' : ''
                          }`}
                          onClick={() => setDictationSettings({ playCount: count })}
                        >
                          {t('test.dictationPlayCountOption', { count })}
                        </button>
                      ))}
                    </div>
                  </label>

                  <label className="dictation-settings__field">
                    <span>{t('test.dictationSpeed')}</span>
                    <div className="dictation-settings__segmented">
                      {(
                        [
                          { value: 0.75, label: t('test.dictationSpeedSlow') },
                          { value: 1, label: t('test.dictationSpeedNormal') },
                          { value: 1.25, label: t('test.dictationSpeedFast') },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className={`dictation-settings__option${
                            dictationSettings.playbackRate === item.value ? ' active' : ''
                          }`}
                          onClick={() => setDictationSettings({ playbackRate: item.value })}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </label>

                  <label className="dictation-settings__field">
                    <span>{t('test.dictationAccent')}</span>
                    <div className="dictation-settings__segmented">
                      {(
                        [
                          { value: 'us', label: t('test.dictationAccentUs') },
                          { value: 'uk', label: t('test.dictationAccentUk') },
                          { value: 'any', label: t('test.dictationAccentAny') },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className={`dictation-settings__option${
                            dictationSettings.accent === item.value ? ' active' : ''
                          }`}
                          onClick={() => setDictationSettings({ accent: item.value })}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>
              </div>
            </details>
          </>
        ) : (
          <section className="test-overview card test-overview--review">
            <div className="test-overview__hero">
              <span className="test-overview__count test-overview__count--purple">
                {questions.length}
              </span>
              <div className="test-overview__meta">
                <h2 className="test-overview__title">{t('test.reviewTitle')}</h2>
                <p className="test-overview__hint test-overview__hint--inline">
                  {t('test.reviewHint')}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-lg test-review-start"
              onClick={handleStart}
            >
              {t('test.startReview')}
            </button>
          </section>
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
          {testType === 'daily' && current.queue && (
            <span className="badge badge-muted">
              {current.queue === 'new' ? t('test.queueNew') : t('test.queueDue')}
            </span>
          )}
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
          {isDictation ? (
            <DictationPlayer
              word={current.answer}
              settings={dictationSettings}
              autoPlay={!showFeedback}
              playKey={`${current.wordId}-${currentIndex}-${showFeedback ? 'fb' : 'q'}`}
            />
          ) : (
            <div className="test-prompt-row">
              {current.mode === 'en_to_cn' ? (
                <span className="mono prompt-en">{current.prompt}</span>
              ) : (
                <span className="prompt-cn">{current.prompt}</span>
              )}
              {englishWord && <PronounceButton word={englishWord} />}
            </div>
          )}
        </div>
        <p className="test-hint">
          {isDictation
            ? t('test.dictationHint')
            : current.mode === 'en_to_cn'
              ? t('test.hintEnToCn')
              : t('test.hintCnToEn')}
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
                isDictation
                  ? t('test.placeholderDictation')
                  : current.mode === 'en_to_cn'
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
              <>
                {lastResult.submittedAnswer.trim() && (
                  <p className="feedback-answer feedback-answer--user">
                    {t('test.yourAnswer')}
                    <strong>{lastResult.submittedAnswer}</strong>
                  </p>
                )}
                <p className="feedback-answer">
                  {t('test.correctAnswer')}
                  <strong>{lastResult?.expected}</strong>
                </p>
                {isDictation && current.prompt && (
                  <p className="feedback-meaning">
                    {t('test.dictationMeaning', { meaning: current.prompt })}
                  </p>
                )}
              </>
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
