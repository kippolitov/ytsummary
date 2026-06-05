import { describe, it, expect, vi, beforeEach } from "vitest";
import { getResult, setResult, hasResult } from "../../services/sessionCache";
import type { AnalysisResult } from "../../types/index";

const mockResult: AnalysisResult = {
  videoId: "abc12345678",
  summary: "A test summary.",
  topics: [],
  steps: [],
  references: [],
  analyzedAt: "2026-06-05T10:00:00Z",
};

describe("sessionCache", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Reset chrome.storage.session mock to empty state
    const storageMock = chrome.storage.session as {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
    };
    storageMock.get.mockReset();
    storageMock.set.mockReset();
  });

  it("getResult returns null for an empty cache", async () => {
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const result = await getResult("abc12345678");
    expect(result).toBeNull();
  });

  it("setResult then getResult returns the stored value", async () => {
    const store: Record<string, unknown> = {};
    (chrome.storage.session.set as ReturnType<typeof vi.fn>).mockImplementation(
      async (data: Record<string, unknown>) => { Object.assign(store, data); }
    );
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockImplementation(
      async (key: string) => ({ [key]: store[key] })
    );

    await setResult("abc12345678", mockResult);
    const result = await getResult("abc12345678");
    expect(result).toEqual(mockResult);
  });

  it("distinct videoIds are isolated in the cache", async () => {
    const store: Record<string, unknown> = {};
    (chrome.storage.session.set as ReturnType<typeof vi.fn>).mockImplementation(
      async (data: Record<string, unknown>) => { Object.assign(store, data); }
    );
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockImplementation(
      async (key: string) => ({ [key]: store[key] })
    );

    await setResult("abc12345678", mockResult);
    const result = await getResult("zzz99999999");
    expect(result).toBeNull();
  });

  it("hasResult returns false for missing key", async () => {
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const result = await hasResult("abc12345678");
    expect(result).toBe(false);
  });

  it("hasResult returns true after setResult", async () => {
    const store: Record<string, unknown> = {};
    (chrome.storage.session.set as ReturnType<typeof vi.fn>).mockImplementation(
      async (data: Record<string, unknown>) => { Object.assign(store, data); }
    );
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockImplementation(
      async (key: string) => ({ [key]: store[key] })
    );

    await setResult("abc12345678", mockResult);
    const result = await hasResult("abc12345678");
    expect(result).toBe(true);
  });
});
