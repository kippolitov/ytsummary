import { describe, it, expect, vi, beforeEach } from "vitest";
import { getChatSession, saveChatSession, clearChatSession } from "../../services/chatCache";
import type { ChatSession, ChatMessage } from "../../types/chat";

function makeMessage(role: "user" | "assistant", content: string, id: string): ChatMessage {
  return { id, role, content, type: "chat", timestamp: Date.now() };
}

function makeSession(videoId: string, messages: ChatMessage[] = []): ChatSession {
  const now = Date.now();
  return { videoId, messages, createdAt: now, updatedAt: now };
}

describe("chatCache", () => {
  beforeEach(() => {
    const storageMock = chrome.storage.session as {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
    };
    storageMock.get.mockReset();
    storageMock.set.mockReset();
    storageMock.remove?.mockReset();
  });

  it("getChatSession returns null when no session exists", async () => {
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const result = await getChatSession("abc12345678");
    expect(result).toBeNull();
  });

  it("saveChatSession persists session under chat_${videoId} key", async () => {
    const stored: Record<string, unknown> = {};
    (chrome.storage.session.set as ReturnType<typeof vi.fn>).mockImplementation(
      async (data: Record<string, unknown>) => { Object.assign(stored, data); }
    );
    const session = makeSession("abc12345678", [makeMessage("user", "Hello", "1")]);
    await saveChatSession(session);
    expect(stored["chat_abc12345678"]).toEqual(session);
  });

  it("getChatSession returns previously saved session", async () => {
    const store: Record<string, unknown> = {};
    (chrome.storage.session.set as ReturnType<typeof vi.fn>).mockImplementation(
      async (data: Record<string, unknown>) => { Object.assign(store, data); }
    );
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockImplementation(
      async (key: string) => ({ [key]: store[key] })
    );
    const session = makeSession("abc12345678", [makeMessage("user", "Question?", "2")]);
    await saveChatSession(session);
    const result = await getChatSession("abc12345678");
    expect(result).toEqual(session);
  });

  it("clearChatSession removes the session", async () => {
    const store: Record<string, unknown> = { "chat_abc12345678": makeSession("abc12345678") };
    (chrome.storage.session.remove as ReturnType<typeof vi.fn>).mockImplementation(
      async (key: string) => { delete store[key]; }
    );
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockImplementation(
      async (key: string) => ({ [key]: store[key] })
    );
    await clearChatSession("abc12345678");
    const result = await getChatSession("abc12345678");
    expect(result).toBeNull();
  });

  it("saveChatSession enforces 50-message cap by dropping oldest pair", async () => {
    const stored: Record<string, unknown> = {};
    (chrome.storage.session.set as ReturnType<typeof vi.fn>).mockImplementation(
      async (data: Record<string, unknown>) => { Object.assign(stored, data); }
    );

    const messages: ChatMessage[] = [];
    for (let i = 0; i < 51; i++) {
      messages.push(makeMessage(i % 2 === 0 ? "user" : "assistant", `msg${i}`, String(i)));
    }
    const session = makeSession("abc12345678", messages);
    await saveChatSession(session);

    const saved = stored["chat_abc12345678"] as ChatSession;
    expect(saved.messages.length).toBe(50);
    expect(saved.messages[0].id).toBe("1");
  });

  it("sessions for different videoIds are isolated", async () => {
    const store: Record<string, unknown> = {};
    (chrome.storage.session.set as ReturnType<typeof vi.fn>).mockImplementation(
      async (data: Record<string, unknown>) => { Object.assign(store, data); }
    );
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockImplementation(
      async (key: string) => ({ [key]: store[key] })
    );
    await saveChatSession(makeSession("aaaaaaaaaaa", [makeMessage("user", "A", "a1")]));
    const result = await getChatSession("bbbbbbbbbbb");
    expect(result).toBeNull();
  });
});
