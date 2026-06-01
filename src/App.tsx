import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { useLocale } from './components/LocaleProvider';
import { useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Import from './pages/Import';
import Test from './pages/Test';
import Report from './pages/Report';
import ErrorBook from './pages/ErrorBook';
import WeeklyReview from './pages/WeeklyReview';
import WordList from './pages/WordList';
import Login from './pages/Login';
import Admin from './pages/Admin';

function ProtectedApp() {
  const { user, loading } = useAuth();
  const { t } = useLocale();

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card card">
          <p className="login-muted">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/import" element={<Import />} />
        <Route path="/test" element={<Test />} />
        <Route path="/report" element={<Report />} />
        <Route path="/error-book" element={<ErrorBook />} />
        <Route path="/review" element={<WeeklyReview />} />
        <Route path="/words" element={<WordList />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  );
}
