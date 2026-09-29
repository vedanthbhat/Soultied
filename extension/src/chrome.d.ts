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
    function getURL(path: string): string;
    function getManifest(): { version: string; content_scripts?: { matches: string[]; js?: string[] }[] };
    const onConnect: { addListener(fn: (port: Port) => void): void };
  }
  namespace tabs {
    function create(p: { url: string; active?: boolean }): Promise<unknown>;
    function update(id: number, p: { active?: boolean }): Promise<unknown>;
  }
  namespace windows {
    function update(id: number, p: { focused?: boolean }): Promise<unknown>;
  }
  namespace storage {
    const local: {
      get(keys: string | string[]): Promise<Record<string, any>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  }
  namespace action {
    const onClicked: { addListener(fn: () => void): void };
  }
}
