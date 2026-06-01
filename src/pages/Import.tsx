import { useState, useRef } from 'react';
import { api, type ImportResult } from '../api/client';
import { isHeicFile, loadImagePreview, revokePreviewUrl } from '../utils/imagePreview';
import { compressImage, needsCompression } from '../utils/imageCompression';
import './Import.css';

type Tab = 'image' | 'text';

interface EditableWord {
  english: string;
  chinese: string;
}

export default function Import() {
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
          setError(err instanceof Error ? err.message : 'HEIC 预览失败');
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
      setError(err instanceof Error ? err.message : '识别失败');
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleTextImport = async () => {
    if (!text.trim()) {
      setError('请输入单词文本');
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
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    const words = editableWords.filter((w) => w.english.trim() && w.chinese.trim());
    if (words.length === 0) {
      setError('请至少保留一个有效单词');
      return;
    }
    setConfirming(true);
    setError('');
    try {
      const res = await api.confirmImport(words);
      if (res.imported === 0 && res.duplicates === 0) {
        setError('导入失败，未能写入词库，请稍后重试');
        return;
      }
      if (res.imported === 0 && res.duplicates > 0) {
        setError(`全部为重复词条，未新增（跳过 ${res.duplicates} 个）`);
      }
      setResult(res);
      setEditableWords(res.parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
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
      setError(err instanceof Error ? err.message : '识别失败');
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

  return (
    <div className="import-page fade-in">
      <div className="page-header">
        <h1 className="page-title">导入单词</h1>
        <p className="page-desc">拍照上传或粘贴文本，每行「英文 + 中文」，识别后可编辑再导入</p>
      </div>

      <div className="tab-bar">
        <button
          className={`tab ${tab === 'image' ? 'active' : ''}`}
          onClick={() => setTab('image')}
        >
          拍照 / 上传图片
        </button>
        <button
          className={`tab ${tab === 'text' ? 'active' : ''}`}
          onClick={() => setTab('text')}
        >
          粘贴文本
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
                <img src={preview} alt="预览" className="upload-preview" />
              </div>
            ) : previewLoading ? (
              <div className="upload-preview-loading">
                <div className="loading-spinner" />
                <p>HEIC 预览转换中...</p>
              </div>
            ) : (
              <>
                <div className="upload-icon">+</div>
                <p>点击选择图片或拖拽到此处</p>
                <p className="upload-hint">支持 JPG、PNG、HEIC（iPhone 照片）</p>
              </>
            )}
          </div>
        </>
      )}

      {tab === 'text' && (
        <div className="card">
          <textarea
            className="input textarea"
            placeholder={`每行一个单词，格式：英文 + 中文\napple 苹果\nforeigner 外国人\nbanana - 香蕉`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={handleTextImport}
            disabled={loading}
          >
            {loading ? '解析中...' : '识别文本'}
          </button>
        </div>
      )}

      {loading && (
        <div className="loading-bar">
          <div className="loading-spinner" />
          <p>{tab === 'image' ? 'OCR 识别中，手写内容可能需更长时间...' : '解析中...'}</p>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      {result && (
        <div className="card result-card fade-in">
          {result.handwritingHint && (
            <div className="hint-msg">{result.handwritingHint}</div>
          )}

          {result.ocrEngine && (
            <div className="result-meta">
              识别引擎：
              <span className="badge badge-purple">
                {result.ocrEngine === 'dashscope'
                  ? '百炼 OCR'
                  : result.ocrEngine === 'openai'
                    ? 'OpenAI 视觉'
                    : 'Tesseract OCR'}
              </span>
            </div>
          )}

          {isSaved ? (
            <>
              <div className="result-summary">
                <span className="badge badge-success">已导入 {result.imported} 个</span>
                {result.duplicates > 0 && (
                  <span className="badge badge-muted">跳过重复 {result.duplicates} 个</span>
                )}
              </div>
              <div className="import-actions">
                {tab === 'text' && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleReupload(false)}
                  >
                    重新导入
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="result-summary">
              <span className="badge badge-purple">识别到 {editableWords.length} 个词条</span>
              <span className="badge badge-muted">请核对后确认导入</span>
            </div>
          )}

          {!isSaved && (
            <>
              <div className="editable-list">
                {editableWords.length === 0 ? (
                  <div className="empty-state">
                    <p>未识别到有效单词对</p>
                    <p>可手动添加，或查看下方原始文本</p>
                  </div>
                ) : (
                  editableWords.map((w, i) => (
                    <div key={i} className="editable-row">
                      <input
                        className="input"
                        value={w.english}
                        onChange={(e) => updateWord(i, 'english', e.target.value)}
                        placeholder="英文"
                      />
                      <input
                        className="input"
                        value={w.chinese}
                        onChange={(e) => updateWord(i, 'chinese', e.target.value)}
                        placeholder="中文"
                      />
                      <button
                        type="button"
                        className="btn btn-danger editable-remove-btn"
                        onClick={() => removeWord(i)}
                        aria-label="删除"
                        title="删除"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="import-actions">
                <button className="btn btn-secondary" onClick={addWord}>
                  + 手动添加
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleConfirm}
                  disabled={confirming}
                >
                  {confirming ? '导入中...' : `确认导入 (${editableWords.filter((w) => w.english && w.chinese).length})`}
                </button>
              </div>
            </>
          )}

          {result.rawText && (
            <details className="raw-text" open={editableWords.length === 0}>
              <summary>查看 OCR 原始文本</summary>
              <pre>{result.rawText}</pre>
            </details>
          )}
        </div>
      )}

      {tab === 'image' && (preview || previewLoading || loading) && (
        <div className="import-float-actions">
          <button
            type="button"
            className={`btn ${loading ? 'btn-danger' : 'btn-primary'} import-float-btn`}
            onClick={handleReRecognize}
          >
            {loading ? '取消识别' : '重新识别'}
          </button>
          <button
            type="button"
            className="btn btn-secondary import-float-btn"
            onClick={() => handleReupload()}
          >
            重新上传
          </button>
        </div>
      )}
    </div>
  );
}
