import { useState } from 'react';
import AiSettingsPanel from '../components/AiSettingsPanel';
import { useLocale } from '../components/LocaleProvider';
import './ApiSettings.css';

export default function ApiSettings() {
  const { t } = useLocale();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  return (
    <div className="api-settings-page fade-in">
      <header className="api-settings-page__header">
        <h1 className="api-settings-page__title">{t('adminAi.pageTitle')}</h1>
        <p className="api-settings-page__desc">{t('adminAi.pageDesc')}</p>
      </header>

      {(error || message) && (
        <div className="api-settings-page__alerts">
          {error && <div className="error-msg">{error}</div>}
          {message && <div className="api-settings-success">{message}</div>}
        </div>
      )}

      <div className="api-settings-page__body">
        <AiSettingsPanel
          onMessage={(msg) => {
            setMessage(msg);
            setError('');
          }}
          onError={(msg) => {
            setError(msg);
            setMessage('');
          }}
        />
      </div>

      <footer className="api-settings-page__credit">
        <p>{t('adminAi.designCredit')}</p>
      </footer>
    </div>
  );
}
