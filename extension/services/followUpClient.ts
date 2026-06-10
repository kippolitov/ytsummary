import type { FollowUpPromptsRequest } from "../types/chat";

const FOLLOW_UP_TIMEOUT_MS = 10_000;

export async function fetchFollowUpPrompts(req: FollowUpPromptsRequest): Promise<string[]> {
  if (req.messages.length < 2) return [];

  const url = `${WXT_AZURE_FUNCTION_URL}/chat${WXT_AZURE_FUNCTION_KEY ? `?code=${WXT_AZURE_FUNCTION_KEY}` : ""}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FOLLOW_UP_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) return [];

    const data = await response.json() as unknown;
    if (
      typeof data !== "object" ||
      data === null ||
      !Array.isArray((data as Record<string, unknown>).prompts) ||
      ((data as Record<string, unknown>).prompts as unknown[]).length === 0
    ) {
      return [];
    }

    return (data as { prompts: string[] }).prompts;
  } catch {
    return [];
  }
}
