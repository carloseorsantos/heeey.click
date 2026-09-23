// Entry for the static landing pages: shared styles, theme and pageview tracking.
// The pages themselves are plain HTML so crawlers get the full content without JS.
import '../index.css';
import './landing.css';
import { initAnalytics } from '../lib/analytics';

initAnalytics();
