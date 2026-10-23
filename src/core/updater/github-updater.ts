import type {
  GitHubUpdateConfig,
  UpdateCheckResult,
  GitHubReleasePublishPayload,
  GitHubReleasePublishResult,
} from '../../types/schema';

export const DEFAULT_GITHUB_UPDATE_CONFIG: GitHubUpdateConfig = {
  repoSlug: 'sohilp60/Executive-Coach',
  branch: 'main',
  githubToken: '',
  autoUpdate: true,
};

export const DEFAULT_V020_TAG = 'v0.2.0';
export const DEFAULT_V020_ASSET_NAME = 'po-executive-coach-v0.2.0.zip';
export const DEFAULT_V020_RELEASE_TITLE =
  'v0.2.0 — GitHub Auto-Updater, Full Backup & Restore, and Notion Status/Delta Sync';

export const DEFAULT_V020_RELEASE_NOTES = `## Senior PO Executive Coach — Release v0.2.0

### Highlights & New Capabilities

1. **GitHub Release Checker & 1-Click Auto-Updater**
   - Added a dedicated **Extension Updates** module in Settings that queries GitHub Releases (\`sohilp60/Executive-Coach\`) and branch manifests for newer semantic versions.
   - Automatically triggers native browser extension reload when staged or downloads the latest release package (\`.zip\` / \`.crx\`) with release notes and changelog preview.
   - Includes a built-in **GitHub Release Publisher** in Settings to publish new releases and compiled \`.zip\` bundles directly to \`https://github.com/sohilp60/Executive-Coach/releases\`.

2. **Full Configuration & PO Memory Backup (Export / Import \`.json\`)**
   - Export all LLM provider configurations, custom endpoints, router fallback priorities, Notion settings, status filters, synced tasks, chat history, and the PO Memory Vault (profile, stakeholders, product rules, daily commitments) into a portable \`.json\` backup file.
   - Optional privacy toggle to include or strip API keys and tokens when exporting.
   - 1-click **Import Backup File (.json)** restores your entire workspace immediately on any fresh installation.

3. **Notion Status-Filtered Anti-Clutter Sync**
   - Automatically discovers all available task statuses from your Notion database schema and active pages.
   - Interactive status selector Modal & Settings filter lets you choose the exact Notion statuses you want to sync (defaulting to active statuses and excluding completed/archived clutter).

4. **Configurable Periodic Notion Delta Sync**
   - Set a background sync interval in minutes (\`Off\`, \`5m\`, \`10m\`, \`15m\`, \`30m\`, \`60m\`, or custom) powered by \`chrome.alarms\`.
   - Performs lightweight **Delta Updates** using Notion \`last_edited_time\` checkpoints—merging newly created or modified tasks and removing tasks whose status moved outside your selected filter.

5. **Unified Multi-LLM Router & Core Reliability Fixes**
   - Unified the Multi-LLM Router (Groq, NVIDIA NIM, Google Gemini, Anthropic Claude, OpenAI, Cerebras, Mistral, OpenRouter, plus Custom/Local Ollama & LM Studio providers) with dynamic \`/models\` syncing and PII scrubbing.
   - Persistent **Coach Strategy** callout sync to Notion pages, Universal Context Capture (\`Ctrl+Shift+K\`), and Morning Triage Must-Win workflow.

---

### Installation & Upgrade Instructions (Chrome & Microsoft Edge)

#### Option A: Updating an Existing Installation
1. Before updating (or if doing a clean install), open **Settings → Backup & Restore** and click **Export Full Backup (.json)** to save a snapshot of your keys and PO Memory.
2. Download **\`po-executive-coach-v0.2.0.zip\`** from the **Assets** section below (\`https://github.com/sohilp60/Executive-Coach/releases\`).
3. Extract the \`.zip\` archive over your existing unpacked extension folder (or into a new folder).
4. In **Settings → Extension Updates**, click **Reload Extension** (or visit \`chrome://extensions\` / \`edge://extensions\` and click the **Reload** icon on *Senior PO Executive Coach*).
5. If you extracted into a new folder on a fresh profile, open **Settings → Backup & Restore** and click **Import Backup File (.json)** to restore all settings in one click.

#### Option B: Fresh Unpacked Installation
1. Download and extract **\`po-executive-coach-v0.2.0.zip\`** to a permanent folder on your computer.
2. Open \`chrome://extensions\` (Chrome) or \`edge://extensions\` (Edge).
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the extracted folder containing \`manifest.json\`.`;

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
  return '0.2.0';
}

