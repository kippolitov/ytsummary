import "@testing-library/jest-dom";

// Minimal chrome API stub for unit tests
const chromeMock = {
  storage: {
    session: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  sidePanel: {
    setPanelBehavior: vi.fn().mockResolvedValue(undefined),
  },
  identity: {
    launchWebAuthFlow: vi.fn(),
    getRedirectURL: vi.fn(() => "https://test-extension-id.chromiumapp.org/"),
  },
};

(globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;

// jsdom does not implement matchMedia (used by useTheme)
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList;
}

// jsdom does not implement scrollIntoView (used by ChatPanel auto-scroll)
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
