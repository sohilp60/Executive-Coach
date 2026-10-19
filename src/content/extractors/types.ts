/**
 * Executive Capture Engine — Extractor Types
 */

export interface BaseCapture {
  selectedText: string;
  sourceUrl: string;
  pageTitle: string;
  capturedAtISO: string;
}

export interface TeamsCapture extends BaseCapture {
  source: 'teams';
  senderName: string;
  channelOrChat: string;
  timestamp: string;
  threadMessages: string[];
}

export interface OutlookCapture extends BaseCapture {
  source: 'outlook';
  subject: string;
  senderName: string;
  senderEmail: string;
  recipients: string[];
  dateSent: string;
  emailBodyExcerpt: string;
  conversationLength: number;
}

export interface ConfluenceCapture extends BaseCapture {
  source: 'confluence';
  spaceKey: string;
  author: string;
  headings: string[];
  actionItems: string[];
  decisionEntries: string[];
  lastModified: string;
}

export interface JiraCapture extends BaseCapture {
  source: 'jira';
  issueKey: string;
  summary: string;
  description: string;
  status: string;
  priority: string;
  assignee: string;
  reporter: string;
  labels: string[];
  recentComments: string[];
  projectName: string;
}

export interface GenericCapture extends BaseCapture {
  source: 'generic';
  metaDescription: string;
  bodyExcerpt: string;
}

export type CapturePayload =
  | TeamsCapture
  | OutlookCapture
  | ConfluenceCapture
  | JiraCapture
  | GenericCapture;

export interface DistilledTaskProposal {
  title: string;
  dueDate: string | null;
  priority: 'High' | 'Medium' | 'Low' | 'None';
  summary: string;
  suggestedStakeholder?: string;
}

export interface NotionCreateTaskPayload {
  title: string;
  status?: string;
  dueDate?: string | null;
  priority?: string;
  capturePayload: CapturePayload;
  contextSummary: string;
  generateStrategy?: boolean;
  strategyText?: string;
}

export interface NotionAppendTaskPayload {
  taskId: string;
  capturePayload: CapturePayload;
  contextSummary: string;
  generateStrategy?: boolean;
  strategyText?: string;
}
