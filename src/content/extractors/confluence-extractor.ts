import type { ConfluenceCapture } from './types';

export function extractConfluenceContext(explicitSelection?: string): ConfluenceCapture {
  const selection = (explicitSelection !== undefined ? explicitSelection : (window.getSelection()?.toString() || '')).trim();
  const pageTitle = document.title || 'Confluence Page';
  const sourceUrl = window.location.href;

  let title = '';
  let spaceKey = '';
  let author = '';
  const headings: string[] = [];
  const actionItems: string[] = [];
  const decisionEntries: string[] = [];
  let lastModified = '';

  try {
    // 1. Title
    const titleEl =
      document.querySelector('[data-testid="title-text"]') ||
      document.querySelector('#title-text') ||
      document.querySelector('h1[data-testid="page-title"]') ||
      document.querySelector('h1');
    if (titleEl) {
      title = (titleEl.textContent || '').trim();
    }

    // 2. Space Key from URL or breadcrumbs
    const spaceMatch = sourceUrl.match(/\/wiki\/spaces\/([^/]+)/);
    if (spaceMatch) {
      spaceKey = spaceMatch[1];
    } else {
      const spaceBreadcrumb = document.querySelector('[data-testid="breadcrumbs"] a');
      if (spaceBreadcrumb) {
        spaceKey = (spaceBreadcrumb.textContent || '').trim();
      }
    }

    // 3. Author / Last Editor
    const authorEl =
      document.querySelector('[data-testid="author-name"]') ||
      document.querySelector('.confluence-userlink') ||
      document.querySelector('[data-testid="editor-name"]');
    if (authorEl) {
      author = (authorEl.textContent || '').trim();
    }

    // 4. Container for content
    const contentContainer =
      document.querySelector('[data-testid="renderer-container"]') ||
      document.querySelector('#content .wiki-content') ||
      document.querySelector('.ak-renderer-document') ||
      document.body;

    // Headings
    if (contentContainer) {
      const headingEls = contentContainer.querySelectorAll('h1, h2, h3');
      headingEls.forEach((h) => {
        const hText = (h.textContent || '').trim();
        if (hText && !headings.includes(hText)) {
          headings.push(hText);
        }
      });

      // Action items / inline tasks
      const taskEls = contentContainer.querySelectorAll(
        '[data-inline-task-id], li.inline-task, [data-node-type="taskItem"]'
      );
      taskEls.forEach((t) => {
        const tText = (t.textContent || '').trim();
        if (tText && !actionItems.includes(tText)) {
          actionItems.push(tText);
        }
      });

      // Decision items
      const decisionEls = contentContainer.querySelectorAll(
        '.decision-item, [data-node-type="decisionItem"], [data-testid="decision-item"]'
      );
      decisionEls.forEach((d) => {
        const dText = (d.textContent || '').trim();
        if (dText && !decisionEntries.includes(dText)) {
          decisionEntries.push(dText);
        }
      });
    }

    // 5. Last Modified
    const timeEl = document.querySelector('time') || document.querySelector('[data-testid="last-modified-date"]');
    if (timeEl) {
      lastModified = timeEl.getAttribute('datetime') || (timeEl.textContent || '').trim();
    }
  } catch (err) {
    console.warn('[ConfluenceExtractor] Error extracting context:', err);
  }

  return {
    source: 'confluence',
    selectedText: selection,
    pageTitle: title || pageTitle,
    spaceKey,
    author: author || 'Confluence Contributor',
    headings: headings.slice(0, 10),
    actionItems: actionItems.slice(0, 8),
    decisionEntries: decisionEntries.slice(0, 5),
    lastModified: lastModified || new Date().toLocaleDateString(),
    sourceUrl,
    capturedAtISO: new Date().toISOString(),
  };
}
