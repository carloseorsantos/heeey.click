import { useEffect, useState } from 'react';
import { KeyRound, Copy, Check, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { ApiKey, createApiKey, listApiKeys, revokeApiKey } from '../lib/apiKeys';
import { formatDateRelative } from '../lib/utils';
import { useI18n } from '../i18n';

interface ApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard unavailable: the value stays selectable on screen
        }
      }}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white transition flex-shrink-0"
      aria-label={label}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      <span>{copied ? t('common.copied') : t('common.copy')}</span>
    </button>
  );
}

function mcpSnippets(key: string) {
  const url = `${window.location.origin}/api/mcp`;
  return {
    claudeCode: `claude mcp add --transport http heeey ${url} --header "Authorization: Bearer ${key}"`,
    json: JSON.stringify(
      { mcpServers: { heeey: { type: 'http', url, headers: { Authorization: `Bearer ${key}` } } } },
      null,
      2
    ),
  };
}

export function ApiKeysModal({ isOpen, onClose }: ApiKeysModalProps) {
  const { t } = useI18n();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [name, setName] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStatus('loading');
    setNewKey(null);
    setCreateError(null);
    setConfirmRevokeId(null);
    listApiKeys().then((result) => {
      setKeys(result);
      setStatus(result ? 'ready' : 'error');
    });
  }, [isOpen]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setCreateError(null);
    const result = await createApiKey(name, readOnly ? ['read'] : ['read', 'write']);
    setCreating(false);
    if ('error' in result) {
      setCreateError(result.error);
      return;
    }
    setNewKey(result.key);
    setName('');
    setReadOnly(false);
    setKeys(await listApiKeys());
  }

  async function handleRevoke(id: string) {
    if (await revokeApiKey(id)) {
      setKeys((prev) => prev?.filter((k) => k.id !== id) ?? null);
    }
    setConfirmRevokeId(null);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('apiKeys.title')}
      description={t('apiKeys.description')}
      icon={
        <div className="w-11 h-11 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/20 flex-shrink-0">
          <KeyRound className="w-5 h-5" />
        </div>
      }
    >
      <div className="space-y-5">
        {newKey && (
          <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 space-y-2" role="status">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {t('apiKeys.copyNow')}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 select-all">
                {newKey}
              </code>
              <CopyButton value={newKey} label={t('apiKeys.copyKey')} />
            </div>
            <details className="text-sm text-amber-900 dark:text-amber-200">
              <summary className="cursor-pointer font-semibold">{t('apiKeys.connectMcp')}</summary>
              <div className="mt-2 space-y-2">
                <p>Claude Code:</p>
                <div className="flex items-start gap-2">
                  <code className="flex-1 min-w-0 break-all px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100">
                    {mcpSnippets(newKey).claudeCode}
                  </code>
                  <CopyButton value={mcpSnippets(newKey).claudeCode} label={t('apiKeys.copyClaudeCode')} />
                </div>
                <p>{t('apiKeys.otherClients')}</p>
                <div className="flex items-start gap-2">
                  <pre className="flex-1 min-w-0 overflow-x-auto px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100">
                    {mcpSnippets(newKey).json}
                  </pre>
                  <CopyButton value={mcpSnippets(newKey).json} label={t('apiKeys.copyMcpConfig')} />
                </div>
              </div>
            </details>
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-3">
          <label htmlFor="api-key-name" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            {t('apiKeys.newKey')}
          </label>
          <div className="flex gap-2">
            <input
              id="api-key-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder={t('apiKeys.namePlaceholder')}
              className="flex-1 min-w-0 h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white transition disabled:opacity-60 flex-shrink-0"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{t('apiKeys.create')}</span>
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={readOnly}
              onChange={(e) => setReadOnly(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            {t('apiKeys.readOnly')}
          </label>
          {createError && (
            <p className="text-sm text-rose-700 dark:text-rose-400" role="alert">
              {createError}
            </p>
          )}
        </form>

        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">{t('apiKeys.active')}</p>
          {status === 'loading' ? (
            <p className="py-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400" role="status">
              <Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading')}
            </p>
          ) : status === 'error' ? (
            <p className="py-4 text-sm text-slate-600 dark:text-slate-400">{t('apiKeys.loadError')}</p>
          ) : keys && keys.length === 0 ? (
            <p className="py-4 text-sm text-slate-600 dark:text-slate-400">{t('apiKeys.none')}</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {keys?.map((key) => (
                <li key={key.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{key.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      <code>{key.prefix}…</code> · {key.scopes.includes('write') ? t('apiKeys.readWrite') : t('apiKeys.readOnlyShort')} ·{' '}
                      {key.last_used_at ? t('apiKeys.usedAt', { time: formatDateRelative(key.last_used_at) }) : t('apiKeys.neverUsed')}
                    </p>
                  </div>
                  {confirmRevokeId === key.id ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setConfirmRevokeId(null)}
                        className="px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        onClick={() => handleRevoke(key.id)}
                        className="px-2.5 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition"
                      >
                        {t('apiKeys.revoke')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRevokeId(key.id)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition flex-shrink-0"
                      aria-label={t('apiKeys.revokeKey', { name: key.name })}
                      title={t('apiKeys.revoke')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
