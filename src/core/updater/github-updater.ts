import type { GitHubUpdateConfig, UpdateCheckResult } from '../../types/schema';

export const DEFAULT_GITHUB_UPDATE_CONFIG: GitHubUpdateConfig = {
  repoSlug: 'Sohil56/Executive-Coach',
  branch: 'main',
  githubToken: '',
  autoUpdate: true,
};

/**
 * Returns the currently installed extension version from manifest.json.
 */
export function getCurrentExtensionVersion(): string {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
      const manifest = chrome.runtime.getManifest();
      if (manifest?.version) return manifest.version;
    }
  } catch {
    // Fallback in web preview
  }
  return '0.1.1';
}

/**
 * Normalizes a GitHub repository input (URL or owner/repo) into "owner/repo".
 */
export function normalizeRepoSlug(input: string): string {
  if (!input) return DEFAULT_GITHUB_UPDATE_CONFIG.repoSlug;
  let cleaned = input.trim();
  cleaned = cleaned.replace(/^https?:\/\/(www\.)?github\.com\//i, '');
  cleaned = cleaned.replace(/^github\.com\//i, '');
  cleaned = cleaned.replace(/\.git$/i, '');
  cleaned = cleaned.replace(/\/+$/, '');
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return cleaned || DEFAULT_GITHUB_UPDATE_CONFIG.repoSlug;
}

/**
 * Compares two semantic version strings (e.g., "v0.2.0" vs "0.1.1").
 * Returns:
 *   1 if versionA > versionB
 *  -1 if versionA < versionB
 *   0 if equal
 */
export function compareSemver(versionA: string, versionB: string): number {
  const clean = (v: string) =>
    v
      .trim()
      .replace(/^[vV]/, '')
      .split('-')[0]
      .split('.')
      .map((n) => parseInt(n, 10) || 0);

  const a = clean(versionA);
  const b = clean(versionB);
  const len = Math.max(a.length, b.length, 3);

  for (let i = 0; i < len; i++) {
    const numA = a[i] ?? 0;
    const numB = b[i] ?? 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}

/**
 * Checks GitHub Releases (and falls back to branch manifest.json) for a newer version.
 */
export async function checkGitHubForUpdates(
  configOverride?: Partial<GitHubUpdateConfig>
): Promise<UpdateCheckResult> {
  const currentVersion = getCurrentExtensionVersion();

  const storedRes = (await chrome.storage.local.get('po_github_update_config')) as Record<string, any>;
  const storedConfig: GitHubUpdateConfig =
    (storedRes?.po_github_update_config as GitHubUpdateConfig) || DEFAULT_GITHUB_UPDATE_CONFIG;

  const mergedConfig: GitHubUpdateConfig = {
    ...DEFAULT_GITHUB_UPDATE_CONFIG,
    ...storedConfig,
    ...configOverride,
    repoSlug: normalizeRepoSlug(configOverride?.repoSlug ?? storedConfig.repoSlug ?? DEFAULT_GITHUB_UPDATE_CONFIG.repoSlug),
    branch: (configOverride?.branch ?? storedConfig.branch ?? 'main').trim() || 'main',
  };

  const repoSlug = mergedConfig.repoSlug;
  if (!repoSlug.includes('/')) {
    return {
      ok: false,
      currentVersion,
      latestVersion: currentVersion,
      hasUpdate: false,
      source: 'github-release',
      error: 'Invalid GitHub repository format. Use "owner/repo" (e.g., Sohil56/Executive-Coach).',
    };
  }

  // 1. Check native browser extension auto-updater first if supported
  try {
    if (typeof chrome !== 'undefined' && typeof (chrome.runtime as any)?.requestUpdateCheck === 'function') {
      const nativeCheck = await new Promise<{ status: string; version?: string }>((resolve) => {
        try {
          (chrome.runtime as any).requestUpdateCheck((status: string, details?: { version?: string }) => {
            resolve({ status, version: details?.version });
          });
        } catch {
          resolve({ status: 'no_update' });
        }
      });

      if (nativeCheck.status === 'update_available' && nativeCheck.version) {
        const nowISO = new Date().toISOString();
        const updatedCfg: GitHubUpdateConfig = {
          ...mergedConfig,
          lastCheckedISO: nowISO,
          latestAvailableVersion: nativeCheck.version,
        };
        await chrome.storage.local.set({ po_github_update_config: updatedCfg });

        return {
          ok: true,
          currentVersion,
          latestVersion: nativeCheck.version,
          hasUpdate: true,
          source: 'chrome-runtime',
          releaseTitle: `Browser Extension Update v${nativeCheck.version}`,
          releaseNotes: 'A staged extension update is ready to be applied immediately.',
        };
      }
    }
  } catch {
    // Ignore if requestUpdateCheck is not supported in current context
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };
  if (mergedConfig.githubToken?.trim()) {
    headers.Authorization = `Bearer ${mergedConfig.githubToken.trim()}`;
  }

  try {
    // 2. Query GitHub Latest Release API
    const latestRelUrl = `https://api.github.com/repos/${repoSlug}/releases/latest`;
    const relRes = await fetch(latestRelUrl, { headers });

    if (relRes.ok) {
      const relData = await relRes.json();
      const rawTag = String(relData.tag_name || relData.name || '').trim();
      const latestVersion = rawTag.replace(/^[vV]/, '') || currentVersion;
      const hasUpdate = compareSemver(latestVersion, currentVersion) > 0;

      // Prefer a .zip or .crx asset uploaded to the release; fallback to zipball
      const assets: Array<{ name: string; browser_download_url: string }> = Array.isArray(relData.assets)
        ? relData.assets
        : [];
      const preferredAsset =
        assets.find((a) => /\.(zip|crx)$/i.test(a.name)) || assets[0];

      const downloadUrl =
        preferredAsset?.browser_download_url ||
        `https://github.com/${repoSlug}/archive/refs/tags/${encodeURIComponent(rawTag)}.zip`;

      const nowISO = new Date().toISOString();
      const updatedCfg: GitHubUpdateConfig = {
        ...mergedConfig,
        lastCheckedISO: nowISO,
        latestAvailableVersion: latestVersion,
        latestReleaseUrl: relData.html_url || `https://github.com/${repoSlug}/releases`,
        latestDownloadUrl: downloadUrl,
        latestReleaseNotes: relData.body || '',
      };
      await chrome.storage.local.set({ po_github_update_config: updatedCfg });

      return {
        ok: true,
        currentVersion,
        latestVersion,
        hasUpdate,
        source: 'github-release',
        releaseTitle: relData.name || `Release ${rawTag}`,
        releaseNotes: relData.body || 'New release available on GitHub.',
        publishedAt: relData.published_at,
        htmlUrl: relData.html_url || `https://github.com/${repoSlug}/releases`,
        downloadUrl,
        assetName: preferredAsset?.name || `${repoSlug.split('/')[1]}-${rawTag}.zip`,
      };
    }

    // 3. Fallback: Check pre-releases or tags if /releases/latest returned 404 (no formal release yet)
    if (relRes.status === 404) {
      const allReleasesRes = await fetch(`https://api.github.com/repos/${repoSlug}/releases?per_page=5`, {
        headers,
      });

      if (allReleasesRes.ok) {
        const releasesList = await allReleasesRes.json();
        if (Array.isArray(releasesList) && releasesList.length > 0) {
          const topRel = releasesList[0];
          const rawTag = String(topRel.tag_name || topRel.name || '').trim();
          const latestVersion = rawTag.replace(/^[vV]/, '') || currentVersion;
          const hasUpdate = compareSemver(latestVersion, currentVersion) > 0;
          const assets: Array<{ name: string; browser_download_url: string }> = Array.isArray(topRel.assets)
            ? topRel.assets
            : [];
          const preferredAsset = assets.find((a) => /\.(zip|crx)$/i.test(a.name)) || assets[0];
          const downloadUrl =
            preferredAsset?.browser_download_url ||
            `https://github.com/${repoSlug}/archive/refs/tags/${encodeURIComponent(rawTag)}.zip`;

          const nowISO = new Date().toISOString();
          await chrome.storage.local.set({
            po_github_update_config: {
              ...mergedConfig,
              lastCheckedISO: nowISO,
              latestAvailableVersion: latestVersion,
              latestReleaseUrl: topRel.html_url || `https://github.com/${repoSlug}/releases`,
              latestDownloadUrl: downloadUrl,
              latestReleaseNotes: topRel.body || '',
            },
          });

          return {
            ok: true,
            currentVersion,
            latestVersion,
            hasUpdate,
            source: 'github-release',
            releaseTitle: topRel.name || `Release ${rawTag}`,
            releaseNotes: topRel.body || '',
            publishedAt: topRel.published_at,
            htmlUrl: topRel.html_url || `https://github.com/${repoSlug}/releases`,
            downloadUrl,
            assetName: preferredAsset?.name || `${repoSlug.split('/')[1]}-${rawTag}.zip`,
          };
        }
      }

      // 4. Fallback to checking manifest.json on the target branch (main/master)
      const branchesToTry = Array.from(new Set([mergedConfig.branch || 'main', 'main', 'master']));
      for (const branchName of branchesToTry) {
        const contentsUrl = `https://api.github.com/repos/${repoSlug}/contents/manifest.json?ref=${encodeURIComponent(branchName)}`;
        const mfRes = await fetch(contentsUrl, { headers });

        if (mfRes.ok) {
          const mfJson = await mfRes.json();
          let decodedManifest: any = null;
          if (mfJson.content) {
            const rawBase64 = String(mfJson.content).replace(/\s/g, '');
            decodedManifest = JSON.parse(atob(rawBase64));
          }

          if (decodedManifest?.version) {
            const latestVersion = String(decodedManifest.version).replace(/^[vV]/, '');
            const hasUpdate = compareSemver(latestVersion, currentVersion) > 0;
            const downloadUrl = `https://github.com/${repoSlug}/archive/refs/heads/${encodeURIComponent(branchName)}.zip`;
            const htmlUrl = `https://github.com/${repoSlug}/tree/${encodeURIComponent(branchName)}`;

            const nowISO = new Date().toISOString();
            await chrome.storage.local.set({
              po_github_update_config: {
                ...mergedConfig,
                branch: branchName,
                lastCheckedISO: nowISO,
                latestAvailableVersion: latestVersion,
                latestReleaseUrl: htmlUrl,
                latestDownloadUrl: downloadUrl,
              },
            });

            return {
              ok: true,
              currentVersion,
              latestVersion,
              hasUpdate,
              source: 'github-branch',
              releaseTitle: `${repoSlug} (${branchName} @ v${latestVersion})`,
              releaseNotes: hasUpdate
                ? `Branch "${branchName}" has a newer manifest version (v${latestVersion} > v${currentVersion}).`
                : `You are running the latest version (v${currentVersion}) from branch "${branchName}".`,
              htmlUrl,
              downloadUrl,
              assetName: `${repoSlug.split('/')[1]}-${branchName}-v${latestVersion}.zip`,
            };
          }
        }
      }

      return {
        ok: false,
        currentVersion,
        latestVersion: currentVersion,
        hasUpdate: false,
        source: 'github-release',
        error: `Repository "${repoSlug}" was not found or has no public releases/manifest.json. If it is private, add a GitHub Personal Access Token below.`,
      };
    }

    const errText = await relRes.text().catch(() => '');
    return {
      ok: false,
      currentVersion,
      latestVersion: currentVersion,
      hasUpdate: false,
      source: 'github-release',
      error: `GitHub API returned HTTP ${relRes.status}${errText ? `: ${errText.slice(0, 140)}` : ''}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      currentVersion,
      latestVersion: currentVersion,
      hasUpdate: false,
      source: 'github-release',
      error: `Failed to reach GitHub API: ${err?.message || String(err)}`,
    };
  }
}

/**
 * Initiates an automatic update when a newer version is available:
 * - If Chrome staged a runtime update (`source === 'chrome-runtime'`), reloads the extension immediately.
 * - For GitHub releases/branches, triggers an automatic download of the release package (.zip/.crx)
 *   so the user has the updated build immediately, and returns status feedback.
 */
export function triggerAutomaticUpdateDownload(updateResult: UpdateCheckResult): {
  triggered: boolean;
  method: 'chrome-reload' | 'download-bundle' | 'none';
  message: string;
} {
  if (!updateResult.hasUpdate) {
    return {
      triggered: false,
      method: 'none',
      message: 'Extension is already up to date.',
    };
  }

  if (updateResult.source === 'chrome-runtime') {
    try {
      chrome.runtime.reload();
      return {
        triggered: true,
        method: 'chrome-reload',
        message: `Applying update v${updateResult.latestVersion} and reloading extension...`,
      };
    } catch {
      // Fallback to download if reload fails
    }
  }

  if (updateResult.downloadUrl && typeof document !== 'undefined') {
    const a = document.createElement('a');
    a.href = updateResult.downloadUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    if (updateResult.assetName) {
      a.download = updateResult.assetName;
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    return {
      triggered: true,
      method: 'download-bundle',
      message: `New version v${updateResult.latestVersion} found! Automatically downloading update package (${updateResult.assetName || 'release.zip'}). Extract over your extension folder and click "Reload Extension" below.`,
    };
  }

  return {
    triggered: false,
    method: 'none',
    message: `Update v${updateResult.latestVersion} is available on GitHub.`,
  };
}
