import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  type AiProvider,
  type AiProviderPreset,
  type AiSettings,
  type OcrEngineMode,
  type ProviderModelEntry,
  type ProviderModelsResult,
} from '../api/client';
import { useLocale } from './LocaleProvider';
import './AiSettingsPanel.css';

interface ProviderCatalogItem {
  preset: AiProviderPreset;
  backendProvider: AiProvider;
  nameKey: string;
  icon: string;
  iconClass: string;
  defaultBaseUrl: string;
  baseUrlOptions?: { labelKey: string; value: string }[];
  defaultModels: { vision: string; structure: string };
}

const PROVIDER_CATALOG: ProviderCatalogItem[] = [
  {
    preset: 'dashscope',
    backendProvider: 'dashscope',
    nameKey: 'adminAi.providers.dashscope',
    icon: 'Q',
    iconClass: 'ai-card-icon--dashscope',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    baseUrlOptions: [
      { labelKey: 'adminAi.regions.dashscopeCn', value: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
      { labelKey: 'adminAi.regions.dashscopeIntl', value: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1' },
      { labelKey: 'adminAi.regions.dashscopeUs', value: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1' },
    ],
    defaultModels: { vision: 'qwen-vl-ocr', structure: 'qwen-vl-ocr' },
  },
  {
    preset: 'deepseek',
    backendProvider: 'openai_compatible',
    nameKey: 'adminAi.providers.deepseek',
    icon: 'D',
    iconClass: 'ai-card-icon--deepseek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModels: { vision: '', structure: '' },
  },
  {
    preset: 'openai',
    backendProvider: 'openai_compatible',
    nameKey: 'adminAi.providers.openai',
    icon: 'O',
    iconClass: 'ai-card-icon--openai',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModels: { vision: 'gpt-4o-mini', structure: 'gpt-4o-mini' },
  },
  {
    preset: 'moonshot',
    backendProvider: 'openai_compatible',
    nameKey: 'adminAi.providers.moonshot',
    icon: 'M',
    iconClass: 'ai-card-icon--moonshot',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    defaultModels: {
      vision: 'moonshot-v1-32k-vision-preview',
      structure: 'moonshot-v1-32k-vision-preview',
    },
  },
  {
    preset: 'custom',
    backendProvider: 'openai_compatible',
    nameKey: 'adminAi.providers.custom',
    icon: '∞',
    iconClass: 'ai-card-icon--custom',
    defaultBaseUrl: '',
    defaultModels: { vision: 'gpt-4o-mini', structure: 'gpt-4o-mini' },
  },
];

function ocrOptionsFor(
  models: ProviderModelEntry[] | undefined,
  current?: string
): ProviderModelEntry[] {
  const list = (models ?? []).filter((m) => m.capability === 'ocr');
  if (current && !list.some((m) => m.id === current)) {
    return [{ id: current, capability: 'ocr', source: 'builtin' }, ...list];
  }
  return list;
}

type ModalTarget = AiProviderPreset | 'local';

interface ModalForm {
  target: ModalTarget;
  preset: AiProviderPreset;
  backendProvider: AiProvider;
  apiKey: string;
  baseUrl: string;
  baseUrlPreset: string;
  customBaseUrl: boolean;
  visionModel: string;
  structureModel: string;
  ocrEngine: OcrEngineMode;
}

function catalogItem(preset: AiProviderPreset): ProviderCatalogItem {
  return PROVIDER_CATALOG.find((p) => p.preset === preset) ?? PROVIDER_CATALOG[0];
}

function buildForm(saved: AiSettings, preset: AiProviderPreset): ModalForm {
  const item = catalogItem(preset);
  const configured = saved.configuredProviders.find((p) => p.preset === preset);
  const isActive = saved.preset === preset;
  const baseUrl = configured?.baseUrl ?? (isActive ? saved.baseUrl : item.defaultBaseUrl);
  const optionMatch = item.baseUrlOptions?.find((o) => o.value === baseUrl);

  return {
    target: preset,
    preset,
    backendProvider: item.backendProvider,
    apiKey: '',
    baseUrl,
    baseUrlPreset: optionMatch?.value ?? (item.baseUrlOptions?.[0]?.value ?? baseUrl),
    customBaseUrl: Boolean(baseUrl && !optionMatch && item.baseUrlOptions),
    visionModel: configured?.visionModel ?? item.defaultModels.vision,
    structureModel: configured?.structureModel ?? item.defaultModels.structure,
    ocrEngine: isActive ? saved.ocrEngine : 'auto',
  };
}

function buildLocalForm(saved: AiSettings): ModalForm {
  return {
    target: 'local',
    preset: saved.preset,
    backendProvider: catalogItem(saved.preset).backendProvider,
    apiKey: '',
    baseUrl: saved.baseUrl,
    baseUrlPreset: '',
    customBaseUrl: false,
    visionModel: saved.visionModel,
    structureModel: saved.structureModel,
    ocrEngine: saved.ocrEngine === 'auto' ? 'auto' : 'tesseract',
  };
}

function resolveBaseUrl(form: ModalForm): string {
  const item = catalogItem(form.preset);
  if (form.customBaseUrl || form.preset === 'custom') {
    return form.baseUrl.trim();
  }
  return form.baseUrlPreset || item.defaultBaseUrl;
}

interface AiSettingsPanelProps {
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
}

export default function AiSettingsPanel({ onMessage, onError }: AiSettingsPanelProps) {
  const { t } = useLocale();
  const [saved, setSaved] = useState<AiSettings | null>(null);
  const [defaultPreset, setDefaultPreset] = useState<AiProviderPreset>('dashscope');
  const [defaultModel, setDefaultModel] = useState('');
  const [defaultSaving, setDefaultSaving] = useState(false);
  const [defaultOcrModels, setDefaultOcrModels] = useState<string[]>([]);
  const [modalForm, setModalForm] = useState<ModalForm | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [providerModels, setProviderModels] = useState<ProviderModelsResult | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getAiSettings();
      setSaved(data);
      setDefaultPreset(data.preset);
      setDefaultModel(data.visionModel);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : t('adminAi.loadFailed'));
    }
  }, [onError, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!saved) return;
    const configured = saved.configuredProviders.some((p) => p.preset === defaultPreset);
    if (!configured) return;

    let cancelled = false;
    api
      .getProviderModels({ preset: defaultPreset })
      .then((result) => {
        if (!cancelled) {
          setDefaultOcrModels(ocrOptionsFor(result.visionModels, defaultModel).map((m) => m.id));
        }
      })
      .catch(() => {
        if (!cancelled) setDefaultOcrModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [defaultPreset, defaultModel, saved]);

  useEffect(() => {
    if (!modalForm || modalForm.target === 'local') {
      setProviderModels(null);
      return;
    }

    let cancelled = false;
    setModelsLoading(true);
    api
      .getProviderModels({
        preset: modalForm.preset,
        baseUrl: resolveBaseUrl(modalForm),
        ...(modalForm.apiKey.trim() ? { apiKey: modalForm.apiKey.trim() } : {}),
      })
      .then((result) => {
        if (!cancelled) setProviderModels(result);
      })
      .catch(() => {
        if (!cancelled) setProviderModels(null);
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modalForm?.target, modalForm?.preset, modalForm?.baseUrl, modalForm?.baseUrlPreset, modalForm?.customBaseUrl, modalForm?.apiKey]);

  function openModal(target: ModalTarget, expandAdvanced = false) {
    if (!saved) return;
    if (target === 'local') {
      setModalForm(buildLocalForm(saved));
    } else {
      setModalForm(buildForm(saved, target));
    }
    setAdvancedOpen(expandAdvanced);
    setTestResult(null);
  }

  function closeModal() {
    setModalForm(null);
    setTestResult(null);
  }

  function setField<K extends keyof ModalForm>(key: K, value: ModalForm[K]) {
    setModalForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setTestResult(null);
  }

  const cardStates = useMemo(() => {
    if (!saved) return [];
    return PROVIDER_CATALOG.map((item) => {
      const configured = saved.configuredProviders.find((p) => p.preset === item.preset);
      const isActive = saved.preset === item.preset;
      const displayBaseUrl = configured?.baseUrl ?? (item.defaultBaseUrl || '—');
      const displayKey = configured ? configured.apiKeyMasked : t('adminAi.keyNotSet');
      const models = configured
        ? [configured.visionModel, configured.structureModel].filter(Boolean)
        : [item.defaultModels.vision, item.defaultModels.structure];
      const uniqueModels = [...new Set(models.filter(Boolean))];

      let status: 'ready' | 'missing' | 'inactive';
      if (configured) {
        status = 'ready';
      } else if (isActive) {
        status = 'missing';
      } else {
        status = 'inactive';
      }

      return {
        item,
        isActive,
        displayBaseUrl,
        displayKey,
        modelSummary:
          configured && uniqueModels.length > 0
            ? uniqueModels.length > 1
              ? t('adminAi.modelCount', { name: uniqueModels[0], count: uniqueModels.length - 1 })
              : uniqueModels[0]
            : t('adminAi.noModels'),
        status,
      };
    });
  }, [saved, t]);

  const configuredProviders = useMemo(
    () => saved?.configuredProviders ?? [],
    [saved]
  );

  const defaultLlmAvailable = configuredProviders.length > 0;

  const defaultModelOptions = useMemo(() => {
    const base = defaultOcrModels.length ? defaultOcrModels : [];
    if (defaultModel && !base.includes(defaultModel)) {
      return [defaultModel, ...base];
    }
    return base.length > 0 ? base : defaultModel ? [defaultModel] : [];
  }, [defaultModel, defaultOcrModels]);

  const defaultLlmDirty =
    saved !== null &&
    (defaultPreset !== saved.preset || defaultModel !== saved.visionModel);

  async function handleDefaultLlmSave() {
    if (!saved || !defaultLlmDirty || !defaultLlmAvailable) return;

    setDefaultSaving(true);
    onError?.('');
    onMessage?.('');
    try {
      const updated = await api.updateAiSettings({
        preset: defaultPreset,
        visionModel: defaultModel,
      });
      setSaved(updated);
      setDefaultPreset(updated.preset);
      setDefaultModel(updated.visionModel);
      onMessage?.(t('adminAi.defaultLlmUpdated'));
    } catch (err) {
      onError?.(err instanceof Error ? err.message : t('adminAi.saveFailed'));
    } finally {
      setDefaultSaving(false);
    }
  }

  function handleDefaultPresetChange(preset: AiProviderPreset) {
    setDefaultPreset(preset);
    const configured = saved?.configuredProviders.find((p) => p.preset === preset);
    setDefaultModel(configured?.visionModel ?? catalogItem(preset).defaultModels.vision);
  }

  const modalOcrModels = useMemo(
    () => ocrOptionsFor(providerModels?.visionModels, modalForm?.visionModel),
    [providerModels?.visionModels, modalForm?.visionModel]
  );

  function renderVisionModelField(tabIndex: number) {
    if (!modalForm) return null;
    if (providerModels && !providerModels.visionSupported) {
      return (
        <p className="ai-field__hint ai-field__hint--warn">{t('adminAi.visionNotSupported')}</p>
      );
    }
    if (modalOcrModels.length > 0) {
      return (
        <select
          className="input ai-modal__input"
          value={modalForm.visionModel}
          onChange={(e) => setField('visionModel', e.target.value)}
          tabIndex={tabIndex}
        >
          {modalOcrModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        className="input ai-modal__input"
        value={modalForm.visionModel}
        onChange={(e) => setField('visionModel', e.target.value)}
        placeholder={t('adminAi.visionModelPlaceholder')}
        tabIndex={tabIndex}
      />
    );
  }

  function renderStructureModelField(tabIndex: number) {
    if (!modalForm) return null;
    if (modalOcrModels.length > 0) {
      return (
        <select
          className="input ai-modal__input"
          value={modalForm.structureModel}
          onChange={(e) => setField('structureModel', e.target.value)}
          tabIndex={tabIndex}
        >
          {modalOcrModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        className="input ai-modal__input"
        value={modalForm.structureModel}
        onChange={(e) => setField('structureModel', e.target.value)}
        tabIndex={tabIndex}
      />
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!modalForm || !saved) return;

    if (modalForm.target === 'local') {
      setSaving(true);
      onError?.('');
      onMessage?.('');
      try {
        const updated = await api.updateAiSettings({ ocrEngine: modalForm.ocrEngine });
        setSaved(updated);
        setDefaultPreset(updated.preset);
        setDefaultModel(updated.visionModel);
        closeModal();
        onMessage?.(t('adminAi.localSaved'));
      } catch (err) {
        onError?.(err instanceof Error ? err.message : t('adminAi.saveFailed'));
      } finally {
        setSaving(false);
      }
      return;
    }

    const baseUrl = resolveBaseUrl(modalForm);
    if (!baseUrl) {
      onError?.(t('adminAi.baseUrlRequired'));
      return;
    }

    setSaving(true);
    onError?.('');
    onMessage?.('');
    try {
      const updated = await api.updateAiSettings({
        provider: modalForm.backendProvider,
        preset: modalForm.preset,
        baseUrl,
        visionModel: modalForm.visionModel,
        structureModel: modalForm.structureModel,
        ocrEngine: modalForm.ocrEngine,
        ...(modalForm.apiKey.trim() ? { apiKey: modalForm.apiKey.trim() } : {}),
      });
      setSaved(updated);
      setDefaultPreset(updated.preset);
      setDefaultModel(updated.visionModel);
      closeModal();
      onMessage?.(t('adminAi.saved'));
    } catch (err) {
      onError?.(err instanceof Error ? err.message : t('adminAi.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    if (!modalForm || modalForm.target === 'local') return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.testAiConnection({
        provider: modalForm.backendProvider,
        preset: modalForm.preset,
        baseUrl: resolveBaseUrl(modalForm),
        visionModel: modalForm.visionModel,
        ...(modalForm.apiKey.trim() ? { apiKey: modalForm.apiKey.trim() } : {}),
      });
      setTestResult(result);
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : t('adminAi.testFailed'),
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleRevoke() {
    if (!saved || !modalForm || modalForm.target === 'local') return;
    setSaving(true);
    try {
      const updated = await api.updateAiSettings({
        clearApiKey: true,
        preset: modalForm.preset,
      });
      setSaved(updated);
      setModalForm(buildForm(updated, modalForm.preset));
      onMessage?.(t('adminAi.revoked'));
    } catch (err) {
      onError?.(err instanceof Error ? err.message : t('adminAi.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  if (!saved) {
    return <p className="ai-settings-loading ai-settings-loading--fluid">{t('common.loading')}</p>;
  }

  const modalItem =
    modalForm && modalForm.target !== 'local' ? catalogItem(modalForm.preset) : null;
  const localActive = !saved.apiKeySet || saved.ocrEngine === 'tesseract';

  return (
    <div className="ai-settings-panel">
      <div className="ai-settings-panel__top">
        <div className="card ai-default-llm">
          <h2 className="ai-default-llm__title">{t('adminAi.defaultLlmTitle')}</h2>
          {defaultLlmAvailable ? (
            <>
              <div className="ai-default-llm__row">
                <label className="ai-default-llm__field">
                  <span className="ai-default-llm__label">{t('adminAi.defaultLlmProvider')}</span>
                  <select
                    className="input"
                    value={defaultPreset}
                    onChange={(e) =>
                      handleDefaultPresetChange(e.target.value as AiProviderPreset)
                    }
                  >
                    {configuredProviders.map((p) => (
                      <option key={p.preset} value={p.preset}>
                        {t(catalogItem(p.preset).nameKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ai-default-llm__field ai-default-llm__field--model">
                  <span className="ai-default-llm__label">{t('adminAi.defaultLlmModel')}</span>
                  {defaultPreset === 'custom' ? (
                    <input
                      className="input"
                      value={defaultModel}
                      onChange={(e) => setDefaultModel(e.target.value)}
                      placeholder={catalogItem('custom').defaultModels.vision}
                    />
                  ) : (
                    <select
                      className="input"
                      value={defaultModel}
                      onChange={(e) => setDefaultModel(e.target.value)}
                    >
                      {defaultModelOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                <button
                  type="button"
                  className={`btn ai-default-llm__save${defaultLlmDirty ? ' btn-primary' : ' btn-secondary'}`}
                  disabled={!defaultLlmDirty || defaultSaving}
                  onClick={handleDefaultLlmSave}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M7 3h10l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
                    <path d="M9 3v6h6V3M9 17h6" />
                  </svg>
                  {defaultSaving
                    ? t('adminAi.saving')
                    : defaultLlmDirty
                      ? t('adminAi.defaultLlmSave')
                      : t('adminAi.defaultLlmSaved')}
                </button>
              </div>
              <p className="ai-default-llm__hint">{t('adminAi.defaultLlmHint')}</p>
            </>
          ) : (
            <p className="ai-default-llm__empty">{t('adminAi.defaultLlmNoProviders')}</p>
          )}
        </div>
      </div>

      <div className="ai-providers-section">
        <div className="ai-providers-section__head">
          <h2>{t('adminAi.providersSection')}</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => load()}>
            {t('common.refresh')}
          </button>
        </div>

        <div className="ai-provider-grid">
          <article className={`ai-provider-card${localActive ? ' ai-provider-card--active' : ''}`}>
            <div className="ai-provider-card__top">
              <div className="ai-provider-card__identity">
                <span className="ai-card-icon ai-card-icon--tesseract">T</span>
                <div>
                  <div className="ai-provider-card__title-row">
                    <strong>{t('adminAi.providers.tesseract')}</strong>
                    <span className="ai-provider-badge">{t('adminAi.builtIn')}</span>
                  </div>
                </div>
              </div>
              <span className="ai-provider-status ai-provider-status--ready">
                <span className="ai-provider-status__dot" />
                {t('adminAi.status.localReady')}
              </span>
            </div>
            <dl className="ai-provider-card__meta">
              <div>
                <dt>{t('adminAi.baseUrl')}</dt>
                <dd>{t('adminAi.localEngine')}</dd>
              </div>
              <div>
                <dt>{t('adminAi.apiKey')}</dt>
                <dd>{t('adminAi.keyNotRequired')}</dd>
              </div>
              <div>
                <dt>{t('adminAi.model')}</dt>
                <dd>{t('adminAi.localModel')}</dd>
              </div>
            </dl>
            <div className="ai-provider-card__actions">
              <button
                type="button"
                className="ai-provider-card__btn ai-provider-card__btn--full"
                onClick={() => openModal('local')}
              >
                {t('adminAi.settingsBtn')}
              </button>
            </div>
          </article>

          {cardStates.map(({ item, isActive, displayBaseUrl, displayKey, modelSummary, status }) => (
            <article
              key={item.preset}
              className={`ai-provider-card${isActive ? ' ai-provider-card--active' : ''}`}
            >
              <div className="ai-provider-card__top">
                <div className="ai-provider-card__identity">
                  <span className={`ai-card-icon ${item.iconClass}`}>{item.icon}</span>
                  <div>
                    <div className="ai-provider-card__title-row">
                      <strong>{t(item.nameKey)}</strong>
                      <span className="ai-provider-badge">{t('adminAi.builtIn')}</span>
                    </div>
                  </div>
                </div>
                <span className={`ai-provider-status ai-provider-status--${status}`}>
                  <span className="ai-provider-status__dot" />
                  {t(`adminAi.status.${status}`)}
                </span>
              </div>
              <dl className="ai-provider-card__meta">
                <div>
                  <dt>{t('adminAi.baseUrl')}</dt>
                  <dd title={displayBaseUrl}>{displayBaseUrl}</dd>
                </div>
                <div>
                  <dt>{t('adminAi.apiKey')}</dt>
                  <dd>{displayKey}</dd>
                </div>
                <div>
                  <dt>{t('adminAi.model')}</dt>
                  <dd>{modelSummary}</dd>
                </div>
              </dl>
              <div className="ai-provider-card__actions">
                <button
                  type="button"
                  className="ai-provider-card__btn"
                  onClick={() => openModal(item.preset, true)}
                >
                  {t('adminAi.modelsBtn')}
                </button>
                <button
                  type="button"
                  className="ai-provider-card__btn ai-provider-card__btn--primary"
                  onClick={() => openModal(item.preset)}
                >
                  {t('adminAi.settingsBtn')}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {modalForm && (
        <div className="ai-modal-backdrop" onClick={closeModal}>
          <div
            className="ai-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="ai-modal-title"
          >
            <header className="ai-modal__header">
              <div className="ai-modal__header-main">
                {modalForm.target === 'local' ? (
                  <>
                    <span className="ai-card-icon ai-card-icon--tesseract">T</span>
                    <h3 id="ai-modal-title">{t('adminAi.configureLocal')}</h3>
                  </>
                ) : (
                  modalItem && (
                    <>
                      <span className={`ai-card-icon ${modalItem.iconClass}`}>{modalItem.icon}</span>
                      <h3 id="ai-modal-title">
                        {t('adminAi.configure', { name: t(modalItem.nameKey) })}
                      </h3>
                    </>
                  )
                )}
              </div>
              <button
                type="button"
                className="ai-modal__close"
                onClick={closeModal}
                aria-label={t('common.close')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M7 7l10 10M17 7 7 17" />
                </svg>
              </button>
            </header>

            <form className="ai-modal__form" onSubmit={handleSave}>
              <div className="ai-modal__body">
              {modalForm.target === 'local' ? (
                <>
                  <p className="ai-modal__desc">{t('adminAi.localDesc')}</p>
                  <label className="ai-field">
                    <span className="ai-field__label">{t('adminAi.ocrEngine')}</span>
                    <select
                      className="input ai-modal__input"
                      value={modalForm.ocrEngine}
                      onChange={(e) => setField('ocrEngine', e.target.value as OcrEngineMode)}
                    >
                      <option value="tesseract">{t('adminAi.ocrTesseract')}</option>
                      <option value="auto">{t('adminAi.ocrAuto')}</option>
                    </select>
                  </label>
                </>
              ) : (
                modalItem && (
                  <>
                    <div className="ai-modal__section">
                      <label className="ai-field">
                        <span className="ai-field__label">
                          {t('adminAi.baseUrl')} <em>*</em>
                        </span>
                        {modalItem.baseUrlOptions && modalForm.preset !== 'custom' ? (
                          <>
                            <select
                              className="input ai-modal__input"
                              value={modalForm.customBaseUrl ? '__custom__' : modalForm.baseUrlPreset}
                              onChange={(e) => {
                                if (e.target.value === '__custom__') {
                                  setField('customBaseUrl', true);
                                  setField('baseUrl', modalForm.baseUrl || modalItem.defaultBaseUrl);
                                } else {
                                  setField('customBaseUrl', false);
                                  setField('baseUrlPreset', e.target.value);
                                  setField('baseUrl', e.target.value);
                                }
                              }}
                            >
                              {modalItem.baseUrlOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {t(opt.labelKey)}
                                </option>
                              ))}
                              <option value="__custom__">{t('adminAi.customEndpoint')}</option>
                            </select>
                            {modalForm.customBaseUrl && (
                              <input
                                className="input ai-modal__input"
                                type="url"
                                value={modalForm.baseUrl}
                                onChange={(e) => setField('baseUrl', e.target.value)}
                                placeholder={t('adminAi.baseUrlPlaceholder')}
                                required
                              />
                            )}
                          </>
                        ) : (
                          <input
                            className="input ai-modal__input"
                            type="url"
                            value={modalForm.baseUrl}
                            onChange={(e) => setField('baseUrl', e.target.value)}
                            placeholder={t('adminAi.baseUrlPlaceholder')}
                            required
                          />
                        )}
                      </label>

                      <label className="ai-field">
                        <span className="ai-field__label">{t('adminAi.apiKey')}</span>
                        <input
                          className="input ai-modal__input"
                          type="password"
                          autoComplete="off"
                          placeholder={
                          saved.configuredProviders.some((p) => p.preset === modalForm.preset)
                            ? t('adminAi.apiKeyKeep', {
                                masked:
                                  saved.configuredProviders.find((p) => p.preset === modalForm.preset)
                                    ?.apiKeyMasked ?? saved.apiKeyMasked,
                              })
                            : t('adminAi.apiKeyPlaceholder')
                          }
                          value={modalForm.apiKey}
                          onChange={(e) => setField('apiKey', e.target.value)}
                        />
                        {saved.configuredProviders.some((p) => p.preset === modalForm.preset) && (
                          <span className="ai-field__hint">{t('adminAi.apiKeyHint')}</span>
                        )}
                      </label>
                    </div>

                    <div className="ai-modal__advanced">
                      <button
                        type="button"
                        className={`ai-advanced-toggle${advancedOpen ? ' is-open' : ''}`}
                        aria-expanded={advancedOpen}
                        onClick={() => setAdvancedOpen((v) => !v)}
                      >
                        <svg
                          className="ai-advanced-toggle__chevron"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                        {t('adminAi.advanced')}
                      </button>

                      <div className={`ai-advanced-panel${advancedOpen ? ' is-open' : ''}`}>
                        <div className="ai-advanced-panel__content">
                          <p className="ai-advanced-panel__hint">
                            {modelsLoading
                              ? t('adminAi.modelsLoading')
                              : providerModels?.fetchedFromApi
                                ? t('adminAi.modelsFetched')
                                : t('adminAi.modelsBuiltin')}
                          </p>
                          <div className="ai-advanced-grid">
                            <label className="ai-field">
                              <span className="ai-field__label">{t('adminAi.visionModel')}</span>
                              {renderVisionModelField(advancedOpen ? 0 : -1)}
                            </label>
                            <label className="ai-field">
                              <span className="ai-field__label">{t('adminAi.structureModel')}</span>
                              {renderStructureModelField(advancedOpen ? 0 : -1)}
                            </label>
                            <label className="ai-field ai-field--full">
                              <span className="ai-field__label">{t('adminAi.ocrEngine')}</span>
                              <select
                                className="input ai-modal__input"
                                value={modalForm.ocrEngine}
                                onChange={(e) =>
                                  setField('ocrEngine', e.target.value as OcrEngineMode)
                                }
                                tabIndex={advancedOpen ? 0 : -1}
                              >
                                <option value="auto">{t('adminAi.ocrAuto')}</option>
                                <option value="vision">{t('adminAi.ocrVision')}</option>
                                <option value="tesseract">{t('adminAi.ocrTesseract')}</option>
                              </select>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {testResult && (
                      <p className={`ai-test-result${testResult.ok ? ' is-ok' : ' is-error'}`}>
                        {testResult.message}
                      </p>
                    )}
                  </>
                )
              )}
              </div>

              <footer className="ai-modal__footer">
                <div className="ai-modal__footer-left">
                  {modalForm.target !== 'local' && (
                    <>
                      {saved.configuredProviders.some((p) => p.preset === modalForm.preset) && (
                        <button
                          type="button"
                          className="ai-link-btn ai-link-btn--danger"
                          onClick={handleRevoke}
                          disabled={saving}
                        >
                          {t('adminAi.revoke')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="ai-link-btn"
                        onClick={handleTestConnection}
                        disabled={testing}
                      >
                        {testing ? t('adminAi.testing') : t('adminAi.testConnection')}
                      </button>
                    </>
                  )}
                </div>
                <div className="ai-modal__footer-right">
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? t('adminAi.saving') : t('adminAi.save')}
                  </button>
                </div>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
