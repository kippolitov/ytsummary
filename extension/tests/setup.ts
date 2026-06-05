import "@testing-library/jest-dom";

// Minimal chrome API stub for unit tests
const chromeMock = {
  storage: {
    session: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
};

(globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;
