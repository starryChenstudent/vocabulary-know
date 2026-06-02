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
  const [savingRegistration, setSavingRegistration] = useState(false);
  const [adminUpdatingId, setAdminUpdatingId] = useState<number | null>(null);

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

  async function handleRegistrationToggle(enabled: boolean) {
    if (!stats || stats.registrationLockedByEnv) return;
    setSavingRegistration(true);
    setError('');
    setMessage('');
    try {
      const nextStats = await api.setRegistrationEnabled(enabled);
      setStats(nextStats);
      setMessage(t('admin.registrationUpdated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.registrationUpdateFailed'));
    } finally {
      setSavingRegistration(false);
    }
  }

  async function handleToggleAdmin(row: AdminUserRow) {
    setAdminUpdatingId(row.id);
    setError('');
    setMessage('');
    try {
      await api.setUserAdmin(row.id, !row.is_admin);
      setMessage(
        row.is_admin
          ? t('admin.adminRevoked', { username: row.username })
          : t('admin.adminGranted', { username: row.username })
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.adminUpdateFailed'));
    } finally {
      setAdminUpdatingId(null);
    }
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

      <section className="card admin-registration-card">
        <div className="admin-registration-main">
          <div>
            <h2 className="admin-registration-title">{t('admin.registrationTitle')}</h2>
            <p className="admin-registration-desc">{t('admin.registrationDesc')}</p>
            {stats?.registrationLockedByEnv && (
              <p className="admin-registration-locked">{t('admin.registrationLocked')}</p>
            )}
          </div>
          <div className="admin-registration-control">
            <span
              className={`badge ${stats?.registrationEnabled ? 'badge-success' : 'badge-muted'}`}
            >
              {stats?.registrationEnabled ? t('admin.registrationOn') : t('admin.registrationOff')}
            </span>
            <label className="admin-toggle">
              <input
                type="checkbox"
                checked={stats?.registrationEnabled ?? true}
                disabled={savingRegistration || stats?.registrationLockedByEnv}
                onChange={(e) => handleRegistrationToggle(e.target.checked)}
              />
              <span className="admin-toggle-slider" />
            </label>
          </div>
        </div>
        {savingRegistration && (
          <p className="admin-registration-saving">{t('admin.registrationSaving')}</p>
        )}
      </section>

      <section className="stat-grid admin-stats">
        <div className="stat-item stat-item--accent">
          <div className="stat-value">{stats?.userCount ?? 0}</div>
          <div className="stat-label">{t('admin.users')}</div>
        </div>
        <div className="stat-item stat-item--purple">
          <div className="stat-value">{stats?.adminCount ?? 0}</div>
          <div className="stat-label">{t('admin.admins')}</div>
        </div>
        <div className="stat-item stat-item--accent">
          <div className="stat-value">{stats?.testsToday ?? 0}</div>
          <div className="stat-label">{t('admin.testsToday')}</div>
        </div>
        <div className="stat-item stat-item--success">
          <div className="stat-value">{stats?.activeUsers7d ?? 0}</div>
          <div className="stat-label">{t('admin.activeUsers7d')}</div>
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
                <th>{t('admin.testsTodayCol')}</th>
                <th>{t('admin.tests7dCol')}</th>
                <th>{t('admin.lastTestCol')}</th>
                <th>{t('admin.role')}</th>
                <th>{t('admin.createdAt')}</th>
                <th>{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="admin-empty">
                    {t('admin.noUsers')}
                  </td>
                </tr>
              ) : (
                users.map((row) => (
                  <tr key={row.id}>
                    <td data-label="ID">{row.id}</td>
                    <td data-label={t('admin.username')} className="admin-username">
                      {row.username}
                    </td>
                    <td data-label={t('admin.wordCount')}>
                      <span className="badge badge-purple">{row.word_count}</span>
                    </td>
                    <td data-label={t('admin.testsTodayCol')}>{row.tests_today}</td>
                    <td data-label={t('admin.tests7dCol')}>{row.tests_7d}</td>
                    <td data-label={t('admin.lastTestCol')} className="admin-date">
                      {row.last_test_date ?? t('admin.noActivity')}
                    </td>
                    <td data-label={t('admin.role')}>
                      {row.is_admin ? (
                        <span className="badge badge-success">{t('admin.adminRole')}</span>
                      ) : (
                        <span className="badge badge-muted">{t('admin.userRole')}</span>
                      )}
                    </td>
                    <td data-label={t('admin.createdAt')} className="admin-date">
                      {row.created_at}
                    </td>
                    <td data-label={t('admin.actions')} className="admin-actions-cell">
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={row.id === user.id || adminUpdatingId === row.id}
                          onClick={() => handleToggleAdmin(row)}
                        >
                          {adminUpdatingId === row.id
                            ? t('common.loading')
                            : row.is_admin
                              ? t('admin.removeAdmin')
                              : t('admin.makeAdmin')}
                        </button>
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
