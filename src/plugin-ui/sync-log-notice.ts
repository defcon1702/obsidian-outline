import { Notice } from 'obsidian';

/**
 * A Notice that accumulates log lines (like a mini console).
 * Starts expanded showing the full tree; a toggle collapses it to a single
 * status line.  A dismiss button at the bottom hides it entirely.
 * When the sync finishes a separate coloured toast always appears.
 */
export class SyncLogNotice {
  private notice: Notice;
  private logEl: HTMLElement;
  private compactEl: HTMLElement;
  private toggleBtn: HTMLAnchorElement;
  private footerEl: HTMLElement;
  private lastLine = '';
  private expanded = true;
  private dismissed = false;

  constructor(heading: string) {
    this.notice = new Notice('', 0);

    const el = this.notice.containerEl;
    el.empty();
    Object.assign(el.style, {
      width: '480px',
      maxWidth: '90vw',
      padding: '10px 12px',
    });

    // --- header row: title + expand/collapse toggle ---
    const headerRow = el.createEl('div');
    Object.assign(headerRow.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '6px',
    });

    const title = headerRow.createEl('span', { text: heading });
    title.style.fontWeight = '600';

    this.toggleBtn = headerRow.createEl('a', { text: '▾ collapse' });
    this.toggleBtn.setAttribute('role', 'button');
    Object.assign(this.toggleBtn.style, {
      cursor: 'pointer',
      fontSize: '11px',
      opacity: '0.8',
      textDecoration: 'none',
      flexShrink: '0',
    });
    this.toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.setExpanded(!this.expanded);
    });

    // --- compact view: single latest-line (hidden by default) ---
    this.compactEl = el.createEl('div');
    Object.assign(this.compactEl.style, {
      fontFamily: 'var(--font-monospace)',
      fontSize: '11.5px',
      lineHeight: '1.5',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      display: 'none',
    });

    // --- expanded log area ---
    this.logEl = el.createEl('div');
    Object.assign(this.logEl.style, {
      fontFamily: 'var(--font-monospace)',
      fontSize: '11.5px',
      lineHeight: '1.5',
      maxHeight: '300px',
      overflowY: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    });

    // --- footer: dismiss button ---
    this.footerEl = el.createEl('div');
    Object.assign(this.footerEl.style, {
      marginTop: '6px',
      textAlign: 'right',
    });

    const dismissBtn = this.footerEl.createEl('a', { text: 'Dismiss' });
    dismissBtn.setAttribute('role', 'button');
    Object.assign(dismissBtn.style, {
      cursor: 'pointer',
      fontSize: '11px',
      opacity: '0.8',
      textDecoration: 'none',
    });
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.dismissed = true;
      this.notice.hide();
    });
  }

  appendLine(msg: string): void {
    if (this.dismissed) return;
    this.lastLine = msg;

    const line = this.logEl.createEl('div');
    line.textContent = msg;
    this.logEl.scrollTop = this.logEl.scrollHeight;

    this.compactEl.textContent = msg;
  }

  /** Hide the log notice and always show a coloured status toast. */
  finish(summary: string, success: boolean): void {
    if (!this.dismissed) {
      this.notice.hide();
    }
    const toast = new Notice(summary, 8000);
    toast.messageEl.style.color = success
      ? 'var(--text-success, #2da44e)'
      : 'var(--text-error, #cf222e)';
  }

  private setExpanded(expand: boolean): void {
    this.expanded = expand;
    this.logEl.style.display = expand ? '' : 'none';
    this.compactEl.style.display = expand ? 'none' : '';
    this.toggleBtn.textContent = expand ? '▾ collapse' : '▸ expand';
  }
}
