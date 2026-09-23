import { useEffect, useState } from 'react';
import { History, Loader2, RotateCcw, Palette } from 'lucide-react';
import { Modal } from './Modal';
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
        <div className="w-11 h-11 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/20 flex-shrink-0">
          <History className="w-5 h-5" />
        </div>
      }
    >
      {status === 'loading' ? (
        <div className="py-10 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400" role="status">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{t('history.loading')}</span>
        </div>
      ) : status === 'error' ? (
        <p className="py-8 text-center text-sm text-slate-600 dark:text-slate-400">
          {t('history.loadError')}
        </p>
      ) : versions && versions.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-600 dark:text-slate-400">
          {t('history.empty')}
        </p>
      ) : (
        <div className="space-y-3">
          {restoreError && (
            <p className="text-sm text-rose-700 dark:text-rose-400" role="alert">
              {t('history.restoreError')}
            </p>
          )}
          <ul className="space-y-2 max-h-[60vh] overflow-y-auto -mx-1 px-1">
            {versions?.map((version) => (
              <li
                key={version.id}
                className="flex items-center gap-3 p-2 rounded-xl border border-slate-200 dark:border-slate-800"
              >
                <div className="w-20 h-14 flex-shrink-0 rounded-lg bg-slate-50 dark:bg-slate-800/60 overflow-hidden flex items-center justify-center">
                  {version.thumbnail ? (
                    <img
                      src={version.thumbnail}
                      alt=""
                      className="w-full h-full object-contain p-1"
                      style={{ filter: isDark ? 'invert(93%) hue-rotate(180deg)' : undefined }}
                    />
                  ) : (
                    <Palette className="w-5 h-5 text-slate-400" aria-hidden="true" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">
                    {formatVersionDate(version.created_at)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {version.reason === 'before_restore' ? t('history.beforeRestore') : ''}
                    {t('history.elements', { count: version.element_count })} ·{' '}
                    {formatDateRelative(version.created_at)}
                  </p>
                </div>

                {confirmId === version.id ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setConfirmId(null)}
                      disabled={!!restoringId}
                      className="px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition disabled:opacity-50"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={() => handleRestore(version.id)}
                      disabled={!!restoringId}
                      className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white transition disabled:opacity-60"
                    >
                      {restoringId === version.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{t('common.confirm')}</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(version.id)}
                    disabled={!!restoringId}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-100 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800 transition flex-shrink-0 disabled:opacity-50"
                    aria-label={t('history.restoreVersion', { date: formatVersionDate(version.created_at) })}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('common.restore')}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('history.note')}
          </p>
        </div>
      )}
    </Modal>
  );
}
