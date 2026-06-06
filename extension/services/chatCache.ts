import type { ChatSession } from "../types/chat";

const MAX_MESSAGES = 50;

function sessionKey(videoId: string): string {
  return `chat_${videoId}`;
}

export async function getChatSession(videoId: string): Promise<ChatSession | null> {
  const data = await chrome.storage.session.get(sessionKey(videoId));
  return (data[sessionKey(videoId)] as ChatSession) ?? null;
}

const STORAGE_WARN_BYTES = 8 * 1024 * 1024; // 8 MB

export async function saveChatSession(session: ChatSession): Promise<void> {
  let messages = session.messages;
  if (messages.length > MAX_MESSAGES) {
    messages = messages.slice(messages.length - MAX_MESSAGES);
  }
  const updated = { ...session, messages };
  await chrome.storage.session.set({ [sessionKey(session.videoId)]: updated });

  try {
    const bytesInUse = await chrome.storage.session.getBytesInUse();
    if (bytesInUse > STORAGE_WARN_BYTES) {
      console.warn(`[chatCache] Storage usage ${(bytesInUse / 1024 / 1024).toFixed(1)} MB exceeds 8 MB threshold`);
    }
  } catch {
    // getBytesInUse may be unavailable in some contexts; ignore silently
  }
}

export async function clearChatSession(videoId: string): Promise<void> {
  await chrome.storage.session.remove(sessionKey(videoId));
}
