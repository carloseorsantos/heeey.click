import { useMemo, useState } from 'react';
import { Check, Copy, Download, FileText, Plug, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { sceneToMarkdown } from '../lib/sceneMarkdown';
import { Modal, ModalIcon } from './Modal';
import { copyText } from './ShareModal';
import { Button } from './ui/Button';
import { useI18n } from '../i18n';

interface ExportForAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardTitle: string;
  /** File name without extension, already sanitized */
  fileName: string;
  /** Current canvas elements (not the last saved version) */
  getElements: () => readonly unknown[];
  onOpenMcpDocs?: () => void;
}

/**
 * "Export for AI": the board as Markdown to download or paste into any AI chat,
 * plus a pointer to the MCP for connecting the AI straight to Heeey.
 */
export function ExportForAIModal({ isOpen, onClose, boardTitle, fileName, getElements, onOpenMcpDocs }: ExportForAIModalProps) {
  const { t, locale } = useI18n();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  // Snapshot of the canvas each time the modal opens, computed before painting so no stale preview flashes
  const markdown = useMemo(() => {
    if (!isOpen) return null;
    return sceneToMarkdown(boardTitle, getElements(), {
      intro: t('exportAI.md.intro'),
      untitled: t('board.untitled'),
      content: t('exportAI.md.content'),
      outsideFrames: t('exportAI.md.outsideFrames'),
      connections: t('exportAI.md.connections'),
      untitledFrame: t('exportAI.md.untitledFrame'),
      emptyFrame: t('exportAI.md.emptyFrame'),
      image: t('exportAI.md.image'),
      unlabeled: t('exportAI.md.unlabeled'),
      link: t('exportAI.md.link'),
      ellipse: t('exportAI.md.ellipse'),
      diamond: t('exportAI.md.diamond'),
    });
    // getElements reads the live canvas; only a new opening (or language) takes a new snapshot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, boardTitle, locale]);

  // A new opening starts without the previous copy feedback
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setCopyState('idle');
  }

  function handleDownload() {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    if (!markdown) return;
    if (await copyText(markdown)) {
      setCopyState('copied');
      navigator.vibrate?.(10);
      setTimeout(() => setCopyState('idle'), 2000);
    } else {
      setCopyState('error');
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('exportAI.title')}
      icon={
        <ModalIcon>
          <Sparkles />
        </ModalIcon>
      }
      size="lg"
    >
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_19rem]">
        {/* Preview: plain text, the board content is untrusted */}
        <div className="order-2 sm:order-1 min-w-0">
          {markdown ? (
            <pre
              tabIndex={0}
              aria-label={t('exportAI.preview')}
              className="h-64 sm:h-[26rem] overflow-auto overscroll-contain rounded-xl bg-fill p-3.5 text-xs leading-relaxed font-mono text-label whitespace-pre-wrap break-words"
            >
              {markdown}
            </pre>
          ) : (
            <div
              role="status"
              className="h-40 sm:h-[26rem] rounded-xl bg-fill p-5 flex flex-col items-center justify-center gap-2 text-center"
            >
              <FileText className="w-6 h-6 text-label-3" />
              <p className="text-callout text-label-2 max-w-xs text-pretty">{t('exportAI.empty')}</p>
            </div>
          )}
        </div>

        <div className="order-1 sm:order-2 flex flex-col gap-4">
          <p className="text-callout text-label-2 text-pretty">{t('exportAI.description')}</p>

          <div className="rounded-xl bg-accent/10 p-3.5">
            <p className="flex items-center gap-1.5 text-callout font-semibold text-accent-text">
              <Plug className="w-4 h-4" />
              {t('exportAI.mcpTitle')}
            </p>
            <p className="mt-1 text-callout text-label-2 text-pretty">{t('exportAI.mcpText')}</p>
            {onOpenMcpDocs && (
              <Button variant="tinted" size="sm" className="mt-3" onClick={onOpenMcpDocs}>
                {t('exportAI.mcpLink')}
              </Button>
            )}
          </div>

          <div className="mt-auto flex flex-col gap-2">
            <Button variant="primary" onClick={handleDownload} disabled={!markdown}>
              <Download className="w-4 h-4" />
              <span>{t('exportAI.download')}</span>
            </Button>
            <Button
              variant="primary"
              onClick={handleCopy}
              disabled={!markdown}
              className={cn(copyState === 'copied' && 'bg-success hover:bg-success')}
            >
              {copyState === 'copied' ? <Check className="w-4 h-4" strokeWidth={2.75} /> : <Copy className="w-4 h-4" />}
              <span aria-live="polite">{copyState === 'copied' ? t('exportAI.copied') : t('exportAI.copy')}</span>
            </Button>
            {copyState === 'error' && (
              <p role="alert" className="text-xs text-danger-text">
                {t('exportAI.copyError')}
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
