export interface POMemoryStore {
  version: number;
  lastUpdatedISO: string;
  userProfile: {
    role: string;
    platformDomain: string;
    coreResponsibilities: string[];
    procrastinationTriggers: string[];
  };
  teamAndStakeholders: Array<{
    id: string;
    nameOrRole: string;
    communicationStyle: string;
    influenceLevel: "high" | "medium" | "low";
    knownFrictionPoints: string;
    updatedAt: string;
  }>;
  productRulesAndContext: Array<{
    id: string;
    category: "architecture" | "process" | "terminology" | "quarterly_goal";
    fact: string;
    updatedAt: string;
  }>;
  dailyCommitmentsLog: Record<string, {
    mustWinTaskIds: string[];
    morningTriageCompleted: boolean;
    midDayCheckStatus?: "on_track" | "drifted_to_firefighting" | "blocked";
  }>;
}

export type ProviderFormat = "openai-compatible" | "anthropic-native";

export interface LLMProviderConfig {
  id: string;
  name: string;
  format: ProviderFormat;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  supportsNativeTools: boolean;
  zeroDataRetention: boolean;
  isCustom?: boolean;
  cachedModels?: string[];
}

export interface RouterSettings {
  primaryProviderId: string;
  fallbackProviderIds: string[];
  strictWorkPrivacyMode: boolean;
}

export interface NotionConfig {
  apiKey: string;
  databaseId: string;
  notionProxyUrl?: string;
  proxyUrl?: string;
  selectedStatuses?: string[];
  availableStatuses?: string[];
  syncIntervalMinutes?: number;
  lastSyncedAtISO?: string;
}

export interface NotionDeltaStats {
  added: number;
  updated: number;
  removed: number;
  isDelta: boolean;
  syncedAt: string;
}

export interface NotionTask {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  priority: string;
  url: string;
  archived?: boolean;
  lastEditedTime?: string;
  coachStrategy?: string;
  coachStrategyBlockId?: string;
  coachStrategyUpdatedAt?: string;
}

export interface GitHubUpdateConfig {
  repoSlug: string; // e.g. "Sohil56/Executive-Coach"
  branch: string;   // e.g. "main"
  githubToken?: string;
  autoUpdate: boolean;
  lastCheckedISO?: string;
  latestAvailableVersion?: string;
  latestReleaseUrl?: string;
  latestDownloadUrl?: string;
  latestReleaseNotes?: string;
}

export interface UpdateCheckResult {
  ok: boolean;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  source: 'github-release' | 'github-branch' | 'chrome-runtime';
  releaseTitle?: string;
  releaseNotes?: string;
  publishedAt?: string;
  htmlUrl?: string;
  downloadUrl?: string;
  assetName?: string;
  autoUpdateTriggered?: boolean;
  error?: string;
}

export interface GitHubReleasePublishPayload {
  repoSlug: string;
  githubToken: string;
  tagName: string;
  targetCommitish?: string;
  releaseName: string;
  body: string;
  draft?: boolean;
  prerelease?: boolean;
  attachCompiledZip?: boolean;
  assetName?: string;
}

export interface GitHubReleasePublishResult {
  ok: boolean;
  releaseId?: number;
  tagName: string;
  releaseName?: string;
  htmlUrl?: string;
  uploadUrl?: string;
  assetUploaded?: boolean;
  assetName?: string;
  assetDownloadUrl?: string;
  assetWarning?: string;
  updatedExisting?: boolean;
  error?: string;
}

export interface ExtensionBackupBundle {
  schemaVersion: number;
  app: 'po-executive-coach';
  exportedAtISO: string;
  extensionVersion: string;
  includesCredentials: boolean;
  data: {
    memory: POMemoryStore;
    providers: Record<string, LLMProviderConfig>;
    routerSettings: RouterSettings;
    notionConfig: NotionConfig;
    gdriveClientId?: string;
    tasks?: NotionTask[];
    chatHistory?: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: number;
    }>;
    theme?: 'dark' | 'light';
    githubUpdateConfig?: GitHubUpdateConfig;
  };
}

export * from '../content/extractors/types';