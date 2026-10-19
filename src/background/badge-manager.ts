/**
 * Badge Manager
 * Manages the extension badge (overdue/today task counts) and generates
 * notification icons via OffscreenCanvas so we never depend on icon files.
 */

/**
 * Update the extension badge to reflect overdue and due-today task counts.
 *
 * - Red badge (#DC2626) → overdue tasks exist
 * - Blue badge (#2563EB) → only today tasks
 * - Cleared badge → nothing actionable
 */
export async function updateBadgeForTasks(
  tasks: Array<{ dueDate: string | null; status: string }>
): Promise<void> {
  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  let overdueCount = 0;
  let todayCount = 0;

  for (const task of tasks) {
    // Skip tasks already marked as done / completed / closed
    const lowerStatus = task.status.toLowerCase();
    if (lowerStatus === 'done' || lowerStatus === 'completed' || lowerStatus === 'closed') {
      continue;
    }

    if (!task.dueDate) continue;

    const due = task.dueDate.slice(0, 10); // normalise to YYYY-MM-DD
    if (due < todayStr) {
      overdueCount++;
    } else if (due === todayStr) {
      todayCount++;
    }
  }

  const actionableCount = overdueCount + todayCount;

  if (actionableCount === 0) {
    await clearBadge();
    return;
  }

  const badgeColor = overdueCount > 0 ? '#DC2626' : '#2563EB';
  const badgeText = actionableCount > 99 ? '99+' : String(actionableCount);

  await chrome.action.setBadgeBackgroundColor({ color: badgeColor });
  await chrome.action.setBadgeText({ text: badgeText });
}

/** Clear the extension badge entirely. */
export async function clearBadge(): Promise<void> {
  await chrome.action.setBadgeText({ text: '' });
}

/**
 * Generate a simple icon data URL using OffscreenCanvas.
 * Draws a blue circle with white "PO" text — usable as a notification icon
 * without any bundled image files.
 *
 * @param size - Icon dimension in pixels (default 128)
 * @returns A data:image/png;base64 URL
 */
export async function generateIconDataUrl(size: number = 128): Promise<string> {
  // OffscreenCanvas is available in service workers (MV3)
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context from OffscreenCanvas');

  const center = size / 2;
  const radius = size / 2 - 2; // small padding for anti-alias

  // Background circle — brand blue
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#2563EB';
  ctx.fill();

  // "PO" text — white, bold, centered
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${Math.round(size * 0.38)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PO', center, center + 1); // +1px nudge for visual centering

  // Convert to data URL
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:image/png;base64,${btoa(binary)}`;
}
