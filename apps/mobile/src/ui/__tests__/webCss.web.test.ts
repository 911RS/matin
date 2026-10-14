import { colors } from '../../theme';
import { installWebCss, WEB_CSS } from '../webCss.web';

const g = globalThis as Record<string, unknown>;
const saved = g.document;

afterAll(() => {
  g.document = saved;
});

describe('web CSS', () => {
  it('gives pressables a pointer, blocks text selection and shows focus rings to keyboard users only', () => {
    expect(WEB_CSS).toContain('[role="button"]');
    expect(WEB_CSS).toContain('cursor: pointer');
    expect(WEB_CSS).toContain('user-select: none');
    expect(WEB_CSS).toContain(':focus:not(:focus-visible)');
    expect(WEB_CSS).toContain(`outline: 2px solid ${colors.accent}`);
  });

  it('adds the style tag once', () => {
    const appended: { id: string; textContent: string }[] = [];
    g.document = {
      getElementById: (id: string) => appended.find((node) => node.id === id) ?? null,
      createElement: () => ({ id: '', textContent: '' }),
      head: { appendChild: (node: { id: string; textContent: string }) => appended.push(node) },
    };
    installWebCss();
    installWebCss();
    expect(appended).toHaveLength(1);
    expect(appended[0]!.textContent).toBe(WEB_CSS);
  });
});
