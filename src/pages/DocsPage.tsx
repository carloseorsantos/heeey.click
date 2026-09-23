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
} from 'lucide-react';
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
import { HeeeyLogo } from '../components/Logo';
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

  return (
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setIsMobileMenuOpen((v) => !v)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition"
            aria-label={t('docs.menuToggle')}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-2.5 hover:opacity-85 transition group"
            title={t('docs.backToDashboard')}
          >
            <HeeeyLogo className="w-8 h-8 shadow-sm shadow-brand-500/20" />
            <div className="text-left">
              <span className="text-base font-black tracking-tight text-slate-900 dark:text-white leading-none block">
                heeey<span className="text-brand-600 dark:text-brand-400">.click</span>
              </span>
              <span className="text-[11px] font-semibold tracking-wide text-brand-600 dark:text-brand-400 uppercase">
                {t('docs.title')}
              </span>
            </div>
          </button>

          {/* Breadcrumbs for desktop */}
          {currentDoc && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 ml-4 pl-4 border-l border-slate-200 dark:border-slate-800 truncate">
              <span>{t('docs.title')}</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
              <span>{currentCategoryMeta ? t(currentCategoryMeta.labelKey as MessageKey) : currentDoc.category}</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px] lg:max-w-xs">
                {currentDoc.title}
              </span>
            </div>
          )}
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-2">
          {/* Back to App button */}
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{t('docs.backToDashboard')}</span>
          </button>

          {/* Theme switch */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition"
            aria-label={isDark ? t('dashboard.switchToLight') : t('dashboard.switchToDark')}
            title={isDark ? t('dashboard.switchToLight') : t('dashboard.switchToDark')}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Language switch */}
          <button
            onClick={() => setLocale(locale === 'pt-BR' ? 'en' : 'pt-BR')}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition"
            aria-label={`${t('language.label')}: ${t('language.switchTo')}`}
            title={t('language.switchTo')}
          >
            <Languages className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Layout (Sidebar + Content + TOC) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Backdrop */}
        {isMobileMenuOpen && (
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 lg:hidden"
            aria-hidden="true"
          />
        )}

        {/* Left Sidebar */}
        <aside
          className={`
            fixed lg:static top-16 bottom-0 left-0 z-30 w-72 sm:w-80 bg-slate-50 dark:bg-slate-900/70 border-r border-slate-200/80 dark:border-slate-800 flex flex-col flex-shrink-0 transition-transform duration-200 ease-in-out
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          {/* Quick Search inside Docs */}
          <div className="p-3.5 border-b border-slate-200/70 dark:border-slate-800/80">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('docs.searchPlaceholder')}
                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label={t('docs.clearSearch')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-6">
            {searchResults ? (
              <div>
                <p className="px-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  {searchResults.length === 0
                    ? t('docs.noResults', { query: searchQuery })
                    : t('docs.searchResultsCount', { count: searchResults.length })}
                </p>
                {searchResults.length === 0 ? (
                  <p className="px-2 py-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                    {t('docs.docNotFoundDesc')}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {searchResults.map(({ doc, matches }) => {
                      const isActive = doc.slug.toLowerCase() === currentSlug.toLowerCase();
                      return (
                        <button
                          key={doc.slug}
                          onClick={() => handleNavigateDoc(doc.slug)}
                          className={`
                            w-full text-left p-2.5 rounded-xl transition text-xs sm:text-sm flex flex-col gap-0.5
                            ${
                              isActive
                                ? 'bg-brand-600 text-white font-semibold shadow-sm'
                                : 'hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }
                          `}
                        >
                          <span className="font-medium line-clamp-1">{doc.title}</span>
                          {matches.snippet && (
                            <span
                              className={`text-[11px] line-clamp-2 ${
                                isActive ? 'text-brand-100' : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {matches.snippet}
                            </span>
                          )}
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
                  <div key={category.id} className="space-y-1">
                    <div className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <IconComponent className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                      <span>{t(category.labelKey as MessageKey)}</span>
                    </div>

                    <div className="space-y-0.5">
                      {docs.map((doc) => {
                        const isActive = doc.slug.toLowerCase() === currentSlug.toLowerCase();
                        return (
                          <button
                            key={doc.slug}
                            onClick={() => handleNavigateDoc(doc.slug)}
                            className={`
                              w-full text-left px-2.5 py-1.5 rounded-xl text-xs sm:text-sm transition flex items-center justify-between group
                              ${
                                isActive
                                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-bold border-l-2 border-brand-600 dark:border-brand-400 pl-2'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/60'
                              }
                            `}
                          >
                            <span className="truncate">{doc.title}</span>
                            {isActive && (
                              <ChevronRight className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono">heeey v0.1.0</span>
            <a
              href="https://github.com/carloseorsantos/heeey.click"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition"
              title="GitHub"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
          </div>
        </aside>

        {/* Central Article Container & Right TOC */}
        <main
          ref={mainContentRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-8 flex justify-center"
        >
          <div className={`w-full flex gap-8 xl:gap-10 ${(currentSlug === 'llms-full' ? fileSections.length > 0 : toc.length > 0) ? 'max-w-6xl xl:max-w-7xl' : 'max-w-4xl'}`}>
            {/* Article Content */}
            <article className="flex-1 min-w-0">
              {currentDoc ? (
                <>
                  {/* Article Header */}
                  <div className="mb-8">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800/60">
                        {currentCategoryMeta ? t(currentCategoryMeta.labelKey as MessageKey) : currentDoc.category}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{t('docs.readingTime', { minutes: readingTime })}</span>
                      </span>
                      {currentSlug === 'llms-full' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          <FileText className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                          <span>23 documentos integrados</span>
                        </span>
                      )}
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-3">
                      {currentDoc.title}
                    </h1>

                    {currentDoc.description && (
                      <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                        {currentDoc.description}
                      </p>
                    )}

                    {/* Dedicated Control Panel for llms-full */}
                    {currentSlug === 'llms-full' && (
                      <div className="my-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-brand-50/20 dark:from-slate-900/80 dark:to-brand-950/20 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                              Ações para IA & Leitor
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={handleCopyFull}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition cursor-pointer"
                              title="Copiar dump completo para a área de transferência"
                            >
                              {copiedFull ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                                  <span>Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copiar Dump Completo</span>
                                </>
                              )}
                            </button>
                            <a
                              href="/llms-full.txt"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition"
                              title="Abrir arquivo de texto puro"
                            >
                              <span>Ver Texto Puro (.txt)</span>
                              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleNavigateDoc('llms')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800/80 transition"
                              title="Ir para o índice estruturado"
                            >
                              <span>Índice llms.txt</span>
                            </button>
                          </div>
                        </div>

                        {/* Quick Jump Bar */}
                        {fileSections.length > 0 && (
                          <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800/80 space-y-2">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              Pular diretamente para um documento:
                            </p>
                            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                              {fileSections.map((sec) => (
                                <a
                                  key={sec.id}
                                  href={`#${sec.id}`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const el = document.getElementById(sec.id);
                                    if (el) {
                                      el.scrollIntoView({ behavior: 'smooth' });
                                      window.history.pushState(null, '', `#${sec.id}`);
                                      setActiveId(sec.id);
                                    }
                                  }}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition shadow-2xs truncate max-w-[240px] ${
                                    activeId === sec.id
                                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border-brand-300 dark:border-brand-700 font-semibold'
                                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:border-brand-300 dark:hover:border-brand-700 border-slate-200 dark:border-slate-700'
                                  }`}
                                  title={sec.title}
                                >
                                  <FileText className={`w-3 h-3 flex-shrink-0 ${activeId === sec.id ? 'text-brand-600 dark:text-brand-400' : 'opacity-60'}`} />
                                  <span className="truncate">{sec.title}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Rendered Markdown Body */}
                  <MarkdownRenderer
                    content={currentDoc.content}
                    currentSlug={currentSlug}
                    onNavigate={handleNavigateDoc}
                    onNavigateToBoard={onNavigateToBoard}
                    onBackToDashboard={onBackToDashboard}
                  />

                  {/* Next / Previous Navigation Footer */}
                  <div className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {adjacent.prev ? (
                      <button
                        onClick={() => handleNavigateDoc(adjacent.prev!.slug)}
                        className="text-left p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-brand-400 dark:hover:border-brand-600 bg-white dark:bg-slate-900/40 hover:bg-brand-50/30 dark:hover:bg-brand-950/20 transition group"
                      >
                        <span className="flex items-center gap-1 text-xs font-semibold text-slate-400 dark:text-slate-500 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>{t('docs.previousDoc')}</span>
                        </span>
                        <span className="block text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition truncate">
                          {adjacent.prev.title}
                        </span>
                      </button>
                    ) : <div />}

                    {adjacent.next ? (
                      <button
                        onClick={() => handleNavigateDoc(adjacent.next!.slug)}
                        className="text-right p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-brand-400 dark:hover:border-brand-600 bg-white dark:bg-slate-900/40 hover:bg-brand-50/30 dark:hover:bg-brand-950/20 transition group"
                      >
                        <span className="flex items-center justify-end gap-1 text-xs font-semibold text-slate-400 dark:text-slate-500 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">
                          <span>{t('docs.nextDoc')}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                        <span className="block text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition truncate">
                          {adjacent.next.title}
                        </span>
                      </button>
                    ) : <div />}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    {t('docs.docNotFound')}
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                    {t('docs.docNotFoundDesc')}
                  </p>
                  <button
                    onClick={() => handleNavigateDoc('getting-started')}
                    className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-md transition"
                  >
                    {t('docs.goToHome')}
                  </button>
                </div>
              )}
            </article>

            {/* Right Table of Contents (Desktop Only) */}
            {(currentSlug === 'llms-full' ? fileSections.length > 0 : toc.length > 0) && (
              <aside className="hidden xl:block w-64 flex-shrink-0">
                <div className="sticky top-8 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {currentSlug === 'llms-full' ? 'Documentos Fonte' : t('docs.onThisPage')}
                    </p>
                    {currentSlug === 'llms-full' && (
                      <span className="text-[10px] font-mono font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/80 px-1.5 py-0.5 rounded border border-brand-200/60 dark:border-brand-800/60">
                        {fileSections.length} arquivos
                      </span>
                    )}
                  </div>
                  <nav className="space-y-1 max-h-[calc(100vh-10rem)] overflow-y-auto text-xs pr-2">
                    {currentSlug === 'llms-full'
                      ? fileSections.map((sec) => {
                          const isSectionActive = activeId === sec.id;
                          return (
                            <a
                              key={sec.id}
                              href={`#${sec.id}`}
                              onClick={(e) => {
                                e.preventDefault();
                                const el = document.getElementById(sec.id);
                                if (el) {
                                  el.scrollIntoView({ behavior: 'smooth' });
                                  window.history.pushState(null, '', `#${sec.id}`);
                                  setActiveId(sec.id);
                                }
                              }}
                              className={`block py-1.5 px-2.5 rounded-xl transition ${
                                isSectionActive
                                  ? 'bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 font-bold border-l-2 border-brand-500 shadow-2xs'
                                  : 'text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                              }`}
                              title={sec.title}
                            >
                              <span className="font-semibold block truncate leading-tight">{sec.title}</span>
                              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 block truncate mt-0.5">
                                {sec.filePath}
                              </span>
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
                                const el = document.getElementById(item.id);
                                if (el) {
                                  el.scrollIntoView({ behavior: 'smooth' });
                                  window.history.pushState(null, '', `#${item.id}`);
                                  setActiveId(item.id);
                                }
                              }}
                              className={`block py-1 px-2 rounded-lg transition truncate ${
                                isHeadingActive
                                  ? 'bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 font-bold border-l-2 border-brand-500'
                                  : item.level === 3
                                  ? 'pl-3 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400'
                                  : 'text-slate-700 dark:text-slate-300 font-medium hover:text-brand-600 dark:hover:text-brand-400'
                              }`}
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

        {/* Floating Back to Top Button */}
        {showScrollTop && (
          <button
            type="button"
            onClick={() => mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 z-30 px-3.5 py-2 rounded-full bg-white/95 dark:bg-slate-800/95 text-slate-700 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all flex items-center gap-1.5 text-xs font-semibold backdrop-blur-sm cursor-pointer"
            aria-label="Voltar ao topo"
            title="Voltar ao topo"
          >
            <ArrowUp className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>Topo</span>
          </button>
        )}
      </div>
    </div>
  );
}
export default DocsPage;
