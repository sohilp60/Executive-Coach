/**
 * Chrome Extension Runtime Polyfill for Web Preview Environments.
 *
 * Automatically polyfills `window.chrome` with an in-memory/localStorage-backed
 * implementation when running outside an active Chrome Extension environment.
 * Ensures the app operates seamlessly in both standalone web preview and extension mode.
 */

export function setupChromePolyfill(): void {
  if (typeof window === 'undefined') return;

  const w = window as any;
  if (!w.chrome) {
    w.chrome = {};
  }

  // 1. chrome.storage.local
  if (!w.chrome.storage) {
    w.chrome.storage = {};
  }
  if (!w.chrome.storage.local) {
    const memoryStore: Record<string, any> = {};

    w.chrome.storage.local = {
      get: (keys: string | string[] | Record<string, any> | null, callback?: (result: Record<string, any>) => void): Promise<Record<string, any>> => {
        return new Promise((resolve) => {
          const result: Record<string, any> = {};

          if (keys === null) {
            // Get all
            try {
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k) {
                  try {
                    result[k] = JSON.parse(localStorage.getItem(k) || 'null');
                  } catch {
                    result[k] = localStorage.getItem(k);
                  }
                }
              }
            } catch {
              Object.assign(result, memoryStore);
            }
          } else if (typeof keys === 'string') {
            try {
              const val = localStorage.getItem(keys);
              result[keys] = val ? JSON.parse(val) : memoryStore[keys];
            } catch {
              result[keys] = memoryStore[keys];
            }
          } else if (Array.isArray(keys)) {
            for (const k of keys) {
              try {
                const val = localStorage.getItem(k);
                result[k] = val ? JSON.parse(val) : memoryStore[k];
              } catch {
                result[k] = memoryStore[k];
              }
            }
          } else if (typeof keys === 'object') {
            for (const [k, defaultVal] of Object.entries(keys)) {
              try {
                const val = localStorage.getItem(k);
                result[k] = val ? JSON.parse(val) : (memoryStore[k] ?? defaultVal);
              } catch {
                result[k] = memoryStore[k] ?? defaultVal;
              }
            }
          }

          if (callback) callback(result);
          resolve(result);
        });
      },

      set: (items: Record<string, any>, callback?: () => void): Promise<void> => {
        return new Promise((resolve) => {
          for (const [k, v] of Object.entries(items)) {
            memoryStore[k] = v;
            try {
              localStorage.setItem(k, JSON.stringify(v));
            } catch {
              // Ignore localStorage quota errors in preview
            }
          }
          if (callback) callback();
          resolve();
        });
      },

      remove: (keys: string | string[], callback?: () => void): Promise<void> => {
        return new Promise((resolve) => {
          const arr = Array.isArray(keys) ? keys : [keys];
          for (const k of arr) {
            delete memoryStore[k];
            try {
              localStorage.removeItem(k);
            } catch {}
          }
          if (callback) callback();
          resolve();
        });
      },

      clear: (callback?: () => void): Promise<void> => {
        return new Promise((resolve) => {
          for (const k of Object.keys(memoryStore)) delete memoryStore[k];
          try {
            localStorage.clear();
          } catch {}
          if (callback) callback();
          resolve();
        });
      },
    };
  }

  // 2. chrome.runtime messaging
  if (!w.chrome.runtime) {
    w.chrome.runtime = {};
  }

  const messageListeners = new Set<(message: any, sender: any, sendResponse: (res?: any) => void) => boolean | undefined>();

  if (!w.chrome.runtime.onMessage) {
    w.chrome.runtime.onMessage = {
      addListener: (fn: any) => messageListeners.add(fn),
      removeListener: (fn: any) => messageListeners.delete(fn),
      hasListener: (fn: any) => messageListeners.has(fn),
    };
  }

  if (!w.chrome.runtime.sendMessage) {
    w.chrome.runtime.sendMessage = (message: any, responseCallback?: (response: any) => void): Promise<any> => {
      return new Promise((resolve) => {
        let responded = false;
        const sendResponse = (res: any) => {
          if (!responded) {
            responded = true;
            if (responseCallback) responseCallback(res);
            resolve(res);
          }
        };

        // Notify in-process listeners
        let willRespondLater = false;
        for (const listener of messageListeners) {
          try {
            const ret = listener(message, { tab: { id: 1, windowId: 1 } }, sendResponse);
            if (ret === true) willRespondLater = true;
          } catch (e) {
            console.warn('[RuntimePolyfill] Listener error:', e);
          }
        }

        // If no listener handled it or will respond asynchronously, resolve with empty response
        if (!willRespondLater && !responded) {
          setTimeout(() => {
            if (!responded) {
              sendResponse({ ok: true, fallback: true });
            }
          }, 50);
        }
      });
    };
  }

  if (!w.chrome.runtime.getURL) {
    w.chrome.runtime.getURL = (path: string) => path;
  }

  // 3. chrome.tabs
  if (!w.chrome.tabs) {
    w.chrome.tabs = {
      query: (_queryInfo: any, callback?: (tabs: any[]) => void): Promise<any[]> => {
        const dummyTabs = [
          {
            id: 1,
            windowId: 1,
            active: true,
            title: document.title || 'Product Dashboard',
            url: window.location.href,
          },
        ];
        if (callback) callback(dummyTabs);
        return Promise.resolve(dummyTabs);
      },
      create: (props: { url: string }, callback?: (tab: any) => void): Promise<any> => {
        if (props.url) {
          window.open(props.url, '_blank');
        }
        const createdTab = { id: 2, url: props.url };
        if (callback) callback(createdTab);
        return Promise.resolve(createdTab);
      },
      onActivated: {
        addListener: () => {},
        removeListener: () => {},
      },
      onUpdated: {
        addListener: () => {},
        removeListener: () => {},
      },
    };
  }

  // 4. chrome.action
  if (!w.chrome.action) {
    w.chrome.action = {
      setBadgeText: () => Promise.resolve(),
      setBadgeBackgroundColor: () => Promise.resolve(),
      onClicked: {
        addListener: () => {},
        removeListener: () => {},
      },
    };
  }

  // 5. chrome.alarms
  if (!w.chrome.alarms) {
    w.chrome.alarms = {
      create: () => {},
      onAlarm: {
        addListener: () => {},
        removeListener: () => {},
      },
    };
  }

  // 6. chrome.identity
  if (!w.chrome.identity) {
    w.chrome.identity = {
      getRedirectURL: () => window.location.origin + '/oauth2_callback',
      launchWebAuthFlow: async (details: { url: string; interactive: boolean }) => {
        if (details.interactive && window.confirm(`Simulate OAuth sign-in flow for:\n${details.url}\n\nClick OK to simulate success.`)) {
          return `${window.location.origin}/oauth2_callback#access_token=mock_preview_token_${Date.now()}`;
        }
        throw new Error('User cancelled auth flow');
      },
    };
  }
}
