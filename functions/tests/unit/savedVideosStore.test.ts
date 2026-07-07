import { describe, it, expect, vi, beforeEach } from "vitest";
import { RestError } from "@azure/data-tables";
import type { SavedVideoRequest, SavedChatMessage } from "../../src/models/index";

const getEntity = vi.fn();
const upsertEntity = vi.fn();
const listEntities = vi.fn();
const createTable = vi.fn();

vi.mock("@azure/data-tables", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@azure/data-tables")>();
  return {
    ...actual,
    TableClient: {
      fromConnectionString: vi.fn(() => ({ getEntity, upsertEntity, listEntities, createTable })),
    },
  };
});

import { saveVideo, getVideo } from "../../src/services/savedVideosStore";

function notFoundError(): RestError {
  return new RestError("not found", { statusCode: 404 });
}

function lastUpsertedEntity(): Record<string, unknown> {
  const calls = upsertEntity.mock.calls as unknown[][];
  return calls.at(-1)![0] as Record<string, unknown>;
}

function asyncIterableOf<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]: async function* () {
      await Promise.resolve();
      for (const item of items) yield item;
    },
  };
}

const baseRequest: SavedVideoRequest = {
  videoTitle: "Test video",
  channelName: "Chan",
  videoUrl: "https://youtube.com/watch?v=abc12345678",
  durationSeconds: 300,
  summary: { videoId: "abc12345678", tldr: ["x"], topics: [], steps: [], references: [], analyzedAt: "2026-01-01T00:00:00.000Z" },
  messages: [{ id: "m1", role: "user", content: "hi", type: "chat", timestamp: 1 }],
};

describe("savedVideosStore", () => {
  beforeEach(() => {
    getEntity.mockReset();
    upsertEntity.mockReset().mockResolvedValue(undefined);
    listEntities.mockReset().mockReturnValue(asyncIterableOf([]));
    createTable.mockReset().mockResolvedValue(undefined);
  });

  describe("saveVideo — create", () => {
    it("creates a new saved video with savedAt === updatedAt", async () => {
      getEntity.mockRejectedValue(notFoundError());

      const result = await saveVideo("sub-1", "abc12345678", baseRequest);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok result");
      expect(result.response.savedAt).toBe(result.response.updatedAt);
      expect(result.response.videoTitle).toBe("Test video");
      expect(result.response.messages).toEqual(baseRequest.messages);
      expect(upsertEntity).toHaveBeenCalledWith(
        expect.objectContaining({ partitionKey: "sub-1", rowKey: "abc12345678" }),
        "Replace"
      );
    });

    it("rejects a create with limit-reached when the account already has 200 saved videos", async () => {
      getEntity.mockRejectedValue(notFoundError());
      listEntities.mockReturnValue(
        asyncIterableOf(Array.from({ length: 200 }, (_, i) => ({ rowKey: `v${i}` })))
      );

      const result = await saveVideo("sub-1", "abc12345678", baseRequest);

      expect(result).toEqual({ ok: false, reason: "limit-reached" });
      expect(upsertEntity).not.toHaveBeenCalled();
    });
  });

  describe("saveVideo — update", () => {
    it("preserves savedAt and updates chat history when appending new messages (FR-015)", async () => {
      const existing = {
        partitionKey: "sub-1",
        rowKey: "abc12345678",
        videoTitle: "Test video",
        channelName: "Chan",
        videoUrl: baseRequest.videoUrl,
        durationSeconds: 300,
        summaryJson: JSON.stringify(baseRequest.summary),
        chatJson0: JSON.stringify(baseRequest.messages),
        savedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
      getEntity.mockResolvedValue(existing);

      const updatedMessages: SavedChatMessage[] = [
        ...baseRequest.messages,
        { id: "m2", role: "assistant", content: "hello back", type: "chat", timestamp: 2 },
      ];
      const result = await saveVideo("sub-1", "abc12345678", { ...baseRequest, messages: updatedMessages });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok result");
      expect(result.response.savedAt).toBe("2026-01-01T00:00:00.000Z");
      expect(result.response.updatedAt).not.toBe("2026-01-01T00:00:00.000Z");
      expect(result.response.messages).toEqual(updatedMessages);
    });

    it("never rejects an update on the 200-cap, even when the account already has 200 rows", async () => {
      getEntity.mockResolvedValue({
        partitionKey: "sub-1",
        rowKey: "abc12345678",
        videoTitle: "Test video",
        channelName: "Chan",
        videoUrl: baseRequest.videoUrl,
        durationSeconds: 300,
        summaryJson: JSON.stringify(baseRequest.summary),
        savedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });

      const result = await saveVideo("sub-1", "abc12345678", baseRequest);

      expect(result.ok).toBe(true);
      expect(listEntities).not.toHaveBeenCalled();
    });
  });

  describe("chat history chunking (data-model.md §5)", () => {
    it("round-trips chat history split across chatJson0..3 chunk properties", async () => {
      getEntity.mockRejectedValue(notFoundError());
      const bigMessage = "x".repeat(50_000);
      const messages: SavedChatMessage[] = [
        { id: "m1", role: "user", content: bigMessage, type: "chat", timestamp: 1 },
        { id: "m2", role: "assistant", content: bigMessage, type: "chat", timestamp: 2 },
      ];

      await saveVideo("sub-1", "abc12345678", { ...baseRequest, messages });

      const entity = lastUpsertedEntity();
      expect(typeof entity.chatJson0).toBe("string");
      expect(typeof entity.chatJson1).toBe("string");

      getEntity.mockResolvedValue(entity);
      const fetched = await getVideo("sub-1", "abc12345678");
      expect(fetched!.messages).toEqual(messages);
    });

    it("caps saved chat history at the most recent 50 messages (FR-008a)", async () => {
      getEntity.mockRejectedValue(notFoundError());
      const messages: SavedChatMessage[] = Array.from({ length: 60 }, (_, i) => ({
        id: `m${i}`,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `message ${i}`,
        type: "chat",
        timestamp: i,
      }));

      await saveVideo("sub-1", "abc12345678", { ...baseRequest, messages });

      const entity = lastUpsertedEntity();
      getEntity.mockResolvedValue(entity);
      const fetched = await getVideo("sub-1", "abc12345678");
      expect(fetched!.messages).toHaveLength(50);
      expect(fetched!.messages[0].id).toBe("m10");
      expect(fetched!.messages.at(-1)!.id).toBe("m59");
    });

    it("omits unused trailing chunk properties rather than storing them empty", async () => {
      getEntity.mockRejectedValue(notFoundError());

      await saveVideo("sub-1", "abc12345678", baseRequest);

      const entity = lastUpsertedEntity();
      expect(entity.chatJson1).toBeUndefined();
      expect(entity.chatJson2).toBeUndefined();
      expect(entity.chatJson3).toBeUndefined();
    });
  });

  describe("getVideo", () => {
    it("returns null when no saved video exists for this (sub, videoId)", async () => {
      getEntity.mockRejectedValue(notFoundError());
      expect(await getVideo("sub-1", "abc12345678")).toBeNull();
    });

    it("rethrows non-404 errors", async () => {
      getEntity.mockRejectedValue(new RestError("boom", { statusCode: 500 }));
      await expect(getVideo("sub-1", "abc12345678")).rejects.toThrow("boom");
    });
  });
});
