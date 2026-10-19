import type { OutlookCapture } from './types';

export function extractOutlookContext(explicitSelection?: string): OutlookCapture {
  const selection = (explicitSelection !== undefined ? explicitSelection : (window.getSelection()?.toString() || '')).trim();
  const pageTitle = document.title || 'Outlook';
  const sourceUrl = window.location.href;

  let subject = '';
  let senderName = '';
  let senderEmail = '';
  const recipients: string[] = [];
  let dateSent = '';
  let emailBodyExcerpt = '';
  let conversationLength = 1;

  try {
    // 1. Email Subject
    const subjectEl =
      document.querySelector('[aria-label="Subject"]') ||
      document.querySelector('div[role="heading"][aria-level="2"]') ||
      document.querySelector('[data-testid="message-subject"]') ||
      document.querySelector('.allowTextSelection[role="heading"]');
    if (subjectEl) {
      subject = (subjectEl.textContent || '').trim();
    } else {
      // Often in document title: "Subject - Outlook"
      const dashParts = pageTitle.split(' - ');
      if (dashParts.length > 1) {
        subject = dashParts[0].trim();
      }
    }

    // 2. Sender Name & Email
    const senderEl =
      document.querySelector('[data-testid="SenderPersona"]') ||
      document.querySelector('.lpc-hoverTarget') ||
      document.querySelector('button[aria-label*="actions for"]');
    if (senderEl) {
      senderName = (senderEl.textContent || '').trim();
      const titleAttr = senderEl.getAttribute('title') || senderEl.getAttribute('aria-label') || '';
      const emailMatch = titleAttr.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        senderEmail = emailMatch[0];
      }
    }

    if (!senderName) {
      const fromEl = document.querySelector('[aria-label*="From:"]');
      if (fromEl) senderName = (fromEl.textContent || '').replace(/^From:\s*/i, '').trim();
    }

    // 3. Recipients
    const recEls = document.querySelectorAll('[data-testid="RecipientPersona"], span[aria-label*="To:"]');
    recEls.forEach((el) => {
      const txt = (el.textContent || '').trim();
      if (txt && !recipients.includes(txt)) {
        recipients.push(txt);
      }
    });

    // 4. Date Sent
    const dateEl =
      document.querySelector('[data-testid="message-date"]') ||
      document.querySelector('time') ||
      document.querySelector('[aria-label*="Received:"]');
    if (dateEl) {
      dateSent = (dateEl.textContent || '').trim();
    }

    // 5. Message Body
    const bodyEl =
      document.querySelector('[role="region"][aria-label*="Message body"]') ||
      document.querySelector('[data-testid="readPaneBody"]') ||
      document.querySelector('.rps_') ||
      document.querySelector('[role="region"][aria-label*="Reading Pane"]');
    if (bodyEl) {
      emailBodyExcerpt = (bodyEl.textContent || '').replace(/\s+/g, ' ').slice(0, 5000).trim();
    }

    // 6. Thread count
    const threadItems = document.querySelectorAll('[role="treeitem"], [data-testid="messageList"] > div');
    if (threadItems.length > 1) {
      conversationLength = threadItems.length;
    }
  } catch (err) {
    console.warn('[OutlookExtractor] Error extracting context:', err);
  }

  return {
    source: 'outlook',
    selectedText: selection,
    subject: subject || 'Untitled Email',
    senderName: senderName || 'Outlook Sender',
    senderEmail,
    recipients: recipients.slice(0, 5),
    dateSent: dateSent || new Date().toLocaleDateString(),
    emailBodyExcerpt,
    conversationLength,
    sourceUrl,
    pageTitle,
    capturedAtISO: new Date().toISOString(),
  };
}
