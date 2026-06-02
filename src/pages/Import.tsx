import { useState, useRef } from 'react';
import { api, type ImportResult } from '../api/client';
import { useLocale } from '../components/LocaleProvider';
import { isHeicFile, loadImagePreview, revokePreviewUrl } from '../utils/imagePreview';
import { compressImage, needsCompression } from '../utils/imageCompression';
import './Import.css';

type Tab = 'image' | 'text';

interface EditableWord {
  english: string;
  chinese: string;
}

export default function Import() {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>('image');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [editableWords, setEditableWords] = useState<EditableWord[]>([]);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const currentFileRef = useRef<File | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancelOcr = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const handleImageUpload = async (file: File) => {
    currentFileRef.current = file;
    setLoading(true);
    setError('');
    setResult(null);
    setEditableWords([]);
    setPreviewLoading(true);
    setPreview((prev) => {
      revokePreviewUrl(prev);
      return isHeicFile(file) ? null : URL.createObjectURL(file);
    });

    cancelOcr();

    void loadImagePreview(file, api.importImagePreview)
      .then((url) => setPreview(url))
      .catch((err) => {
        console.error(err);
        if (isHeicFile(file)) {
          setError(err instanceof Error ? err.message : t('import.heicPreviewFailed'));
        }
      })
      .finally(() => setPreviewLoading(false));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let uploadFile = file;
      if (needsCompression(file)) {
        uploadFile = await compressImage(file);
      }
      const res = await api.importImage(uploadFile, controller.signal);
      if (res.previewDataUrl) {
        setPreview((prev) => {
          revokePreviewUrl(prev);
          return res.previewDataUrl!;
        });
      }
      setResult(res);
      setEditableWords(res.parsed.map((w) => ({ ...w })));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof Error && err.message.toLowerCase().includes('abort')) return;
      setError(err instanceof Error ? err.message : t('import.ocrFailed'));
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleTextImport = async () => {
    if (!text.trim()) {
      setError(t('import.enterText'));
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    setEditableWords([]);

    try {
      const res = await api.importText(text);
      setResult(res);
      setEditableWords(res.parsed.map((w) => ({ ...w })));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('import.ocrFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    const words = editableWords.filter((w) => w.english.trim() && w.chinese.trim());
    if (words.length === 0) {
      setError(t('import.keepOneWord'));
      return;
    }
    setConfirming(true);
    setError('');
    try {
      const res = await api.confirmImport(words);
      if (res.imported === 0 && res.duplicates === 0) {
        setError(t('import.importFailed'));
        return;
      }
      if (res.imported === 0 && res.duplicates > 0) {
        setError(t('import.allDuplicates', { count: res.duplicates }));
      }
      setResult(res);
      setEditableWords(res.parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('import.importFailed'));
    } finally {
      setConfirming(false);
    }
  };

  const updateWord = (index: number, field: 'english' | 'chinese', value: string) => {
    setEditableWords((prev) =>
      prev.map((w, i) => (i === index ? { ...w, [field]: value } : w))
    );
  };

  const removeWord = (index: number) => {
    setEditableWords((prev) => prev.filter((_, i) => i !== index));
  };

  const addWord = () => {
    setEditableWords((prev) => [...prev, { english: '', chinese: '' }]);
  };

  const handleReset = () => {
    cancelOcr();
    revokePreviewUrl(preview);
    currentFileRef.current = null;
    setPreview(null);
    setPreviewLoading(false);
    setLoading(false);
    setResult(null);
    setEditableWords([]);
    setError('');
    setText('');
    if (fileRef.current) {
      fileRef.current.value = '';
    }
  };

  const handleReupload = (openPicker = true) => {
    cancelOcr(); // Ensure current OCR request is killed
    handleReset();
    if (openPicker && tab === 'image') {
      window.setTimeout(() => fileRef.current?.click(), 0);
    }
  };

  const handleReRecognize = async () => {
    const file = currentFileRef.current;
    if (!file) return;

    // If currently loading/processing, clicking this button acts as Cancel
    if (loading) {
      cancelOcr();
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setEditableWords([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let uploadFile = file;
      if (needsCompression(file)) {
        uploadFile = await compressImage(file);
      }
      const res = await api.importImage(uploadFile, controller.signal);
      if (res.previewDataUrl) {
        setPreview((prev) => {
          revokePreviewUrl(prev);
          return res.previewDataUrl!;
        });
      }
      setResult(res);
      setEditableWords(res.parsed.map((w) => ({ ...w })));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof Error && err.message.toLowerCase().includes('abort')) return;
      setError(err instanceof Error ? err.message : t('import.ocrFailed'));
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('image/') || /\.heic$/i.test(file.name))) {
      handleImageUpload(file);
    }
  };

  const isSaved = (result?.imported ?? 0) > 0;

  const formatOcrUsage = (usage: NonNullable<ImportResult['ocrUsage']>) => {
    const platform =
      usage.preset === 'tesseract'
        ? t('adminAi.providers.tesseract')
        : t(`adminAi.providers.${usage.preset}`);
    const tokens =
      usage.totalTokens > 0
        ? t('import.engineTokens', { count: usage.totalTokens.toLocaleString() })
        : t('import.engineTokensLocal');
    return `${platform} · ${usage.model} · ${tokens}`;
  };

  const validCount = editableWords.filter((w) => w.english && w.chinese).length;

  const showImageOcrActions =
    tab === 'image' && (preview || previewLoading || loading || result);

  const imageOcrButtons = showImageOcrActions ? (
    <>
      <button
        type="button"
        className={`btn ${loading ? 'btn-danger' : 'btn-primary'}`}
        onClick={handleReRecognize}
      >
        {loading ? t('import.cancelOcr') : t('import.retryOcr')}
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => handleReupload()}
      >
        {t('import.reupload')}
      </button>
    </>
  ) : null;

  return (
    <div className="import-page fade-in">
      <div className="page-header">
        <h1 className="page-title">{t('import.title')}</h1>
        <p className="page-desc">{t('import.desc')}</p>
      </div>

      <div className="tab-bar">
        <button
          className={`tab ${tab === 'image' ? 'active' : ''}`}
          onClick={() => setTab('image')}
        >
          {t('import.tabImage')}
        </button>
        <button
          className={`tab ${tab === 'text' ? 'active' : ''}`}
          onClick={() => setTab('text')}
        >
          {t('import.tabText')}
        </button>
      </div>

      {tab === 'image' && (
        <>
          {/* 选择文件区域 - 点击或拖拽 */}
          <div
            className="upload-zone"
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              hidden
              onChange={onFileChange}
            />
            {preview ? (
              <div className="upload-preview-wrap">
                <img src={preview} alt={t('import.previewAlt')} className="upload-preview" />
              </div>
            ) : previewLoading ? (
              <div className="upload-preview-loading">
                <div className="loading-spinner" />
                <p>{t('import.heicConverting')}</p>
              </div>
            ) : (
              <>
                <div className="upload-icon">+</div>
                <p>{t('import.uploadHint')}</p>
                <p className="upload-hint">{t('import.uploadFormat')}</p>
              </>
            )}
          </div>

          {showImageOcrActions && !result && (
            <div className="import-ocr-bar">{imageOcrButtons}</div>
          )}
        </>
      )}

      {tab === 'text' && (
        <div className="card">
          <textarea
            className="input textarea"
            placeholder={t('import.textPlaceholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={handleTextImport}
            disabled={loading}
          >
            {loading ? t('import.parsing') : t('import.parseText')}
          </button>
        </div>
      )}

      {loading && (
        <div className="import-loading-overlay" role="status" aria-live="polite">
          <div className="import-loading-panel">
            <div className="loading-spinner" />
            <p>{tab === 'image' ? t('import.ocrLoading') : t('import.parsing')}</p>
          </div>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      {result && (
        <div className="card result-card fade-in">
          {result.handwritingHint && (
            <div className="hint-msg">{result.handwritingHint}</div>
          )}

          {showImageOcrActions && (
            <div className="import-ocr-bar import-ocr-bar--in-card">{imageOcrButtons}</div>
          )}

          {!isSaved ? (
            <div className="result-summary">
              {result.ocrUsage && (
                <span className="result-summary__engine">
                  {t('import.engine')}：
                  <span className="badge badge-purple">{formatOcrUsage(result.ocrUsage)}</span>
                </span>
              )}
              <span className="badge badge-purple">
                {t('import.parsed', { count: editableWords.length })}
              </span>
              <span className="badge badge-muted">{t('import.reviewHint')}</span>
            </div>
          ) : (
            <>
              <div className="result-summary">
                {result.ocrUsage && (
                  <span className="result-summary__engine">
                    {t('import.engine')}：
                    <span className="badge badge-purple">{formatOcrUsage(result.ocrUsage)}</span>
                  </span>
                )}
                <span className="badge badge-success">
                  {t('import.imported', { count: result.imported })}
                </span>
                {result.duplicates > 0 && (
                  <span className="badge badge-muted">
                    {t('import.skippedDup', { count: result.duplicates })}
                  </span>
                )}
              </div>
              <div className="import-actions">
                {tab === 'text' && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleReupload(false)}
                  >
                    {t('import.reimport')}
                  </button>
                )}
              </div>
            </>
          )}

          {!isSaved && (
            <>
              <div className="editable-list">
                {editableWords.length === 0 ? (
                  <div className="empty-state">
                    <p>{t('import.noWords')}</p>
                    <p>{t('import.noWordsHint')}</p>
                  </div>
                ) : (
                  editableWords.map((w, i) => (
                    <div key={i} className="editable-row">
                      <input
                        className="input"
                        value={w.english}
                        onChange={(e) => updateWord(i, 'english', e.target.value)}
                        placeholder={t('common.english')}
                      />
                      <input
                        className="input"
                        value={w.chinese}
                        onChange={(e) => updateWord(i, 'chinese', e.target.value)}
                        placeholder={t('common.chinese')}
                      />
                      <button
                        type="button"
                        className="btn btn-danger editable-remove-btn"
                        onClick={() => removeWord(i)}
                        aria-label={t('common.delete')}
                        title={t('common.delete')}
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="import-actions">
                <button className="btn btn-secondary" onClick={addWord}>
                  {t('import.addManual')}
                </button>
                <button
                  className="btn btn-primary import-actions__confirm"
                  onClick={handleConfirm}
                  disabled={confirming}
                >
                  {confirming
                    ? t('import.importing')
                    : t('import.confirmImport', { count: validCount })}
                </button>
              </div>
            </>
          )}

        </div>
      )}

      {showImageOcrActions && !result && (
        <div className="import-float-actions">{imageOcrButtons}</div>
      )}
    </div>
  );
}
