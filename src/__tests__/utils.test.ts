import { describe, it, expect, vi } from 'vitest';
import {
  generateId,
  getRandomCollaboratorColor,
  generateGuestName,
  getInitials,
  formatDateRelative,
  debounce,
  throttle,
  getBrainstormingTemplate,
  getFlowchartTemplate,
  getWireframeTemplate,
  fitTextHeights,
} from '../lib/utils';
import { t } from '../i18n';


describe('utils', () => {
  it('generateId should produce a valid UUID string', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('getRandomCollaboratorColor should return background and stroke hex colors', () => {
    const color = getRandomCollaboratorColor();
    expect(color.background).toMatch(/^#[0-9a-f]{6}$/i);
    expect(color.stroke).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('getRandomCollaboratorColor with seed should be deterministic', () => {
    const colorA = getRandomCollaboratorColor('user-123');
    const colorB = getRandomCollaboratorColor('user-123');
    expect(colorA).toEqual(colorB);
  });

  it('generateGuestName should return non-empty name with number', () => {
    const name = generateGuestName();
    expect(name).toMatch(/\w+\s+#\d+/);
  });

  it('getInitials should extract uppercase initials correctly', () => {
    expect(getInitials('Carlos Santos')).toBe('CS');
    expect(getInitials('Lobo')).toBe('LO');
    expect(getInitials('')).toBe('??');
    expect(getInitials('Leão #83')).toBe('LE');
  });

  it('formatDateRelative should format recent dates appropriately', () => {
    const now = new Date();
    expect(formatDateRelative(now.toISOString(), 'pt-BR')).toBe('agora mesmo');
    expect(formatDateRelative(now.toISOString(), 'en-US')).toBe('just now');

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    expect(formatDateRelative(tenMinutesAgo.toISOString(), 'pt-BR')).toBe('há 10 minutos');
    expect(formatDateRelative(tenMinutesAgo.toISOString(), 'en-US')).toBe('10 minutes ago');

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatDateRelative(twoHoursAgo.toISOString(), 'pt-BR')).toBe('há 2 horas');

    const yesterday = new Date(Date.now() - 26 * 60 * 60 * 1000);
    expect(formatDateRelative(yesterday.toISOString(), 'en-US')).toBe('yesterday');
    expect(formatDateRelative('not a date', 'pt-BR')).toBe('recentemente');
  });

  it('debounce should delay invocation and cancel if needed', async () => {
    vi.useFakeTimers();
    const mockFn = vi.fn();
    const debounced = debounce(mockFn, 200);

    debounced('a');
    debounced('b');
    debounced('c');

    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('c');

    // Test cancel
    debounced('d');
    debounced.cancel();
    vi.advanceTimersByTime(250);
    expect(mockFn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('debounce.flush should run the pending call immediately, once', () => {
    vi.useFakeTimers();
    const mockFn = vi.fn();
    const debounced = debounce(mockFn, 200);

    debounced.flush();
    expect(mockFn).not.toHaveBeenCalled();

    debounced('x');
    debounced.flush();
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('x');

    vi.advanceTimersByTime(250);
    expect(mockFn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('throttle should limit execution rate and process trailing call', async () => {
    vi.useFakeTimers();
    const mockFn = vi.fn();
    const throttled = throttle(mockFn, 100);

    throttled('first');
    expect(mockFn).toHaveBeenCalledWith('first');
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Call rapidly within limit window
    throttled('second');
    throttled('third');
    expect(mockFn).toHaveBeenCalledTimes(1); // not yet

    vi.advanceTimersByTime(110);
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenLastCalledWith('third');

    vi.useRealTimers();
  });

  it('starter templates should generate valid Excalidraw elements', () => {
    const brainstorming = getBrainstormingTemplate();
    expect(brainstorming.length).toBeGreaterThan(2);
    expect(brainstorming[0].type).toBe('text');
    expect(brainstorming.some((el) => el.type === 'rectangle')).toBe(true);

    // Multi-line template texts get a box tall enough for every line
    for (const el of brainstorming.filter((e) => e.type === 'text')) {
      expect(el.height).toBe(el.text.split('\n').length * el.fontSize * el.lineHeight);
    }

    const flowchart = getFlowchartTemplate();
    expect(flowchart.length).toBeGreaterThan(2);
    expect(flowchart.some((el) => el.type === 'arrow')).toBe(true);

    const wireframe = getWireframeTemplate();
    expect(wireframe.length).toBeGreaterThan(4);
    expect(wireframe.some((el) => el.text && el.text.includes('Heeey'))).toBe(true);
    // Nav stays inside the header bar (x 80 → 760) whatever its length
    const nav = wireframe.find((el) => el.text === t('templates.wireframe.nav'));
    expect(nav.x + nav.width).toBeLessThanOrEqual(760);
  });

  it('fitTextHeights grows only free-standing text boxes that are too small', () => {
    const short = { type: 'text', text: 'a\nb\nc', fontSize: 16, lineHeight: 1.25, width: 5, height: 24, containerId: null };
    const bound = { ...short, containerId: 'rect-1' };
    const rect = { type: 'rectangle', height: 10 };
    const [fixed, keptBound, keptRect] = fitTextHeights<Record<string, any>>([short, bound, rect]);
    expect(fixed.height).toBe(60);
    expect(fixed.width).toBe(5);
    expect(keptBound).toBe(bound);
    expect(keptRect).toBe(rect);
    expect(fitTextHeights([fixed])[0]).toBe(fixed);
  });

  it('fitTextHeights survives untrusted board elements', () => {
    // Huge line counts must not overflow the stack (board page would crash for every viewer)
    const huge = { type: 'text', text: 'x\n'.repeat(300_000), fontSize: 16, lineHeight: 1.25, height: 20 };
    expect(fitTextHeights([huge])[0].height).toBe(300_001 * 20);
    // Invalid sizes are left untouched instead of turning into NaN/Infinity
    for (const bad of [{ fontSize: '16' }, { lineHeight: NaN }, { height: undefined }, { fontSize: -1 }]) {
      const el = { type: 'text', text: 'a\nb', fontSize: 16, lineHeight: 1.25, height: 20, ...bad };
      expect(fitTextHeights([el])[0]).toBe(el);
    }
  });
});
