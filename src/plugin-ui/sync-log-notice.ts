import { Notice } from 'obsidian';

/**
 * A Notice that accumulates log lines (like a mini console) instead of
 * replacing the message each time.  Stays in the top-right corner so the
 * user can keep working.
 */
export class SyncLogNotice {
  private notice: Notice;
  private logEl: HTMLElement;

  constructor(heading: string) {
    this.notice = new Notice('', 0);

    const el = this.notice.noticeEl;
    el.empty();
    Object.assign(el.style, {
      width: '480px',
      maxWidth: '90vw',
      padding: '10px 12px',
    });

    const headerRow = el.createEl('div');
    Object.assign(headerRow.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '6px',
    });

    const title = headerRow.createEl('span', { text: heading });
    title.style.fontWeight = '600';

    const hideBtn = headerRow.createEl('a', { text: 'x  close' });
    hideBtn.setAttribute('role', 'button');
    Object.assign(hideBtn.style, {
      cursor: 'pointer',
      fontSize: '12px',
      opacity: '0.8',
      textDecoration: 'none',
      flexShrink: '0',
    });
    hideBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.notice.hide();
    });

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
  }

  appendLine(msg: string): void {
    const line = this.logEl.createEl('div');
    line.textContent = msg;
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  /** Hide the log notice and show a coloured status toast. */
  finish(summary: string, success: boolean): void {
    this.notice.hide();
    const toast = new Notice(summary, 8000);
    toast.noticeEl.style.color = success
      ? 'var(--text-success, #2da44e)'
      : 'var(--text-error, #cf222e)';
  }
}
