import { useEffect, useState } from 'react';
import { KeyRound, Copy, Check, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { Modal, ModalIcon } from './Modal';
import { Button } from './ui/Button';
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
    <Button
      size="sm"
      variant={copied ? 'tinted' : 'secondary'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard unavailable: the value stays selectable on screen
        }
      }}
      className={copied ? 'bg-success/15 text-success hover:bg-success/15' : undefined}
      aria-label={label}
    >
      {copied ? <Check className="w-3.5 h-3.5" strokeWidth={2.75} /> : <Copy className="w-3.5 h-3.5" />}
      <span>{copied ? t('common.copied') : t('common.copy')}</span>
    </Button>
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
        <ModalIcon>
          <KeyRound />
        </ModalIcon>
      }
    >
      <div className="space-y-5">
        {newKey && (
          <div className="p-3 rounded-xl bg-warning/10 space-y-2.5" role="status">
            <p className="flex items-center gap-2 text-sm font-semibold text-label">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-warning" />
              {t('apiKeys.copyNow')}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate px-2.5 py-1.5 rounded-lg bg-surface text-xs font-mono text-label select-all">
                {newKey}
              </code>
              <CopyButton value={newKey} label={t('apiKeys.copyKey')} />
            </div>
            <details className="text-sm text-label-2">
              <summary className="cursor-pointer font-medium text-accent-text">{t('apiKeys.connectMcp')}</summary>
              <div className="mt-2 space-y-2">
                <p>Claude Code:</p>
                <div className="flex items-start gap-2">
                  <code className="flex-1 min-w-0 break-all px-2.5 py-1.5 rounded-lg bg-surface text-xs font-mono text-label">
                    {mcpSnippets(newKey).claudeCode}
                  </code>
                  <CopyButton value={mcpSnippets(newKey).claudeCode} label={t('apiKeys.copyClaudeCode')} />
                </div>
                <p>{t('apiKeys.otherClients')}</p>
                <div className="flex items-start gap-2">
                  <pre className="flex-1 min-w-0 overflow-x-auto px-2.5 py-1.5 rounded-lg bg-surface text-xs font-mono text-label">
                    {mcpSnippets(newKey).json}
                  </pre>
                  <CopyButton value={mcpSnippets(newKey).json} label={t('apiKeys.copyMcpConfig')} />
                </div>
              </div>
            </details>
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-3">
          <label htmlFor="api-key-name" className="block text-callout font-medium text-label">
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
              className="field flex-1 min-w-0"
            />
            <Button type="submit" variant="primary" disabled={creating || !name.trim()}>
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{t('apiKeys.create')}</span>
            </Button>
          </div>
          <label className="flex items-center gap-2 text-sm text-label-2">
            <input
              type="checkbox"
              checked={readOnly}
              onChange={(e) => setReadOnly(e.target.checked)}
              className="w-4 h-4 rounded accent-[rgb(var(--accent))]"
            />
            {t('apiKeys.readOnly')}
          </label>
          {createError && (
            <p className="text-sm text-danger-text" role="alert">
              {createError}
            </p>
          )}
        </form>

        <div>
          <p className="section-label px-1 mb-1.5">{t('apiKeys.active')}</p>
          {status === 'loading' ? (
            <p className="py-4 flex items-center gap-2 text-sm text-label-2" role="status">
              <Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading')}
            </p>
          ) : status === 'error' ? (
            <p className="py-4 text-sm text-label-2">{t('apiKeys.loadError')}</p>
          ) : keys && keys.length === 0 ? (
            <p className="py-4 px-1 text-sm text-label-2">{t('apiKeys.none')}</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto rounded-xl bg-fill divide-y divide-separator">
              {keys?.map((key) => (
                <li key={key.id} className="flex items-center gap-3 pl-3.5 pr-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-label truncate">{key.name}</p>
                    <p className="text-xs text-label-2 truncate">
                      <code>{key.prefix}…</code> · {key.scopes.includes('write') ? t('apiKeys.readWrite') : t('apiKeys.readOnlyShort')} ·{' '}
                      {key.last_used_at ? t('apiKeys.usedAt', { time: formatDateRelative(key.last_used_at) }) : t('apiKeys.neverUsed')}
                    </p>
                  </div>
                  {confirmRevokeId === key.id ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button size="sm" variant="plain" onClick={() => setConfirmRevokeId(null)}>
                        {t('common.cancel')}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleRevoke(key.id)}>
                        {t('apiKeys.revoke')}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      iconOnly
                      variant="danger-plain"
                      onClick={() => setConfirmRevokeId(key.id)}
                      aria-label={t('apiKeys.revokeKey', { name: key.name })}
                      title={t('apiKeys.revoke')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
