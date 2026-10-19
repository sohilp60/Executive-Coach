import type { GenericCapture } from './types';

export function extractGenericContext(explicitSelection?: string): GenericCapture {
  const selection = (explicitSelection !== undefined ? explicitSelection : (window.getSelection()?.toString() || '')).trim();
  const pageTitle = document.title || 'Web Page';
  const pageUrl = window.location.href;

  const metaDesc =
    document.querySelector('meta[name="description"]')?.getAttribute('content') ||
    document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
    '';

  // Get visible body excerpt cleanly
  let bodyExcerpt = '';
  try {
    const mainContent =
      document.querySelector('main, article, [role="main"]') || document.body;
    bodyExcerpt = ((mainContent as HTMLElement)?.innerText || mainContent?.textContent || '').replace(/\s+/g, ' ').slice(0, 3000).trim();
  } catch {
    bodyExcerpt = (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 3000).trim();
  }

  return {
    source: 'generic',
    selectedText: selection,
    sourceUrl: pageUrl,
    pageTitle,
    metaDescription: metaDesc.slice(0, 500),
    bodyExcerpt,
    capturedAtISO: new Date().toISOString(),
  };
}
