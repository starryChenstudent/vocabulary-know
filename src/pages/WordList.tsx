import { useEffect, useMemo, useState } from 'react';
import { api, type Word } from '../api/client';
import PronounceButton from '../components/PronounceButton';
import { useLocale } from '../components/LocaleProvider';
import './WordList.css';

type DeleteDialog =
  | { type: 'one'; word: Word }
  | { type: 'selected'; count: number; ids: number[] }
  | { type: 'all'; count: number };

export default function WordList() {
  const { t } = useLocale();
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editEn, setEditEn] = useState('');
  const [editCn, setEditCn] = useState('');
  const [exporting, setExporting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialog | null>(null);

  const loadWords = () => {
    api
      .getWords()
      .then((data) => {
        setWords(data);
        setSelectedIds(new Set());
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadWords();
  }, []);

  const filtered = useMemo(
    () =>
      words.filter(
        (w) =>
          w.english.toLowerCase().includes(search.toLowerCase()) ||
          w.chinese.includes(search)
      ),
    [words, search]
  );

  const filteredIds = filtered.map((w) => w.id);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const someFilteredSelected = filteredIds.some((id) => selectedIds.has(id));

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredIds.forEach((id) => next.delete(id));
      } else {
        filteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleDelete = (word: Word) => {
    setDeleteDialog({ type: 'one', word });
  };

  const handleDeleteSelected = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setDeleteDialog({ type: 'selected', count: ids.length, ids });
  };

  const handleDeleteAll = () => {
    if (words.length === 0) return;
    setDeleteDialog({ type: 'all', count: words.length });
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setDeleteDialog(null);
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    setDeleting(true);
    try {
      if (deleteDialog.type === 'one') {
        await api.deleteWord(deleteDialog.word.id);
        setWords((prev) => prev.filter((w) => w.id !== deleteDialog.word.id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(deleteDialog.word.id);
          return next;
        });
      } else if (deleteDialog.type === 'selected') {
        await api.deleteWords(deleteDialog.ids);
        const idSet = new Set(deleteDialog.ids);
        setWords((prev) => prev.filter((w) => !idSet.has(w.id)));
        setSelectedIds(new Set());
      } else {
        await api.deleteAllWords();
        setWords([]);
        setSelectedIds(new Set());
      }
      setDeleteDialog(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : t('words.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const startEdit = (word: Word) => {
    setEditingId(word.id);
    setEditEn(word.english);
    setEditCn(word.chinese);
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    try {
      const updated = await api.updateWord(editingId, editEn, editCn);
      setWords((prev) => prev.map((w) => (w.id === editingId ? updated : w)));
      setEditingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : t('words.updateFailed'));
    }
  };

  const handleExport = async () => {
    if (words.length === 0) return;
    setExporting(true);
    try {
      await api.exportWordsCsv();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('words.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="empty-state">{t('common.loading')}</div>;

  return (
    <div className="word-list-page fade-in">
      <div className="word-list-header">
        <div className="page-header word-list-header-main">
          <h1 className="page-title">{t('words.title')}</h1>
          <p className="page-desc">
            {t('words.totalCount', { count: words.length })}
            {selectedIds.size > 0 && t('words.selectedCount', { count: selectedIds.size })}
          </p>
        </div>
        <div className="word-list-header-tools">
          <input
            className="input search-input"
            placeholder={t('words.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-secondary word-list-export-btn"
            disabled={words.length === 0 || exporting}
            onClick={handleExport}
          >
            {exporting ? t('words.exporting') : t('words.exportCsv')}
          </button>
        </div>
      </div>

      {words.length > 0 && (
        <div className="word-toolbar card">
          <label className="select-all">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              ref={(el) => {
                if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected;
              }}
              onChange={toggleSelectAll}
            />
            <span>{allFilteredSelected ? t('words.deselectAll') : t('words.selectAll')}</span>
          </label>
          <div className="word-toolbar-actions">
            <button
              className="btn btn-danger"
              disabled={selectedIds.size === 0 || deleting}
              onClick={handleDeleteSelected}
            >
              {t('words.deleteSelected', { count: selectedIds.size })}
            </button>
            <button className="btn btn-danger" disabled={deleting} onClick={handleDeleteAll}>
              {t('words.deleteAll')}
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state card">
          <p>{search ? t('words.noMatch') : t('words.emptyLibrary')}</p>
        </div>
      ) : (
        <div className="word-table card">
          {filtered.map((word) => (
            <div
              key={word.id}
              className={`word-row ${selectedIds.has(word.id) ? 'selected' : ''}`}
            >
              {editingId === word.id ? (
                <>
                  <span className="word-checkbox-spacer" />
                  <input
                    className="input word-edit-input"
                    value={editEn}
                    onChange={(e) => setEditEn(e.target.value)}
                  />
                  <input
                    className="input word-edit-input"
                    value={editCn}
                    onChange={(e) => setEditCn(e.target.value)}
                  />
                  <div className="word-actions">
                    <button className="btn btn-primary" onClick={saveEdit}>
                      {t('common.save')}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setEditingId(null)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label className="word-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(word.id)}
                      onChange={() => toggleSelect(word.id)}
                    />
                  </label>
                  <div className="word-en-cell">
                    <span className="mono word-en">{word.english}</span>
                    <PronounceButton word={word.english} size="sm" />
                  </div>
                  <span className="word-cn">{word.chinese}</span>
                  <div className="word-actions">
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                      onClick={() => startEdit(word)}
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                      onClick={() => handleDelete(word)}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {deleteDialog && (
        <div className="word-delete-backdrop" onClick={closeDeleteDialog}>
          <div
            className="word-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="word-delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="word-delete-modal__icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M10 11v6M14 11v6M6 7l1 14h10l1-14" />
              </svg>
            </div>
            <h3 id="word-delete-title" className="word-delete-modal__title">
              {deleteDialog.type === 'one' && t('words.deleteTitleOne')}
              {deleteDialog.type === 'selected' && t('words.deleteTitleSelected')}
              {deleteDialog.type === 'all' && t('words.deleteTitleAll')}
            </h3>
            <p className="word-delete-modal__desc">
              {deleteDialog.type === 'one' &&
                t('words.deleteDescOne', {
                  english: deleteDialog.word.english,
                  chinese: deleteDialog.word.chinese,
                })}
              {deleteDialog.type === 'selected' &&
                t('words.deleteDescSelected', { count: deleteDialog.count })}
              {deleteDialog.type === 'all' &&
                t('words.deleteDescAll', { count: deleteDialog.count })}
            </p>
            {deleteDialog.type === 'one' && (
              <div className="word-delete-modal__preview card">
                <span className="mono word-delete-modal__en">{deleteDialog.word.english}</span>
                <span className="word-delete-modal__cn">{deleteDialog.word.chinese}</span>
              </div>
            )}
            <p className="word-delete-modal__warn">{t('words.deleteWarn')}</p>
            <div className="word-delete-modal__actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeDeleteDialog}
                disabled={deleting}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? t('words.deleting') : t('words.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
