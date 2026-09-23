import { useEffect, useState } from 'react';
import { History, Loader2, RotateCcw, Palette } from 'lucide-react';
import { Modal, ModalIcon } from './Modal';
import { Button } from './ui/Button';
import { useTheme } from '../hooks/useTheme';
import { listBoardVersions, BoardVersionSummary } from '../lib/boardVersions';
import { formatDateRelative } from '../lib/utils';
import { useI18n, getLocale } from '../i18n';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  onRestore: (versionId: string) => Promise<boolean>;
}

function formatVersionDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString(getLocale(), {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VersionHistoryModal({ isOpen, onClose, boardId, onRestore }: VersionHistoryModalProps) {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [versions, setVersions] = useState<BoardVersionSummary[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setStatus('loading');
    setConfirmId(null);
    setRestoreError(false);
    listBoardVersions(boardId).then((result) => {
      if (cancelled) return;
      setVersions(result);
      setStatus(result ? 'ready' : 'error');
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, boardId]);

  async function handleRestore(versionId: string) {
    setRestoringId(versionId);
    setRestoreError(false);
    const ok = await onRestore(versionId);
    setRestoringId(null);
    if (ok) {
      onClose();
    } else {
      setRestoreError(true);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !restoringId && onClose()}
      title={t('history.title')}
      description={t('history.description')}
      icon={
        <ModalIcon>
          <History />
        </ModalIcon>
      }
    >
      {status === 'loading' ? (
        <div className="py-10 flex items-center justify-center gap-2 text-sm text-label-2" role="status">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{t('history.loading')}</span>
        </div>
      ) : status === 'error' ? (
        <p className="py-8 text-center text-sm text-label-2">
          {t('history.loadError')}
        </p>
      ) : versions && versions.length === 0 ? (
        <p className="py-8 text-center text-sm text-label-2">
          {t('history.empty')}
        </p>
      ) : (
        <div className="space-y-3">
          {restoreError && (
            <p className="text-sm text-danger-text" role="alert">
              {t('history.restoreError')}
            </p>
          )}
          <ul className="max-h-[60vh] overflow-y-auto rounded-xl bg-fill divide-y divide-separator">
            {versions?.map((version) => (
              <li
                key={version.id}
                className="flex items-center gap-3 p-2 pr-2.5"
              >
                <div className="w-20 h-14 flex-shrink-0 rounded-lg bg-surface shadow-card overflow-hidden flex items-center justify-center">
                  {version.thumbnail ? (
                    <img
                      src={version.thumbnail}
                      alt=""
                      className="w-full h-full object-contain p-1"
                      style={{ filter: isDark ? 'invert(93%) hue-rotate(180deg)' : undefined }}
                    />
                  ) : (
                    <Palette className="w-5 h-5 text-label-3" aria-hidden="true" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-label">
                    {formatVersionDate(version.created_at)}
                  </p>
                  <p className="text-xs text-label-2">
                    {version.reason === 'before_restore' ? t('history.beforeRestore') : ''}
                    {t('history.elements', { count: version.element_count })} ·{' '}
                    {formatDateRelative(version.created_at)}
                  </p>
                </div>

                {confirmId === version.id ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="sm" variant="plain" onClick={() => setConfirmId(null)} disabled={!!restoringId}>
                      {t('common.cancel')}
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => handleRestore(version.id)} disabled={!!restoringId}>
                      {restoringId === version.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{t('common.confirm')}</span>
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="tinted"
                    onClick={() => setConfirmId(version.id)}
                    disabled={!!restoringId}
                    aria-label={t('history.restoreVersion', { date: formatVersionDate(version.created_at) })}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('common.restore')}</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <p className="px-1 text-xs text-label-2">
            {t('history.note')}
          </p>
        </div>
      )}
    </Modal>
  );
}
