/**
 * Floating Capture Pill — Content Script
 *
 * Injected on supported domains (Teams, Outlook, Confluence, Jira, etc.)
 * Detects highlighted text and renders a lightweight, isolated Shadow DOM pill
 * directly above the selection for 1-click Executive Capture.
 */

import { extractActiveContext } from './extractors';

(function initCapturePill() {
  // Prevent duplicate instances if injected multiple times
  if ((window as any).__poCoachCapturePillActive) return;
  (window as any).__poCoachCapturePillActive = true;

  let hostElement: HTMLElement | null = null;
  let shadowRoot: ShadowRoot | null = null;
  let currentSelectionText = '';
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function createPillContainer() {
    if (hostElement) return;

    hostElement = document.createElement('div');
    hostElement.id = 'po-coach-capture-pill-host';
    hostElement.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      overflow: visible;
      z-index: 2147483647;
      pointer-events: none;
    `;

    shadowRoot = hostElement.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      .po-pill-wrapper {
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 6px;
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid #334155;
        border-radius: 9999px;
        padding: 4px 8px 4px 10px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 12px;
        font-weight: 500;
        line-height: 1;
        user-select: none;
        animation: poPillFadeIn 0.15s ease-out forwards;
        transform: translate(-50%, -100%);
        white-space: nowrap;
      }

      @keyframes poPillFadeIn {
        from {
          opacity: 0;
          transform: translate(-50%, -90%) scale(0.96);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -100%) scale(1);
        }
      }

      .po-pill-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: transparent;
        color: #f8fafc;
        border: none;
        padding: 5px 9px;
        border-radius: 9999px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: background-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
      }

      .po-pill-btn:hover {
        background-color: #334155;
      }

      .po-pill-btn:active {
        transform: scale(0.97);
      }

      .po-pill-btn-primary {
        background-color: #4f46e5;
        color: #ffffff;
      }

      .po-pill-btn-primary:hover {
        background-color: #4338ca;
      }

      .po-pill-btn-secondary {
        color: #94a3b8;
      }

      .po-pill-btn-secondary:hover {
        color: #ffffff;
      }

      .po-pill-divider {
        width: 1px;
        height: 14px;
        background-color: #334155;
      }

      .po-pill-close {
        color: #94a3b8;
        padding: 5px;
        line-height: 1;
      }

      .po-pill-close:hover {
        color: #f1f5f9;
        background-color: #334155;
      }
    `;

    shadowRoot.appendChild(style);

    const pill = document.createElement('div');
    pill.className = 'po-pill-wrapper';
    pill.innerHTML = `
      <button class="po-pill-btn po-pill-btn-primary" id="po-btn-capture">
        <span>🎯</span>
        <span>Capture to Notion</span>
      </button>
      <div class="po-pill-divider"></div>
      <button class="po-pill-btn po-pill-btn-secondary" id="po-btn-copy">
        <span>📋</span>
        <span>Copy</span>
      </button>
      <button class="po-pill-btn po-pill-close" id="po-btn-close" title="Dismiss">
        ✕
      </button>
    `;

    shadowRoot.appendChild(pill);

    // Wire up event listeners
    const captureBtn = pill.querySelector('#po-btn-capture');
    captureBtn?.addEventListener('click', onCaptureClick);

    const copyBtn = pill.querySelector('#po-btn-copy');
    copyBtn?.addEventListener('click', onCopyClick);

    const closeBtn = pill.querySelector('#po-btn-close');
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      hidePill();
    });

    document.documentElement.appendChild(hostElement);
  }

  function hidePill() {
    if (hostElement && hostElement.parentNode) {
      hostElement.parentNode.removeChild(hostElement);
      hostElement = null;
      shadowRoot = null;
    }
  }

  async function onCaptureClick(e: Event) {
    e.stopPropagation();
    e.preventDefault();

    if (!currentSelectionText) return;

    const captureBtn = shadowRoot?.querySelector('#po-btn-capture') as HTMLButtonElement | null;
    if (captureBtn) {
      captureBtn.innerText = 'Capturing...';
      captureBtn.disabled = true;
    }

    try {
      // Run platform-specific extractor
      const payload = extractActiveContext(currentSelectionText);

      // Send to background service worker
      await chrome.runtime.sendMessage({
        type: 'EXECUTIVE_CAPTURE',
        payload,
      });

      if (captureBtn) {
        captureBtn.innerText = '✓ Sent to Coach';
      }

      setTimeout(() => {
        hidePill();
      }, 700);
    } catch (err) {
      console.error('[PO Coach] Capture failed:', err);
      if (captureBtn) {
        captureBtn.innerText = 'Capture';
        captureBtn.disabled = false;
      }
      hidePill();
    }
  }

  function onCopyClick(e: Event) {
    e.stopPropagation();
    e.preventDefault();

    if (!currentSelectionText) return;

    navigator.clipboard.writeText(currentSelectionText).then(() => {
      const copyBtn = shadowRoot?.querySelector('#po-btn-copy') as HTMLButtonElement | null;
      if (copyBtn) {
        const originalHtml = copyBtn.innerHTML;
        copyBtn.innerHTML = '<span>✓</span><span>Copied!</span>';
        setTimeout(() => {
          if (copyBtn) copyBtn.innerHTML = originalHtml;
        }, 1200);
      }
    });
  }

  function handleSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      hidePill();
      return;
    }

    const text = selection.toString().trim();
    // Ignore short selections (less than 3 characters)
    if (!text || text.length < 3) {
      hidePill();
      return;
    }

    currentSelectionText = text;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (!rect || (rect.width === 0 && rect.height === 0)) {
      hidePill();
      return;
    }

    createPillContainer();

    if (hostElement) {
      const pageX = rect.left + rect.width / 2 + window.scrollX;
      // Position 10px above the top of the selection
      const pageY = rect.top + window.scrollY - 10;

      hostElement.style.top = `${Math.max(10, pageY)}px`;
      hostElement.style.left = `${Math.max(10, pageX)}px`;
    }
  }

  function debouncedHandleSelection() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      handleSelection();
    }, 200);
  }

  // Listeners
  document.addEventListener('mouseup', debouncedHandleSelection, { passive: true });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift' || e.key.startsWith('Arrow')) {
      debouncedHandleSelection();
    } else if (e.key === 'Escape') {
      hidePill();
    }
  });

  // Hide on scroll if user moves away from selection
  window.addEventListener(
    'scroll',
    () => {
      if (hostElement) {
        // Simple hide on scroll prevents misaligned floating UI
        hidePill();
      }
    },
    { passive: true }
  );

  // Click outside dismisses pill
  document.addEventListener('mousedown', (e) => {
    if (hostElement && !hostElement.contains(e.target as Node)) {
      // Don't hide immediately if clicked inside our shadow DOM
      hidePill();
    }
  });
})();
