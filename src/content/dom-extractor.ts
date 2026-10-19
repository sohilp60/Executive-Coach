import { extractActiveContext, type CapturePayload } from './extractors';

/**
 * Returns structured CapturePayload directly.
 * Suitable for injection via chrome.scripting.executeScript.
 */
export function extractCapturePayload(explicitText?: string): CapturePayload {
  return extractActiveContext(explicitText);
}

/**
 * Backwards-compatible context extractor for active tab.
 * Formats rich structured context from supported platforms (Teams, Outlook, Confluence, Jira)
 * or general web pages into a formatted prompt string for the AI Coach.
 */
export function extractPageContext(): string {
  const capture = extractActiveContext();

  switch (capture.source) {
    case 'teams':
      return `[Microsoft Teams Chat Context]
URL: ${capture.sourceUrl}
Chat/Channel: ${capture.channelOrChat}
Sender: ${capture.senderName} (${capture.timestamp})
Selected Text: ${capture.selectedText || 'None'}
Recent Messages:
${capture.threadMessages.join('\n---\n')}`;

    case 'outlook':
      return `[Outlook Email Thread Context]
URL: ${capture.sourceUrl}
Subject: ${capture.subject}
From: ${capture.senderName} <${capture.senderEmail}>
To/CC: ${capture.recipients.join(', ')}
Date: ${capture.dateSent}
Selected Text: ${capture.selectedText || 'None'}
Email Excerpt:
${capture.emailBodyExcerpt}`;

    case 'jira':
      return `[Jira Issue Context]
URL: ${capture.sourceUrl}
Key: ${capture.issueKey} | Project: ${capture.projectName}
Summary: ${capture.summary}
Status: ${capture.status} | Priority: ${capture.priority}
Assignee: ${capture.assignee} | Reporter: ${capture.reporter}
Labels: ${capture.labels.join(', ')}
Selected Text: ${capture.selectedText || 'None'}
Description:
${capture.description}
Recent Comments:
${capture.recentComments.join('\n---\n')}`;

    case 'confluence':
      return `[Confluence Document Context]
URL: ${capture.sourceUrl}
Title: ${capture.pageTitle} (Space: ${capture.spaceKey})
Author: ${capture.author} | Last Modified: ${capture.lastModified}
Outline Headings: ${capture.headings.join(' > ')}
Action Items: ${capture.actionItems.join('; ')}
Decisions: ${capture.decisionEntries.join('; ')}
Selected Text: ${capture.selectedText || 'None'}`;

    case 'generic':
    default:
      return `[Active Web Page Context]
URL: ${capture.sourceUrl}
Title: ${capture.pageTitle}
Description: ${capture.metaDescription}
Selected Text: ${capture.selectedText || 'None'}
Content:
${capture.bodyExcerpt}`;
  }
}