import type { TeamsCapture } from './types';

export function extractTeamsContext(explicitSelection?: string): TeamsCapture {
  const selection = (explicitSelection !== undefined ? explicitSelection : (window.getSelection()?.toString() || '')).trim();
  const pageTitle = document.title || 'Microsoft Teams';
  const sourceUrl = window.location.href;

  let senderName = '';
  let channelOrChat = '';
  let timestamp = '';
  const threadMessages: string[] = [];

  try {
    // 1. Channel or Chat Title
    const headerEl =
      document.querySelector('[data-tid="chat-header-title"]') ||
      document.querySelector('[data-tid="channel-header-title"]') ||
      document.querySelector('[data-tid="team-channel-header-title"]') ||
      document.querySelector('#chat-header-name');
    if (headerEl) {
      channelOrChat = (headerEl.textContent || '').trim();
    } else {
      // Fallback: title often contains "Chat | Name | Microsoft Teams"
      const parts = pageTitle.split('|').map((s) => s.trim());
      if (parts.length > 1) {
        channelOrChat = parts[1];
      }
    }

    // 2. Identify selected node to walk up to message
    const sel = window.getSelection();
    let anchorNode: Node | null = sel?.anchorNode || null;
    let messageContainer: Element | null = null;

    if (anchorNode) {
      let current: Node | null = anchorNode;
      while (current && current !== document.body) {
        if (current instanceof Element) {
          if (
            current.matches?.('[data-tid="messageBodyContent"]') ||
            current.matches?.('[data-tid="chat-pane-message"]') ||
            current.matches?.('[role="listitem"]') ||
            current.classList?.contains('ui-chat__message')
          ) {
            messageContainer = current;
            break;
          }
        }
        current = current.parentNode;
      }
    }

    // 3. Sender Name
    if (messageContainer) {
      const senderEl =
        messageContainer.querySelector('[data-tid="threadBodyDisplayName"]') ||
        messageContainer.querySelector('[data-tid="message-author-name"]') ||
        messageContainer.parentElement?.querySelector('[data-tid="threadBodyDisplayName"]') ||
        messageContainer.closest('[role="listitem"]')?.querySelector('[data-tid="threadBodyDisplayName"]');
      if (senderEl) {
        senderName = (senderEl.textContent || '').trim();
      }

      const timeEl =
        messageContainer.querySelector('time') ||
        messageContainer.querySelector('[data-tid="message-timestamp"]') ||
        messageContainer.closest('[role="listitem"]')?.querySelector('time');
      if (timeEl) {
        timestamp = timeEl.getAttribute('datetime') || (timeEl.textContent || '').trim();
      }
    }

    // Fallback for sender if not found in immediate element
    if (!senderName) {
      const authorEls = document.querySelectorAll('[data-tid="threadBodyDisplayName"], [data-tid="message-author-name"]');
      if (authorEls.length > 0) {
        senderName = (authorEls[authorEls.length - 1].textContent || '').trim();
      }
    }

    // 4. Thread messages (surrounding messages)
    const allMsgBodies = Array.from(
      document.querySelectorAll('[data-tid="messageBodyContent"], .ui-chat__message__content')
    );

    if (allMsgBodies.length > 0) {
      let centerIdx = -1;
      if (messageContainer) {
        centerIdx = allMsgBodies.indexOf(messageContainer);
      }
      if (centerIdx === -1) {
        // Find body that includes selected text
        centerIdx = allMsgBodies.findIndex((el) =>
          selection && el.textContent ? el.textContent.includes(selection) : false
        );
      }
      if (centerIdx === -1) {
        centerIdx = allMsgBodies.length - 1; // latest
      }

      const start = Math.max(0, centerIdx - 2);
      const end = Math.min(allMsgBodies.length, centerIdx + 3);
      for (let i = start; i < end; i++) {
        const text = (allMsgBodies[i].textContent || '').trim();
        if (text) {
          threadMessages.push(text.slice(0, 1000));
        }
      }
    }
  } catch (err) {
    console.warn('[TeamsExtractor] Error extracting context:', err);
  }

  return {
    source: 'teams',
    selectedText: selection,
    senderName: senderName || 'Teams Participant',
    channelOrChat: channelOrChat || 'Microsoft Teams Chat',
    timestamp: timestamp || new Date().toLocaleTimeString(),
    threadMessages,
    sourceUrl,
    pageTitle,
    capturedAtISO: new Date().toISOString(),
  };
}