/**
 * Normalizes a GitHub repository input (URL or owner/repo) into "owner/repo".
 * Automatically migrates legacy "Sohil56/Executive-Coach" to "sohilp60/Executive-Coach".
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
    const slug = `${parts[0]}/${parts[1]}`;
    if (slug.toLowerCase() === 'sohil56/executive-coach') {
      return 'sohilp60/Executive-Coach';
    }
    return slug;
  }
  if (cleaned.toLowerCase() === 'sohil56/executive-coach') {
    return 'sohilp60/Executive-Coach';
  }
  return cleaned || DEFAULT_GITHUB_UPDATE_CONFIG.repoSlug;
}

/**
 * Builds a pre-filled GitHub New Release URL for https://github.com/sohilp60/Executive-Coach/releases/new
 * so the user can also publish the release directly in their browser with 0 token setup.
 */
export function buildGitHubWebReleaseUrl(params?: {
  repoSlug?: string;
  tagName?: string;
  targetCommitish?: string;
  releaseName?: string;
  body?: string;
}): string {
  const slug = normalizeRepoSlug(params?.repoSlug || DEFAULT_GITHUB_UPDATE_CONFIG.repoSlug);
  const tag = (params?.tagName || DEFAULT_V020_TAG).trim();
  const target = (params?.targetCommitish || 'main').trim() || 'main';
  const title = (params?.releaseName || DEFAULT_V020_RELEASE_TITLE).trim();
  const body = params?.body || DEFAULT_V020_RELEASE_NOTES;

  const query = new URLSearchParams({
    tag,
    target,
    title,
    body,
  });

  return `https://github.com/${slug}/releases/new?${query.toString()}`;
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
    repoSlug: normalizeRepoSlug(
      configOverride?.repoSlug ?? storedConfig.repoSlug ?? DEFAULT_GITHUB_UPDATE_CONFIG.repoSlug
    ),
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
      error: 'Invalid GitHub repository format. Use "owner/repo" (e.g., sohilp60/Executive-Coach).',
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
      const preferredAsset = assets.find((a) => /\.(zip|crx)$/i.test(a.name)) || assets[0];

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
 * Publishes or updates a GitHub Release (e.g., v0.2.0 on sohilp60/Executive-Coach)
 * and optionally attaches the compiled extension .zip package to the release.
 */
export async function publishGitHubRelease(
  payload: GitHubReleasePublishPayload
): Promise<GitHubReleasePublishResult> {
  const repoSlug = normalizeRepoSlug(payload.repoSlug || DEFAULT_GITHUB_UPDATE_CONFIG.repoSlug);
  const token = (payload.githubToken || '').trim();
  const tagName = (payload.tagName || DEFAULT_V020_TAG).trim();
  const targetCommitish = (payload.targetCommitish || 'main').trim() || 'main';
  const releaseName = (payload.releaseName || DEFAULT_V020_RELEASE_TITLE).trim();
  const body = payload.body || DEFAULT_V020_RELEASE_NOTES;
  const assetName = (payload.assetName || DEFAULT_V020_ASSET_NAME).trim();

  if (!repoSlug.includes('/')) {
    return {
      ok: false,
      tagName,
      error: 'Invalid GitHub repository format. Expected "owner/repo" (e.g., sohilp60/Executive-Coach).',
    };
  }

  if (!token) {
    return {
      ok: false,
      tagName,
      error:
        'A GitHub Personal Access Token (with "repo" or "Contents: Read and write" scope) is required to create a release on GitHub.',
    };
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  try {
    // Best-effort: update manifest.json version on the target branch if it exists and is older
    try {
      const cleanVer = tagName.replace(/^[vV]/, '') || '0.2.0';
      const mfUrl = `https://api.github.com/repos/${repoSlug}/contents/manifest.json?ref=${encodeURIComponent(targetCommitish)}`;
      const mfRes = await fetch(mfUrl, { headers });
      if (mfRes.ok) {
        const mfData = await mfRes.json();
        if (mfData?.content && mfData?.sha) {
          const decoded = JSON.parse(atob(String(mfData.content).replace(/\s/g, '')));
          if (decoded.version !== cleanVer) {
            decoded.version = cleanVer;
            const updatedJsonStr = JSON.stringify(decoded, null, 2) + '\n';
            const encodedContent = btoa(unescape(encodeURIComponent(updatedJsonStr)));
            await fetch(`https://api.github.com/repos/${repoSlug}/contents/manifest.json`, {
              method: 'PUT',
              headers,
              body: JSON.stringify({
                message: `chore(release): bump manifest.json version to ${cleanVer}`,
                content: encodedContent,
                sha: mfData.sha,
                branch: targetCommitish,
              }),
            });
          }
        }
      }
    } catch {
      // Non-fatal if branch manifest update is skipped
    }

    // Step 1: Create the GitHub Release (or update if tag already has a release)
    let releaseData: any = null;
    let updatedExisting = false;

    const createRes = await fetch(`https://api.github.com/repos/${repoSlug}/releases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tag_name: tagName,
        target_commitish: targetCommitish,
        name: releaseName,
        body,
        draft: Boolean(payload.draft),
        prerelease: Boolean(payload.prerelease),
        generate_release_notes: false,
      }),
    });

    if (createRes.ok) {
      releaseData = await createRes.json();
    } else if (createRes.status === 422) {
      // Release for this tag_name likely already exists — find and update it
      let existingRel: any = null;
      const byTagRes = await fetch(
        `https://api.github.com/repos/${repoSlug}/releases/tags/${encodeURIComponent(tagName)}`,
        { headers }
      );
      if (byTagRes.ok) {
        existingRel = await byTagRes.json();
      } else {
        const listRes = await fetch(`https://api.github.com/repos/${repoSlug}/releases?per_page=30`, {
          headers,
        });
        if (listRes.ok) {
          const list = await listRes.json();
          if (Array.isArray(list)) {
            existingRel = list.find((r: any) => r.tag_name === tagName);
          }
        }
      }

      if (existingRel?.id) {
        const patchRes = await fetch(
          `https://api.github.com/repos/${repoSlug}/releases/${existingRel.id}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              tag_name: tagName,
              target_commitish: targetCommitish,
              name: releaseName,
              body,
              draft: Boolean(payload.draft),
              prerelease: Boolean(payload.prerelease),
            }),
          }
        );
        if (patchRes.ok) {
          releaseData = await patchRes.json();
          updatedExisting = true;
        } else {
          const errTxt = await patchRes.text().catch(() => '');
          return {
            ok: false,
            tagName,
            error: `Failed to update existing release ${tagName} (HTTP ${patchRes.status}): ${errTxt.slice(0, 180)}`,
          };
        }
      } else {
        const errJson = await createRes.json().catch(() => ({}));
        return {
          ok: false,
          tagName,
          error:
            errJson?.message ||
            'GitHub returned HTTP 422 (Unprocessable Entity). Ensure the repository is not empty and the branch exists.',
        };
      }
    } else {
      let errMsg = `GitHub API returned HTTP ${createRes.status}`;
      try {
        const errJson = await createRes.json();
        if (errJson?.message) errMsg += `: ${errJson.message}`;
      } catch {
        const txt = await createRes.text().catch(() => '');
        if (txt) errMsg += `: ${txt.slice(0, 160)}`;
      }
      return {
        ok: false,
        tagName,
        error: errMsg,
      };
    }

    const releaseId: number = releaseData.id;
    const htmlUrl: string = releaseData.html_url || `https://github.com/${repoSlug}/releases/tag/${tagName}`;
    let assetUploaded = false;
    let assetDownloadUrl = '';
    let assetWarning: string | undefined;

    // Step 2: Upload compiled extension .zip asset if requested
    if (payload.attachCompiledZip !== false && releaseId) {
      try {
        // Fetch the pre-compiled extension zip bundle from public assets
        let zipUrl = `/${assetName}`;
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
            zipUrl = chrome.runtime.getURL(assetName);
          }
        } catch {
          zipUrl = `/${assetName}`;
        }

        let zipRes = await fetch(zipUrl);
        if (!zipRes.ok && zipUrl !== `/${assetName}`) {
          zipRes = await fetch(`/${assetName}`);
        }

        if (zipRes.ok) {
          const zipBuffer = await zipRes.arrayBuffer();

          // If updating an existing release, remove any previous asset with the same name
          if (Array.isArray(releaseData.assets)) {
            const duplicateAsset = releaseData.assets.find((a: any) => a.name === assetName);
            if (duplicateAsset?.id) {
              await fetch(
                `https://api.github.com/repos/${repoSlug}/releases/assets/${duplicateAsset.id}`,
                {
                  method: 'DELETE',
                  headers: {
                    Accept: 'application/vnd.github+json',
                    Authorization: `Bearer ${token}`,
                  },
                }
              ).catch(() => {});
            }
          }

          const uploadEndpoint = `https://uploads.github.com/repos/${repoSlug}/releases/${releaseId}/assets?name=${encodeURIComponent(assetName)}`;
          const uploadRes = await fetch(uploadEndpoint, {
            method: 'POST',
            headers: {
              Accept: 'application/vnd.github+json',
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/zip',
            },
            body: zipBuffer,
          });

          if (uploadRes.ok) {
            const uploadedAsset = await uploadRes.json();
            assetUploaded = true;
            assetDownloadUrl = uploadedAsset.browser_download_url || '';
          } else {
            const upErr = await uploadRes.text().catch(() => '');
            assetWarning = `Release ${tagName} was published, but attaching ${assetName} returned HTTP ${uploadRes.status}${upErr ? `: ${upErr.slice(0, 120)}` : ''}.`;
          }
        } else {
          assetWarning = `Release ${tagName} was published (source zipball available), but local ${assetName} bundle could not be fetched for attachment.`;
        }
      } catch (zipErr: any) {
        assetWarning = `Release ${tagName} was published, but uploading the .zip asset encountered an error: ${zipErr?.message || String(zipErr)}`;
      }
    }

    const finalDownloadUrl =
      assetDownloadUrl ||
      `https://github.com/${repoSlug}/archive/refs/tags/${encodeURIComponent(tagName)}.zip`;

    // Persist updated GitHub config in storage
    const cleanLatestVer = tagName.replace(/^[vV]/, '') || '0.2.0';
    const storedRes = (await chrome.storage.local.get('po_github_update_config')) as Record<string, any>;
    const existingCfg: GitHubUpdateConfig =
      (storedRes?.po_github_update_config as GitHubUpdateConfig) || DEFAULT_GITHUB_UPDATE_CONFIG;

    await chrome.storage.local.set({
      po_github_update_config: {
        ...existingCfg,
        repoSlug,
        branch: targetCommitish,
        githubToken: token,
        lastCheckedISO: new Date().toISOString(),
        latestAvailableVersion: cleanLatestVer,
        latestReleaseUrl: htmlUrl,
        latestDownloadUrl: finalDownloadUrl,
        latestReleaseNotes: body,
      },
    });

    return {
      ok: true,
      releaseId,
      tagName,
      releaseName,
      htmlUrl,
      assetUploaded,
      assetName,
      assetDownloadUrl: finalDownloadUrl,
      assetWarning,
      updatedExisting,
    };
  } catch (err: any) {
    return {
      ok: false,
      tagName,
      error: `Failed to publish release to GitHub: ${err?.message || String(err)}`,
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
