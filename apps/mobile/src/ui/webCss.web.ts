import { colors } from '../theme';

const STYLE_ID = 'matin-web';
const INTERACTIVE = ['button', 'link', 'switch', 'tab', 'checkbox', 'radio', 'menuitem']
  .map((role) => `[role="${role}"]`)
  .join(',');

export const WEB_CSS = `
${INTERACTIVE} {
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
[aria-disabled="true"] {
  cursor: default;
}
:focus:not(:focus-visible) {
  outline: none;
}
:focus-visible {
  outline: 2px solid ${colors.accent};
  outline-offset: 2px;
}
input:focus-visible,
textarea:focus-visible {
  outline: none;
}
`;

export function installWebCss(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = WEB_CSS;
  document.head.appendChild(style);
}
