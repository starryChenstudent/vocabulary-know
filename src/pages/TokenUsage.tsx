import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, type TokenUsageReport } from '../api/client';
import { useLocale } from '../components/LocaleProvider';
import {
  defaultUsageDateRange,
  formatBudgetK,
  formatCompactTokens,
  formatTokenCount,
  parseBudgetKInput,
  tokensToBudgetKInput,
} from '../utils/formatTokens';
import './TokenUsage.css';

function useMobileTable() {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return mobile;
}

function TableHeaderLabel({ long, short }: { long: ReactNode; short: ReactNode }) {
  return (
    <>
      <span className="token-usage-th-long">{long}</span>
      <span className="token-usage-th-short">{short}</span>
    </>
  );
}

export default function TokenUsage() {
  const { t } = useLocale();
  const mobileTable = useMobileTable();
  const initialRange = defaultUsageDateRange();
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [report, setReport] = useState<TokenUsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [budgetInput, setBudgetInput] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetMessage, setBudgetMessage] = useState('');

  const loadReport = useCallback(async () => {
    setError('');
    try {
      const data = await api.getTokenUsage(from, to);
      setReport(data);
      setBudgetInput(
        data.budget.dailyTokenLimit != null
          ? tokensToBudgetKInput(data.budget.dailyTokenLimit)
          : ''
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t('tokenUsage.loadFailed'));
      setReport(null);
    }
  }, [from, to, t]);

  useEffect(() => {
    setLoading(true);
    loadReport().finally(() => setLoading(false));
  }, [loadReport]);

  useEffect(() => {
    if (!budgetMessage) return;
    const id = window.setTimeout(() => setBudgetMessage(''), 2000);
    return () => window.clearTimeout(id);
  }, [budgetMessage]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadReport();
    setRefreshing(false);
  }

  async function handleSaveBudget() {
    setSavingBudget(true);
    setBudgetMessage('');
    setError('');
    try {
      const limit = parseBudgetKInput(budgetInput);
      if (limit !== null && Number.isNaN(limit)) {
        setError(t('tokenUsage.budgetSaveFailed'));
        return;
      }
      const { budget } = await api.setTokenBudget(limit);
      setReport((prev) => (prev ? { ...prev, budget } : prev));
      setBudgetMessage(t('tokenUsage.budgetSaved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('tokenUsage.budgetSaveFailed'));
    } finally {
      setSavingBudget(false);
    }
  }

  const formatCellCount = (value: number) =>
    mobileTable ? formatCompactTokens(value) : formatTokenCount(value);

  const providerLabel = (preset: string) => {
    const key = `adminAi.providers.${preset}` as const;
    const translated = t(key);
    return translated === key ? preset : translated;
  };

  return (
    <div className="token-usage-page fade-in">
      <header className="token-usage-page__header">
        <div className="page-header">
          <h1 className="page-title">{t('nav.tokenUsage')}</h1>
          <p className="page-desc">{t('tokenUsage.desc')}</p>
        </div>
      </header>

      <div className="token-usage-page__body">
      <section className="card token-usage-filters">
        <div className="token-usage-filters__dates">
          <label>
            {t('tokenUsage.dateFrom')}
            <input
              type="date"
              className="input"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <span className="token-usage-filters__sep">—</span>
          <label>
            {t('tokenUsage.dateTo')}
            <input
              type="date"
              className="input"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={refreshing || loading}
          onClick={() => void handleRefresh()}
        >
          {refreshing || loading ? t('tokenUsage.refreshing') : t('tokenUsage.refresh')}
        </button>
      </section>

      {error && <div className="error-msg">{error}</div>}
      {budgetMessage && (
        <div className="app-toast" role="status" aria-live="polite">
          {budgetMessage}
        </div>
      )}

      {loading && !report ? (
        <div className="empty-state">{t('common.loading')}</div>
      ) : report ? (
        <>
          {!report.apiKeyConfigured &&
          report.summary.promptTokens + report.summary.completionTokens === 0 &&
          report.byModel.length === 0 ? (
            <div className="card token-usage-detail token-usage-empty">
              <span>
                {t('tokenUsage.noApiKey')}{' '}
                <Link to="/settings/api">{t('tokenUsage.goSettings')}</Link>
              </span>
            </div>
          ) : (
            <>
              <section className="card token-usage-budget">
                <h2 className="section-title">{t('tokenUsage.budgetTitle')}</h2>
                <p className="token-usage-budget__desc">{t('tokenUsage.budgetDesc')}</p>
                {report.budget.limitReached && (
                  <p className="token-usage-budget__warn">{t('tokenUsage.budgetLimitReached')}</p>
                )}
                <div className="token-usage-budget__today-block">
                  <p className="token-usage-budget__today-heading">
                    {t('tokenUsage.budgetTodayHeading')}
                  </p>
                  <div className="token-usage-metrics">
                    <div className="token-usage-metric">
                      <span className="token-usage-metric__value">
                        {formatCompactTokens(report.budget.todayPromptTokens)}
                      </span>
                      <span className="token-usage-metric__label">{t('tokenUsage.inputTokens')}</span>
                    </div>
                    <span className="token-usage-metrics__op" aria-hidden>
                      +
                    </span>
                    <div className="token-usage-metric">
                      <span className="token-usage-metric__value">
                        {formatCompactTokens(report.budget.todayCompletionTokens)}
                      </span>
                      <span className="token-usage-metric__label">{t('tokenUsage.outputTokens')}</span>
                    </div>
                    <span className="token-usage-metrics__op" aria-hidden>
                      =
                    </span>
                    <div className="token-usage-metric token-usage-metric--total">
                      <span className="token-usage-metric__value">
                        {formatCompactTokens(report.budget.todayTotalTokens)}
                      </span>
                      <span className="token-usage-metric__label">{t('tokenUsage.totalTokens')}</span>
                    </div>
                  </div>
                  {report.budget.dailyTokenLimit != null && (
                    <div
                      className="token-usage-budget__progress"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={report.budget.dailyTokenLimit}
                      aria-valuenow={report.budget.todayTotalTokens}
                      aria-label={t('tokenUsage.budgetTodayHeading')}
                    >
                      <div
                        className={`token-usage-budget__progress-fill${
                          report.budget.limitReached
                            ? ' token-usage-budget__progress-fill--over'
                            : ''
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            (report.budget.todayTotalTokens / report.budget.dailyTokenLimit) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                  <p className="token-usage-budget__limit-line">
                    {report.budget.dailyTokenLimit != null
                      ? t('tokenUsage.budgetLimitLine', {
                          limit: formatBudgetK(report.budget.dailyTokenLimit),
                        })
                      : t('tokenUsage.budgetUnlimited')}
                  </p>
                </div>
                <div className="token-usage-budget__form">
                  <label className="token-usage-budget__label">
                    {t('tokenUsage.budgetInputLabel')}
                    <input
                      type="number"
                      className="input"
                      min={0}
                      step={1}
                      placeholder={t('tokenUsage.budgetPlaceholder')}
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={savingBudget}
                    onClick={() => void handleSaveBudget()}
                  >
                    {savingBudget ? t('tokenUsage.budgetSaving') : t('tokenUsage.budgetSave')}
                  </button>
                </div>
              </section>

              <section className="token-usage-range card">
                <div className="token-usage-range__header">
                  <h2 className="section-title">{t('tokenUsage.rangeSummaryHeading')}</h2>
                  <p className="token-usage-range__hint">
                    {t('tokenUsage.rangeSummaryHint', { from, to })}
                  </p>
                </div>
                <div className="token-usage-metrics token-usage-metrics--range">
                  <div className="token-usage-metric">
                    <span className="token-usage-metric__value">
                      {formatCompactTokens(report.summary.promptTokens)}
                    </span>
                    <span className="token-usage-metric__label">{t('tokenUsage.inputTokens')}</span>
                  </div>
                  <span className="token-usage-metrics__op" aria-hidden>
                    +
                  </span>
                  <div className="token-usage-metric">
                    <span className="token-usage-metric__value">
                      {formatCompactTokens(report.summary.completionTokens)}
                    </span>
                    <span className="token-usage-metric__label">{t('tokenUsage.outputTokens')}</span>
                  </div>
                  <span className="token-usage-metrics__op" aria-hidden>
                    =
                  </span>
                  <div className="token-usage-metric token-usage-metric--total">
                    <span className="token-usage-metric__value">
                      {formatCompactTokens(
                        report.summary.promptTokens + report.summary.completionTokens
                      )}
                    </span>
                    <span className="token-usage-metric__label">{t('tokenUsage.totalTokens')}</span>
                  </div>
                </div>
              </section>

              <section className="card token-usage-detail">
                <h2 className="section-title">{t('tokenUsage.byModel')}</h2>
                {report.byModel.length === 0 ? (
                  <div className="token-usage-empty">{t('tokenUsage.emptyRange')}</div>
                ) : (
                  <div className="token-usage-table-wrap">
                    <table className="token-usage-table">
                      <colgroup>
                        <col className="col-provider" />
                        <col className="col-model" />
                        <col className="col-num" />
                        <col className="col-num" />
                        <col className="col-num" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="col-text">{t('tokenUsage.colProvider')}</th>
                          <th className="col-text col-model">{t('tokenUsage.colModel')}</th>
                          <th className="col-num">
                            <TableHeaderLabel
                              long={t('tokenUsage.colInput')}
                              short={t('tokenUsage.colInputShort')}
                            />
                          </th>
                          <th className="col-num">
                            <TableHeaderLabel
                              long={t('tokenUsage.colOutput')}
                              short={t('tokenUsage.colOutputShort')}
                            />
                          </th>
                          <th className="col-num">
                            <TableHeaderLabel
                              long={t('tokenUsage.colCalls')}
                              short={t('tokenUsage.colCallsShort')}
                            />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.byModel.map((row) => (
                          <tr key={`${row.provider}-${row.model}`}>
                            <td className="col-text">{providerLabel(row.provider)}</td>
                            <td className="col-text col-model" title={row.model}>
                              {row.model}
                            </td>
                            <td className="col-num">{formatCellCount(row.promptTokens)}</td>
                            <td className="col-num">{formatCellCount(row.completionTokens)}</td>
                            <td className="col-num">{formatCellCount(row.callCount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </>
      ) : null}
      </div>
    </div>
  );
}
