import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, type AdminStats, type AdminUserRow } from '../api/client';
import { useAuth } from '../context/AuthContext';
import './Admin.css';

export default function Admin() {
  const { user } = useAuth();
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
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

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
      setMessage(`已重置 ${passwordUser.username} 的密码`);
      setPasswordUser(null);
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置失败');
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
      setMessage(`已删除用户 ${deleteUser.username}`);
      setDeleteUser(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="empty-state">加载中…</div>;
  }

  return (
    <div className="admin-page fade-in">
      <div className="page-header">
        <h1 className="page-title">管理后台</h1>
        <p className="page-desc">查看用户与词库数据，重置密码或删除账号</p>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {message && <div className="admin-success">{message}</div>}

      <section className="stat-grid admin-stats">
        <div className="stat-item stat-item--accent">
          <div className="stat-value">{stats?.userCount ?? 0}</div>
          <div className="stat-label">用户总数</div>
        </div>
        <div className="stat-item stat-item--success">
          <div className="stat-value">{stats?.totalWords ?? 0}</div>
          <div className="stat-label">单词总量</div>
        </div>
        <div className="stat-item stat-item--purple">
          <div className="stat-value">{stats?.adminCount ?? 0}</div>
          <div className="stat-label">管理员</div>
        </div>
      </section>

      <div className="card admin-table-card">
        <div className="admin-table-header">
          <h2>用户列表</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadData()}>
            刷新
          </button>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>用户名</th>
                <th>单词数</th>
                <th>角色</th>
                <th>注册时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-empty">
                    暂无用户
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
                        <span className="badge badge-success">管理员</span>
                      ) : (
                        <span className="badge badge-muted">普通用户</span>
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
                          改密码
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
                          删除
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
            <h3>重置密码</h3>
            <p className="admin-modal-desc">
              为用户 <strong>{passwordUser.username}</strong> 设置新密码
            </p>
            <form onSubmit={handleResetPassword}>
              <input
                className="input"
                type="password"
                placeholder="新密码（至少 6 位）"
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
                  取消
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingPassword}>
                  {savingPassword ? '保存中…' : '确认重置'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteUser && (
        <div className="admin-modal-backdrop" onClick={() => setDeleteUser(null)}>
          <div className="admin-modal card" onClick={(e) => e.stopPropagation()}>
            <h3>删除用户</h3>
            <p className="admin-modal-desc">
              确定删除用户 <strong>{deleteUser.username}</strong> 吗？该用户的{' '}
              <strong>{deleteUser.word_count}</strong> 个单词及全部测试记录将被永久删除，无法恢复。
            </p>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteUser(null)}>
                取消
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteUser}
                disabled={deleting}
              >
                {deleting ? '删除中…' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
