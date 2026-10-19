/**
 * Selection Listener — Content Script
 *
 * Listens for text selection on the page and sends the selected text
 * to the service worker. Debounced at 300ms to avoid flooding.
 *
 * This file is self-executing: it registers its listener immediately
 * when injected via chrome.scripting.executeScript.
 */

(function selectionListenerInit() {
  // Guard against double-injection in the same page
  if ((window as any).__poCoachSelectionListenerActive) return;
  (window as any).__poCoachSelectionListenerActive = true;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function onMouseUp() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (text && text.length > 0) {
        chrome.runtime.sendMessage({
          type: 'TEXT_SELECTED',
          text,
          url: window.location.href,
        }).catch(() => {
          // Extension context may have been invalidated (e.g. extension reloaded).
          // Silently ignore — the user can re-select.
        });
      }
    }, 300);
  }

  document.addEventListener('mouseup', onMouseUp, { passive: true });
})();
