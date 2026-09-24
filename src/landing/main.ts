// Entry for the static landing pages: shared styles, theme and pageview tracking.
// The pages themselves are plain HTML so crawlers get the full content without JS.
import '../index.css';
import './landing.css';
import { initAnalytics } from '../lib/analytics';

initAnalytics();

// Picking a language in the switcher remembers it, the same key the app uses, so the other pages
// (and the app) open in that language next time. See the redirect script in each page's <head>.
document.querySelectorAll<HTMLAnchorElement>('a[data-locale]').forEach((link) => {
  link.addEventListener('click', () => {
    try {
      localStorage.setItem('heeey_locale', link.dataset.locale!);
    } catch {
      // Not persisted in private mode; the link still goes to the page
    }
  });
});
