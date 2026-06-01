import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, type AdminStats, type AdminUserRow } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../components/LocaleProvider';
import './Admin.css';

export default function Admin() {
  const { user } = useAuth();
  const { t } = useLocale();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [passwordUser, setPasswordUser] = useState<AdminUserRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [deleteUser, setDeleteUser] = useState<AdminUserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setError('');
    try {
      const [statsData, usersData] = await Promise.all([api.getAdminStats(), api.getAdminUsers()]);
      setStats(statsData);
      setUsers(usersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!user?.is_admin) {
    return <Navigate to="/" replace />;
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordUser) return;
    setSavingPassword(true);
    setError('');
    setMessage('');
    try {
      await api.resetUserPassword(passwordUser.id, newPassword);
      setMessage(t('admin.passwordReset', { username: passwordUser.username }));
      setPasswordUser(null);
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.resetFailed'));
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleDeleteUser() {
    if (!deleteUser) return;
    setDeleting(true);
    setError('');
    setMessage('');
    try {
      await api.deleteUser(deleteUser.id);
      setMessage(t('admin.userDeleted', { username: deleteUser.username }));
      setDeleteUser(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="empty-state">{t('common.loading')}</div>;
  }

  return (
    <div className="admin-page fade-in">
      <div className="page-header">
        <h1 className="page-title">{t('admin.title')}</h1>
        <p className="page-desc">{t('admin.desc')}</p>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {message && <div className="admin-success">{message}</div>}

      <section className="stat-grid admin-stats">
        <div className="stat-item stat-item--accent">
          <div className="stat-value">{stats?.userCount ?? 0}</div>
          <div className="stat-label">{t('admin.users')}</div>
        </div>
        <div className="stat-item stat-item--success">
          <div className="stat-value">{stats?.totalWords ?? 0}</div>
          <div className="stat-label">{t('admin.totalWords')}</div>
        </div>
        <div className="stat-item stat-item--purple">
          <div className="stat-value">{stats?.adminCount ?? 0}</div>
          <div className="stat-label">{t('admin.admins')}</div>
        </div>
      </section>

      <div className="card admin-table-card">
        <div className="admin-table-header">
          <h2>{t('admin.userList')}</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadData()}>
            {t('common.refresh')}
          </button>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t('admin.username')}</th>
                <th>{t('admin.wordCount')}</th>
                <th>{t('admin.role')}</th>
                <th>{t('admin.createdAt')}</th>
                <th>{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-empty">
                    {t('admin.noUsers')}
                  </td>
                </tr>
              ) : (
                users.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td className="admin-username">{row.username}</td>
                    <td>
                      <span className="badge badge-purple">{row.word_count}</span>
                    </td>
                    <td>
                      {row.is_admin ? (
                        <span className="badge badge-success">{t('admin.adminRole')}</span>
                      ) : (
                        <span className="badge badge-muted">{t('admin.userRole')}</span>
                      )}
                    </td>
                    <td className="admin-date">{row.created_at}</td>
                    <td>
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setPasswordUser(row);
                            setNewPassword('');
                            setMessage('');
                            setError('');
                          }}
                        >
                          {t('admin.resetPassword')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={row.id === user.id}
                          onClick={() => {
                            setDeleteUser(row);
                            setMessage('');
                            setError('');
                          }}
                        >
                          {t('admin.deleteUser')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {passwordUser && (
        <div className="admin-modal-backdrop" onClick={() => setPasswordUser(null)}>
          <div className="admin-modal card" onClick={(e) => e.stopPropagation()}>
            <h3>{t('admin.resetTitle')}</h3>
            <p className="admin-modal-desc">
              {t('admin.resetDesc', { username: passwordUser.username })}
            </p>
            <form onSubmit={handleResetPassword}>
              <input
                className="input"
                type="password"
                placeholder={t('admin.newPassword')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
                autoFocus
              />
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPasswordUser(null)}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingPassword}>
                  {savingPassword ? t('admin.resetting') : t('admin.confirmReset')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteUser && (
        <div className="admin-modal-backdrop" onClick={() => setDeleteUser(null)}>
          <div className="admin-modal card" onClick={(e) => e.stopPropagation()}>
            <h3>{t('admin.deleteTitle')}</h3>
            <p className="admin-modal-desc">
              {t('admin.deleteDesc', {
                username: deleteUser.username,
                count: deleteUser.word_count,
              })}
            </p>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteUser(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteUser}
                disabled={deleting}
              >
                {deleting ? t('admin.deleting') : t('admin.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
