// Just enough of the extension API for this code (the full typings aren't a dependency of the web app).
declare namespace chrome {
  namespace runtime {
    interface Port {
      name: string;
      sender?: { tab?: { id?: number; windowId?: number }; url?: string; origin?: string };
      postMessage(msg: unknown): void;
      disconnect(): void;
      onMessage: { addListener(fn: (msg: any, port: Port) => void): void };
      onDisconnect: { addListener(fn: (port: Port) => void): void };
    }
    const id: string;
    function connect(info: { name: string }): Port;
    function sendMessage(msg: unknown): Promise<any>;
    const onMessage: {
      addListener(fn: (msg: any, sender: { tab?: { id?: number }; url?: string; id?: string }, reply: (r: unknown) => void) => boolean | void): void;
    };
    function getURL(path: string): string;
    function getManifest(): { version: string; content_scripts?: { matches: string[]; js?: string[]; all_frames?: boolean; world?: string }[] };
    const onInstalled: { addListener(fn: (details: { reason: string }) => void): void };
    const onStartup: { addListener(fn: () => void): void };
    const onConnect: { addListener(fn: (port: Port) => void): void };
  }
  namespace tabs {
    interface Tab {
      id?: number;
      windowId?: number;
      url?: string;
      discarded?: boolean;
    }
    function query(q: { url?: string | string[]; active?: boolean; currentWindow?: boolean }): Promise<Tab[]>;
    function create(p: { url: string; active?: boolean }): Promise<Tab>;
    function update(id: number, p: { active?: boolean; url?: string }): Promise<unknown>;
  }
  namespace windows {
    function update(id: number, p: { focused?: boolean }): Promise<unknown>;
  }
  namespace storage {
    const local: {
      get(keys: string | string[]): Promise<Record<string, any>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
    };
    /** kept while the browser is open (cleared when it closes) */
    const session: {
      get(keys: string | string[]): Promise<Record<string, any>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  }
  namespace scripting {
    function executeScript(p: { target: { tabId: number; allFrames?: boolean }; files: string[]; world?: 'ISOLATED' | 'MAIN' }): Promise<unknown>;
  }
  namespace action {
    const onClicked: { addListener(fn: () => void): void };
    function setBadgeText(p: { tabId?: number; text: string }): Promise<void>;
    function setBadgeBackgroundColor(p: { tabId?: number; color: string }): Promise<void>;
    function setTitle(p: { tabId?: number; title: string }): Promise<void>;
  }
  namespace offscreen {
    function createDocument(p: { url: string; reasons: string[]; justification: string }): Promise<void>;
    function closeDocument(): Promise<void>;
    function hasDocument(): Promise<boolean>;
  }
}

/** Filled in by build.mjs: Soultied's Firebase settings (the same public ones the website uses), for watch parties. */
declare const __FIREBASE__: {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  firestoreDatabaseId?: string;
} | null;
/** Filled in by build.mjs: the address of local test emulators, or '' (always '' in a real build). */
declare const __EMULATOR__: string;
