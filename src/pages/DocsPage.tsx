import { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen,
  ArrowLeft,
  Search,
  X,
  Sun,
  Moon,
  Languages,
  Menu,
  Clock,
  ChevronRight,
  ExternalLink,
  ChevronLeft,
  Compass,
  Palette,
  Code2,
  Bot,
  FileText,
  Copy,
  Check,
  ArrowUp,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import {
  DOC_CATEGORIES,
  DocCategory,
  getDocBySlug,
  normalizeSlug,
  getAdjacentDocs,
  getDocsGroupedByCategory,
  searchDocs,
  extractToc,
  extractDocFiles,
  calculateReadingTime,
  slugify,
} from '../lib/docsData';
import { MarkdownRenderer } from '../components/docs/MarkdownRenderer';
import { HeeeyWordmark } from '../components/Logo';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import { project, spring } from '../lib/motion';
import { useTheme } from '../hooks/useTheme';
import { useI18n, type MessageKey } from '../i18n';

interface DocsPageProps {
  slug?: string;
  initialSlug?: string;
  onNavigateDoc?: (slug: string) => void;
  onBackToDashboard: () => void;
  onNavigateToBoard?: (boardId: string) => void;
}

const CATEGORY_ICONS: Record<DocCategory, typeof Compass> = {
  overview: Compass,
  features: Palette,
  api: Code2,
  mcp: Bot,
  llms: FileText,
};

export function DocsPage({
  slug: propSlug,
  initialSlug,
  onNavigateDoc,
  onBackToDashboard,
  onNavigateToBoard,
}: DocsPageProps) {
  const { isDark, toggleTheme } = useTheme();
  const { t, locale, setLocale } = useI18n();

  const [internalSlug, setInternalSlug] = useState(() =>
    normalizeSlug(propSlug || initialSlug)
  );

  const currentSlug = propSlug ? normalizeSlug(propSlug) : internalSlug;

  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  // Sync internal slug if propSlug or initialSlug changes
  useEffect(() => {
    if (propSlug) {
      setInternalSlug(normalizeSlug(propSlug));
    } else if (initialSlug) {
      setInternalSlug(normalizeSlug(initialSlug));
    }
  }, [propSlug, initialSlug]);

  // Handle browser back/forward if onNavigateDoc is not driving the route
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const match = path.match(/^\/docs(?:\/(.+))?$/);
      if (match) {
        setInternalSlug(normalizeSlug(match[1] || 'getting-started'));
      }
      if (window.location.hash) {
        const hash = window.location.hash.slice(1);
        const targetEl =
          document.getElementById(hash) ||
          document.getElementById(slugify(hash)) ||
          document.getElementById(`file-${slugify(hash)}`) ||
          document.getElementById(`file-${normalizeSlug(hash).replace(/\//g, '-')}`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen]);

  // Handle hash scrolling on slug change or initial load
  useEffect(() => {
    if (window.location.hash) {
      const hash = window.location.hash.slice(1);
      if (hash) {
        const timer = setTimeout(() => {
          const targetEl =
            document.getElementById(hash) ||
            document.getElementById(slugify(hash)) ||
            document.getElementById(`file-${slugify(hash)}`) ||
            document.getElementById(`file-${normalizeSlug(hash).replace(/\//g, '-')}`) ||
            (mainContentRef.current?.querySelector(`[id^="${CSS.escape(hash)}"]`) as HTMLElement | null);

          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }
        }, 150);
        return () => clearTimeout(timer);
      }
    } else if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentSlug]);

  const currentDoc = useMemo(() => getDocBySlug(currentSlug), [currentSlug]);

  // Set document title
  useEffect(() => {
    if (currentDoc) {
      document.title = `${currentDoc.title} — Heeey Docs`;
    } else {
      document.title = `${t('docs.title')} — Heeey`;
    }
  }, [currentDoc, t]);

  const handleNavigateDoc = (slug: string) => {
    const normalized = normalizeSlug(slug);
    setIsMobileMenuOpen(false);
    if (onNavigateDoc) {
      onNavigateDoc(normalized);
    } else {
      setInternalSlug(normalized);
      const newPath = `/docs/${normalized}`;
      if (window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
      }
    }
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const adjacent = useMemo(() => getAdjacentDocs(currentSlug), [currentSlug]);
  const toc = useMemo(() => (currentDoc ? extractToc(currentDoc.content) : []), [currentDoc]);
  const fileSections = useMemo(
    () => (currentSlug === 'llms-full' && currentDoc ? extractDocFiles(currentDoc.content) : []),
    [currentSlug, currentDoc]
  );
  const [copiedFull, setCopiedFull] = useState(false);
  const [activeId, setActiveId] = useState<string>('');
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = () => {
    if (!mainContentRef.current) return;
    const { scrollTop } = mainContentRef.current;
    setShowScrollTop(scrollTop > 400);

    const elementsToTrack =
      currentSlug === 'llms-full'
        ? fileSections.map((s) => s.id)
        : toc.map((t) => t.id);

    if (elementsToTrack.length === 0) return;

    const mainRect = mainContentRef.current.getBoundingClientRect();
    let currentActive = elementsToTrack[0];

    for (const id of elementsToTrack) {
      const el = document.getElementById(id);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= mainRect.top + 160) {
          currentActive = id;
        } else {
          break;
        }
      }
    }

    setActiveId(currentActive);
  };

  const handleCopyFull = async () => {
    if (!currentDoc) return;
    let copied = false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(currentDoc.content);
        copied = true;
      }
    } catch {
      // fallback to execCommand below
    }
    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = currentDoc.content;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        // ignore
      }
    }
    if (copied) {
      setCopiedFull(true);
      setTimeout(() => setCopiedFull(false), 2500);
    }
  };

  const readingTime = useMemo(
    () => (currentDoc ? calculateReadingTime(currentDoc.content) : 1),
    [currentDoc]
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchDocs(searchQuery);
  }, [searchQuery]);

  const groupedDocs = useMemo(() => getDocsGroupedByCategory(), []);

  const currentCategoryMeta = useMemo(() => {
    if (!currentDoc) return null;
    return DOC_CATEGORIES.find((c) => c.id === currentDoc.category);
  }, [currentDoc]);

  const hasToc = currentSlug === 'llms-full' ? fileSections.length > 0 : toc.length > 0;

  function jumpTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth' });
    window.history.pushState(null, '', `#${id}`);
    setActiveId(id);
  }

  function handleDrawerDragEnd(_: unknown, info: PanInfo) {
    const width = drawerRef.current?.offsetWidth ?? 300;
    // Close when the flick is heading far enough to the left
    if (info.velocity.x <= 0 && info.offset.x + project(info.velocity.x) < -width * 0.4) {
      setIsMobileMenuOpen(false);
    }
  }

  const navigation = (
    <>
      {/* Quick search inside docs */}
      <div className="p-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-label-2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('docs.searchPlaceholder')}
            className="field h-9 pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-label-3 hover:text-label-2"
              aria-label={t('docs.clearSearch')}
            >
              <XCircle className="w-4 h-4" fill="currentColor" stroke="rgb(var(--surface))" />
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-5">
        {searchResults ? (
          <div>
            <p className="px-2 section-label mb-1.5">
              {searchResults.length === 0
                ? t('docs.noResults', { query: searchQuery })
                : t('docs.searchResultsCount', { count: searchResults.length })}
            </p>
            {searchResults.length === 0 ? (
              <p className="px-2 py-4 text-xs text-label-2 text-center">{t('docs.docNotFoundDesc')}</p>
            ) : (
              <div className="space-y-0.5">
                {searchResults.map(({ doc, matches }) => {
                  const isActive = doc.slug.toLowerCase() === currentSlug.toLowerCase();
                  return (
                    <button
                      key={doc.slug}
                      onClick={() => handleNavigateDoc(doc.slug)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'w-full text-left px-2.5 py-2 rounded-lg transition-colors duration-100 flex flex-col gap-0.5',
                        isActive ? 'bg-fill-2' : 'hover:bg-fill'
                      )}
                    >
                      <span className="text-sm font-medium text-label line-clamp-1">{doc.title}</span>
                      {matches.snippet && <span className="text-xs text-label-2 line-clamp-2">{matches.snippet}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          groupedDocs.map(({ category, docs }) => {
            const IconComponent = CATEGORY_ICONS[category.id] || Compass;
            return (
              <div key={category.id}>
                <div className="flex items-center gap-1.5 px-2 mb-1 section-label">
                  <IconComponent className="w-3.5 h-3.5" />
                  <span>{t(category.labelKey as MessageKey)}</span>
                </div>
                <div className="space-y-0.5">
                  {docs.map((doc) => {
                    const isActive = doc.slug.toLowerCase() === currentSlug.toLowerCase();
                    return (
                      <button
                        key={doc.slug}
                        onClick={() => handleNavigateDoc(doc.slug)}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'w-full h-8 text-left px-2.5 rounded-lg text-sm transition-colors duration-100 flex items-center',
                          isActive ? 'bg-fill-2 text-label font-medium' : 'text-label-2 hover:text-label hover:bg-fill'
                        )}
                      >
                        <span className="truncate">{doc.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </nav>

      <div className="px-4 py-3 border-t border-separator flex items-center justify-between text-xs text-label-2">
        <span className="font-mono">heeey v0.1.0</span>
        <a
          href="https://github.com/carloseorsantos/heeey.click"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:text-label transition-colors"
        >
          <span>GitHub</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </>
  );

  return (
    <div className="h-screen w-screen flex bg-app text-label overflow-hidden">
      {/* Sidebar (wide screens) */}
      <aside className="hidden lg:flex w-72 flex-shrink-0 flex-col material-sidebar border-r border-separator">
        <div className="h-14 flex items-center px-4 flex-shrink-0">
          <button onClick={onBackToDashboard} className="pressable flex items-center gap-2 rounded-lg -mx-1 px-1 py-1" title={t('docs.backToDashboard')}>
            <HeeeyWordmark />
            <span className="text-[0.9375rem] font-semibold text-label-2">{t('docs.title')}</span>
          </button>
        </div>
        {navigation}
      </aside>

      {/* Drawer (narrow screens): drag it back to the edge it came from */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div key="drawer" className="lg:hidden fixed inset-0 z-40">
            <motion.div
              aria-hidden="true"
              className="absolute inset-0 bg-[var(--scrim)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.aside
              ref={drawerRef}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={spring.momentum}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 1, right: 0.04 }}
              onDragEnd={handleDrawerDragEnd}
              className="absolute inset-y-0 left-0 w-[min(20rem,85vw)] flex flex-col material-thick shadow-sheet pt-[env(safe-area-inset-top)]"
            >
              <div className="h-14 flex items-center justify-between px-4 flex-shrink-0">
                <HeeeyWordmark />
                <Button variant="plain" iconOnly size="sm" onClick={() => setIsMobileMenuOpen(false)} aria-label={t('common.close')}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {navigation}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Toolbar */}
        <header className="h-14 flex-shrink-0 material-chrome shadow-[0_0.5px_0_var(--separator)] px-3 sm:px-6 flex items-center justify-between gap-3 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="plain"
              iconOnly
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden"
              aria-label={t('docs.menuToggle')}
              aria-expanded={isMobileMenuOpen}
            >
              <Menu className="w-5 h-5" />
            </Button>
            {currentDoc && (
              <div className="flex items-center gap-1.5 text-callout text-label-2 min-w-0">
                <span className="hidden sm:inline truncate">
                  {currentCategoryMeta ? t(currentCategoryMeta.labelKey as MessageKey) : currentDoc.category}
                </span>
                <ChevronRight className="hidden sm:block w-3.5 h-3.5 text-label-3 flex-shrink-0" />
                <span className="font-medium text-label truncate">{currentDoc.title}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="plain" iconOnly onClick={toggleTheme} aria-label={isDark ? t('dashboard.switchToLight') : t('dashboard.switchToDark')} title={isDark ? t('dashboard.switchToLight') : t('dashboard.switchToDark')}>
              {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </Button>
            <Button
              variant="plain"
              iconOnly
              onClick={() => setLocale(locale === 'pt-BR' ? 'en' : 'pt-BR')}
              aria-label={`${t('language.label')}: ${t('language.switchTo')}`}
              title={t('language.switchTo')}
            >
              <Languages className="w-[18px] h-[18px]" />
            </Button>
            <Button variant="secondary" size="sm" onClick={onBackToDashboard} className="ml-1">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{t('docs.backToDashboard')}</span>
            </Button>
          </div>
        </header>

        <main ref={mainContentRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-10 flex justify-center">
          <div className={cn('w-full flex gap-10 xl:gap-12', hasToc ? 'max-w-6xl' : 'max-w-3xl')}>
            <article className="flex-1 min-w-0 max-w-3xl">
              {currentDoc ? (
                <>
                  <div className="mb-10">
                    <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-label-2">
                      <span className="font-semibold text-accent-text">
                        {currentCategoryMeta ? t(currentCategoryMeta.labelKey as MessageKey) : currentDoc.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{t('docs.readingTime', { minutes: readingTime })}</span>
                      </span>
                      {currentSlug === 'llms-full' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{t('docs.integratedDocs', { count: fileSections.length })}</span>
                        </>
                      )}
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-bold text-label mb-3 text-balance">{currentDoc.title}</h1>

                    {currentDoc.description && (
                      <p className="text-lg text-label-2 text-pretty">{currentDoc.description}</p>
                    )}

                    {currentSlug === 'llms-full' && (
                      <div className="mt-6 p-4 rounded-2xl bg-surface shadow-card space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="section-label">{t('docs.aiActions')}</span>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button variant="primary" size="sm" onClick={handleCopyFull} title={t('docs.copyFullDumpTitle')}>
                              {copiedFull ? <Check className="w-3.5 h-3.5" strokeWidth={2.75} /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedFull ? t('docs.copied') : t('docs.copyFullDump')}</span>
                            </Button>
                            <a
                              href="/llms-full.txt"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="pressable inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-callout font-semibold bg-fill text-label hover:bg-fill-2"
                            >
                              <span>{t('docs.viewPlainText')}</span>
                              <ExternalLink className="w-3.5 h-3.5 text-label-2" />
                            </a>
                            <Button variant="tinted" size="sm" onClick={() => handleNavigateDoc('llms')}>
                              {t('docs.llmsIndex')}
                            </Button>
                          </div>
                        </div>

                        {fileSections.length > 0 && (
                          <div className="pt-3 border-t border-separator space-y-2">
                            <p className="section-label">{t('docs.jumpToDoc')}</p>
                            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                              {fileSections.map((sec) => (
                                <a
                                  key={sec.id}
                                  href={`#${sec.id}`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    jumpTo(sec.id);
                                  }}
                                  className={cn(
                                    'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs transition-colors truncate max-w-[240px]',
                                    activeId === sec.id ? 'bg-accent text-white' : 'bg-fill text-label hover:bg-fill-2'
                                  )}
                                  title={sec.title}
                                >
                                  <FileText className="w-3 h-3 flex-shrink-0 opacity-70" />
                                  <span className="truncate">{sec.title}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <MarkdownRenderer
                    content={currentDoc.content}
                    currentSlug={currentSlug}
                    onNavigate={handleNavigateDoc}
                    onNavigateToBoard={onNavigateToBoard}
                    onBackToDashboard={onBackToDashboard}
                  />

                  {/* Previous / next */}
                  <div className="mt-16 pt-8 border-t border-separator grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {adjacent.prev ? (
                      <button
                        onClick={() => handleNavigateDoc(adjacent.prev!.slug)}
                        className="pressable text-left p-4 rounded-2xl bg-surface shadow-card hover:shadow-card-hover"
                      >
                        <span className="flex items-center gap-1 text-xs text-label-2">
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>{t('docs.previousDoc')}</span>
                        </span>
                        <span className="block text-sm font-semibold text-accent-text mt-1 truncate">{adjacent.prev.title}</span>
                      </button>
                    ) : (
                      <div />
                    )}
                    {adjacent.next ? (
                      <button
                        onClick={() => handleNavigateDoc(adjacent.next!.slug)}
                        className="pressable text-right p-4 rounded-2xl bg-surface shadow-card hover:shadow-card-hover"
                      >
                        <span className="flex items-center justify-end gap-1 text-xs text-label-2">
                          <span>{t('docs.nextDoc')}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                        <span className="block text-sm font-semibold text-accent-text mt-1 truncate">{adjacent.next.title}</span>
                      </button>
                    ) : (
                      <div />
                    )}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center max-w-md mx-auto">
                  <div className="w-14 h-14 rounded-2xl bg-fill text-label-2 flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-7 h-7" strokeWidth={1.75} />
                  </div>
                  <h2 className="text-xl font-semibold text-label mb-1">{t('docs.docNotFound')}</h2>
                  <p className="text-sm text-label-2 mb-6">{t('docs.docNotFoundDesc')}</p>
                  <Button variant="primary" onClick={() => handleNavigateDoc('getting-started')}>
                    {t('docs.goToHome')}
                  </Button>
                </div>
              )}
            </article>

            {/* On this page (wide screens) */}
            {hasToc && (
              <aside className="hidden xl:block w-60 flex-shrink-0">
                <div className="sticky top-0 space-y-2">
                  <div className="flex items-center justify-between px-2">
                    <p className="section-label">
                      {currentSlug === 'llms-full' ? t('docs.sourceDocs') : t('docs.onThisPage')}
                    </p>
                    {currentSlug === 'llms-full' && (
                      <span className="text-2xs text-label-2 tabular-nums">{t('docs.filesCount', { count: fileSections.length })}</span>
                    )}
                  </div>
                  <nav className="max-h-[calc(100vh-10rem)] overflow-y-auto border-l border-separator ml-2">
                    {currentSlug === 'llms-full'
                      ? fileSections.map((sec) => {
                          const isSectionActive = activeId === sec.id;
                          return (
                            <a
                              key={sec.id}
                              href={`#${sec.id}`}
                              onClick={(e) => {
                                e.preventDefault();
                                jumpTo(sec.id);
                              }}
                              className={cn(
                                'block -ml-px py-1.5 pl-3 pr-2 border-l text-xs transition-colors',
                                isSectionActive ? 'border-accent text-label' : 'border-transparent text-label-2 hover:text-label'
                              )}
                              title={sec.title}
                            >
                              <span className={cn('block truncate', isSectionActive && 'font-medium')}>{sec.title}</span>
                              <span className="text-2xs font-mono text-label-3 block truncate mt-0.5">{sec.filePath}</span>
                            </a>
                          );
                        })
                      : toc.map((item) => {
                          const isHeadingActive = activeId === item.id;
                          return (
                            <a
                              key={item.id}
                              href={`#${item.id}`}
                              onClick={(e) => {
                                e.preventDefault();
                                jumpTo(item.id);
                              }}
                              className={cn(
                                'block -ml-px py-1 pr-2 border-l text-xs transition-colors truncate',
                                item.level === 3 ? 'pl-6' : 'pl-3',
                                isHeadingActive ? 'border-accent text-label font-medium' : 'border-transparent text-label-2 hover:text-label'
                              )}
                              title={item.text}
                            >
                              {item.text}
                            </a>
                          );
                        })}
                  </nav>
                </div>
              </aside>
            )}
          </div>
        </main>

        {/* Back to top */}
        <AnimatePresence>
          {showScrollTop && (
            <motion.button
              key="top"
              type="button"
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.9 }}
              transition={spring.snappy}
              onClick={() => mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              className="fixed bottom-6 right-6 z-30 h-9 px-3.5 rounded-full material-regular shadow-popover text-label flex items-center gap-1.5 text-callout font-medium"
              aria-label={t('docs.backToTop')}
            >
              <ArrowUp className="w-4 h-4" />
              <span>{t('docs.top')}</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
export default DocsPage;
