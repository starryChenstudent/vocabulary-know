import { useState } from 'react';
import { api, MODE_LABELS, type TestMode, type TranslateResult } from '../api/client';
import './Translate.css';

export default function Translate() {
  const [direction, setDirection] = useState<TestMode>('en_to_cn');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<TranslateResult | null>(null);

  function swapDirection() {
    setDirection((d) => (d === 'en_to_cn' ? 'cn_to_en' : 'en_to_cn'));
    if (result) {
      setText(result.translation ?? '');
      setResult(null);
    }
    setError('');
    setMessage('');
  }

  async function handleTranslate() {
    if (!text.trim()) {
      setError('请输入要转换的内容');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    setResult(null);
    try {
      const res = await api.translate(text, direction);
      setResult(res);
      if (res.source === 'none') {
        setError('词库中未找到，且未配置 AI 翻译 API Key');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '转换失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToVocabulary() {
    if (!result?.english || !result.chinese) return;
    setAdding(true);
    setError('');
    setMessage('');
    try {
      const res = await api.confirmImport([{ english: result.english, chinese: result.chinese }]);
      if (res.imported > 0) {
        setMessage(`已加入词库：${result.english} → ${result.chinese}`);
      } else {
        setMessage('该单词已在词库中');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入词库失败');
    } finally {
      setAdding(false);
    }
  }

  const sourceLabel =
    result?.source === 'vocabulary'
      ? '来自你的词库'
      : result?.source === 'llm'
        ? 'AI 翻译'
        : null;

  return (
    <div className="translate-page fade-in">
      <div className="page-header">
        <h1 className="page-title">中英转换</h1>
        <p className="page-desc">优先匹配个人词库，未命中时使用 AI 翻译</p>
      </div>

      <div className="tab-bar">
        <button
          type="button"
          className={`tab ${direction === 'en_to_cn' ? 'active' : ''}`}
          onClick={() => {
            setDirection('en_to_cn');
            setResult(null);
            setError('');
            setMessage('');
          }}
        >
          {MODE_LABELS.en_to_cn}
        </button>
        <button
          type="button"
          className={`tab ${direction === 'cn_to_en' ? 'active' : ''}`}
          onClick={() => {
            setDirection('cn_to_en');
            setResult(null);
            setError('');
            setMessage('');
          }}
        >
          {MODE_LABELS.cn_to_en}
        </button>
      </div>

      <div className="card translate-panel">
        <div className="translate-io">
          <div className="translate-block">
            <label className="translate-label">
              {direction === 'en_to_cn' ? '英文' : '中文'}
            </label>
            <textarea
              className="input textarea translate-textarea"
              placeholder={direction === 'en_to_cn' ? '输入英文单词或句子…' : '输入中文释义或句子…'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleTranslate();
              }}
            />
          </div>

          <button
            type="button"
            className="translate-swap"
            onClick={swapDirection}
            title="切换方向"
            aria-label="切换转换方向"
          >
            ⇄
          </button>

          <div className="translate-block">
            <label className="translate-label">
              {direction === 'en_to_cn' ? '中文' : '英文'}
            </label>
            <div className={`translate-output ${result?.translation ? 'has-value' : ''}`}>
              {loading ? (
                <span className="translate-placeholder">转换中…</span>
              ) : result?.translation ? (
                result.translation
              ) : (
                <span className="translate-placeholder">转换结果将显示在这里</span>
              )}
            </div>
          </div>
        </div>

        <div className="translate-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleTranslate}
            disabled={loading}
          >
            {loading ? '转换中…' : '转换'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setText('');
              setResult(null);
              setError('');
              setMessage('');
            }}
          >
            清空
          </button>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {message && <div className="translate-success">{message}</div>}

      {result && result.translation && (
        <div className="card translate-result fade-in">
          <div className="translate-result-head">
            <span className="badge badge-purple">{sourceLabel}</span>
            {result.english && result.chinese && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAddToVocabulary}
                disabled={adding}
              >
                {adding ? '加入中…' : '加入词库'}
              </button>
            )}
          </div>

          {result.english && result.chinese && (
            <div className="translate-pair">
              <span className="translate-en">{result.english}</span>
              <span className="translate-arrow">→</span>
              <span className="translate-cn">{result.chinese}</span>
            </div>
          )}

          {result.vocabularyMatches.length > 1 && (
            <div className="translate-matches">
              <p className="translate-matches-title">词库相关匹配</p>
              <ul>
                {result.vocabularyMatches.map((w) => (
                  <li key={w.id}>
                    <button
                      type="button"
                      className="translate-match-item"
                      onClick={() => {
                        setResult({
                          ...result,
                          translation: direction === 'en_to_cn' ? w.chinese : w.english,
                          english: w.english,
                          chinese: w.chinese,
                          source: 'vocabulary',
                        });
                      }}
                    >
                      <span>{w.english}</span>
                      <span className="translate-match-sep">·</span>
                      <span>{w.chinese}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
