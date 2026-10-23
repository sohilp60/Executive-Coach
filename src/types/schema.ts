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

export * from '../content/extractors/types';