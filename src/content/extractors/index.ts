import type { CapturePayload } from './types';
import { extractTeamsContext } from './teams-extractor';
import { extractOutlookContext } from './outlook-extractor';
import { extractConfluenceContext } from './confluence-extractor';
import { extractJiraContext } from './jira-extractor';
import { extractGenericContext } from './generic-extractor';

export * from './types';
export * from './teams-extractor';
export * from './outlook-extractor';
export * from './confluence-extractor';
export * from './jira-extractor';
export * from './generic-extractor';

/**
 * Automatically inspects the current window URL and extracts
 * platform-specific structured metadata + selected text.
 */
export function extractActiveContext(explicitSelection?: string): CapturePayload {
  const url = window.location.href;

  if (url.includes('teams.microsoft.com') || url.includes('teams.live.com')) {
    return extractTeamsContext(explicitSelection);
  }

  if (
    url.includes('outlook.office.com') ||
    url.includes('outlook.office365.com') ||
    url.includes('outlook.live.com')
  ) {
    return extractOutlookContext(explicitSelection);
  }

  if (url.includes('.atlassian.net/wiki') || url.includes('/wiki/spaces/')) {
    return extractConfluenceContext(explicitSelection);
  }

  if (
    url.includes('.atlassian.net') ||
    url.includes('/jira/') ||
    url.includes('/browse/')
  ) {
    return extractJiraContext(explicitSelection);
  }

  return extractGenericContext(explicitSelection);
}
