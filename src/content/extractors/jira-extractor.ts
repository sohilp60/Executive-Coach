import type { JiraCapture } from './types';

export function extractJiraContext(explicitSelection?: string): JiraCapture {
  const selection = (explicitSelection !== undefined ? explicitSelection : (window.getSelection()?.toString() || '')).trim();
  const pageTitle = document.title || 'Jira Issue';
  const sourceUrl = window.location.href;

  let issueKey = '';
  let summary = '';
  let description = '';
  let status = 'Open';
  let priority = 'Medium';
  let assignee = '';
  let reporter = '';
  const labels: string[] = [];
  const recentComments: string[] = [];
  let projectName = '';

  try {
    // 1. Issue Key
    const keyMatch = sourceUrl.match(/\/browse\/([A-Z0-9]+-\d+)/i) || sourceUrl.match(/selectedIssue=([A-Z0-9]+-\d+)/i);
    if (keyMatch) {
      issueKey = keyMatch[1].toUpperCase();
    } else {
      const keyEl = document.querySelector('[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]');
      if (keyEl) {
        issueKey = (keyEl.textContent || '').trim().toUpperCase();
      }
    }

    // 2. Summary
    const summaryEl =
      document.querySelector('[data-testid="issue.views.issue-base.foundation.summary.heading"]') ||
      document.querySelector('#summary-val') ||
      document.querySelector('h1');
    if (summaryEl) {
      summary = (summaryEl.textContent || '').trim();
    }

    // 3. Description
    const descEl =
      document.querySelector('[data-testid="issue.views.field.description"]') ||
      document.querySelector('#description-val') ||
      document.querySelector('.ak-renderer-document');
    if (descEl) {
      description = (descEl.textContent || '').replace(/\s+/g, ' ').slice(0, 4000).trim();
    }

    // 4. Status
    const statusEl =
      document.querySelector('[data-testid="issue.views.issue-base.foundation.status.status-field-wrapper"]') ||
      document.querySelector('[data-testid="issue.common.status.status-dropdown"]') ||
      document.querySelector('#status-val');
    if (statusEl) {
      status = (statusEl.textContent || '').trim();
    }

    // 5. Priority
    const priorityEl =
      document.querySelector('[data-testid="issue.views.issue-base.foundation.priority.priority-field-wrapper"]') ||
      document.querySelector('[data-testid="issue.views.field.priority"]') ||
      document.querySelector('#priority-val');
    if (priorityEl) {
      priority = (priorityEl.textContent || '').trim();
    }

    // 6. Assignee & Reporter
    const assigneeEl =
      document.querySelector('[data-testid="issue.views.field.assignee"]') ||
      document.querySelector('[data-testid="issue.views.people.assignee"]') ||
      document.querySelector('#assignee-val');
    if (assigneeEl) {
      assignee = (assigneeEl.textContent || '').replace(/^Assignee:\s*/i, '').trim();
    }

    const reporterEl =
      document.querySelector('[data-testid="issue.views.field.reporter"]') ||
      document.querySelector('[data-testid="issue.views.people.reporter"]') ||
      document.querySelector('#reporter-val');
    if (reporterEl) {
      reporter = (reporterEl.textContent || '').replace(/^Reporter:\s*/i, '').trim();
    }

    // 7. Labels
    const labelEls = document.querySelectorAll('[data-testid="issue.views.field.labels"] [data-testid="value"], .aui-label');
    labelEls.forEach((el) => {
      const txt = (el.textContent || '').trim();
      if (txt && !labels.includes(txt)) {
        labels.push(txt);
      }
    });

    // 8. Recent comments
    const commentEls = document.querySelectorAll('[data-testid="issue-comment-base"], .activity-comment');
    const commentArr = Array.from(commentEls);
    const last3 = commentArr.slice(Math.max(0, commentArr.length - 3));
    last3.forEach((c) => {
      const txt = (c.textContent || '').replace(/\s+/g, ' ').slice(0, 800).trim();
      if (txt) recentComments.push(txt);
    });

    // 9. Project name
    const projectBreadcrumb = document.querySelector('[data-testid="issue.views.issue-base.foundation.breadcrumbs.project.item"]');
    if (projectBreadcrumb) {
      projectName = (projectBreadcrumb.textContent || '').trim();
    }
  } catch (err) {
    console.warn('[JiraExtractor] Error extracting context:', err);
  }

  return {
    source: 'jira',
    selectedText: selection,
    issueKey: issueKey || 'JIRA-ITEM',
    summary: summary || pageTitle,
    description,
    status,
    priority,
    assignee: assignee || 'Unassigned',
    reporter: reporter || 'Reporter',
    labels,
    recentComments,
    projectName: projectName || 'Project',
    sourceUrl,
    pageTitle,
    capturedAtISO: new Date().toISOString(),
  };
}
