import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './components/ThemeProvider';
import { LocaleProvider } from './components/LocaleProvider';
import { AuthProvider } from './context/AuthContext';
import { initTheme } from './theme';
import { initLocale } from './i18n';
import './index.css';

initTheme();
initLocale();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LocaleProvider>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </LocaleProvider>
    </BrowserRouter>
  </StrictMode>
);
