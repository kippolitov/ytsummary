import { TableClient, RestError } from "@azure/data-tables";
import type {
  SavedVideoRequest,
  SavedVideoDetailResponse,
  SavedVideoSummaryResponse,
  SavedChatMessage,
} from "../models/index";

const TABLE_NAME = "SavedVideos";
const MAX_SAVED_VIDEOS_PER_ACCOUNT = 200;
const MAX_CHAT_MESSAGES = 50;
const CHAT_CHUNK_COUNT = 4;
const CHAT_CHUNK_MAX_CHARS = 64 * 1024; // Table Storage's 64 KiB per-string-property limit

let client: TableClient | null = null;
let tableEnsured: Promise<void> | null = null;

function getClient(): TableClient {
  if (!client) {
    const connectionString = process.env.AzureWebJobsStorage ?? "";
    client = TableClient.fromConnectionString(connectionString, TABLE_NAME, {
      allowInsecureConnection: true,
    });
  }
  return client;
}

/** Creates the SavedVideos table on first use; idempotent (tolerates it already existing). */
async function ensureTable(): Promise<void> {
  if (!tableEnsured) {
    tableEnsured = getClient()
      .createTable()
      .catch((err) => {
        if (err instanceof RestError && err.statusCode === 409) return;
        tableEnsured = null;
        throw err;
      });
  }
  return tableEnsured;
}

export type SaveResult =
  | { ok: true; response: SavedVideoDetailResponse }
  | { ok: false; reason: "limit-reached" };

/** Splits (already 50-message-capped) chat JSON across chatJson0..3, truncating further if it still overflows the chunk budget. */
function chunkChatJson(messages: SavedChatMessage[]): Record<string, string> {
  let capped = messages.slice(-MAX_CHAT_MESSAGES);
  const maxTotalChars = CHAT_CHUNK_COUNT * CHAT_CHUNK_MAX_CHARS;

  let json = JSON.stringify(capped);
  while (json.length > maxTotalChars && capped.length > 0) {
    capped = capped.slice(1);
    json = JSON.stringify(capped);
  }

  const chunks: Record<string, string> = {};
  if (json === "[]") return chunks;

  for (let i = 0; i < CHAT_CHUNK_COUNT && json.length > 0; i++) {
    chunks[`chatJson${i}`] = json.slice(0, CHAT_CHUNK_MAX_CHARS);
    json = json.slice(CHAT_CHUNK_MAX_CHARS);
  }
  return chunks;
}

function unchunkChatJson(entity: Record<string, unknown>): SavedChatMessage[] {
  let json = "";
  for (let i = 0; i < CHAT_CHUNK_COUNT; i++) {
    const chunk = entity[`chatJson${i}`];
    if (typeof chunk === "string") json += chunk;
  }
  if (!json) return [];
  try {
    return JSON.parse(json) as SavedChatMessage[];
  } catch {
    return [];
  }
}

async function countSavedVideos(sub: string): Promise<number> {
  let count = 0;
  const escapedSub = sub.replace(/'/g, "''");
  const iter = getClient().listEntities({
    queryOptions: { filter: `PartitionKey eq '${escapedSub}'`, select: ["rowKey"] },
  });
  for await (const _entity of iter) {
    count++;
  }
  return count;
}

function toDetailResponse(videoId: string, entity: Record<string, unknown>): SavedVideoDetailResponse {
  return {
    videoId,
    videoTitle: entity.videoTitle as string,
    channelName: entity.channelName as string,
    videoUrl: entity.videoUrl as string,
    durationSeconds: entity.durationSeconds as number,
    summary: JSON.parse(entity.summaryJson as string) as SavedVideoDetailResponse["summary"],
    messages: unchunkChatJson(entity),
    savedAt: entity.savedAt as string,
    updatedAt: entity.updatedAt as string,
  };
}

/**
 * Idempotent create-or-update (data-model.md SavedVideos). Creates are rejected
 * with limit-reached once the caller's partition already holds 200 rows
 * (FR-019); updates to an already-saved video are never rejected on this basis.
 */
export async function saveVideo(
  sub: string,
  videoId: string,
  req: SavedVideoRequest
): Promise<SaveResult> {
  await ensureTable();

  let existing: Record<string, unknown> | null = null;
  try {
    existing = await getClient().getEntity(sub, videoId);
  } catch (err) {
    if (!(err instanceof RestError && err.statusCode === 404)) throw err;
  }

  if (!existing) {
    const count = await countSavedVideos(sub);
    if (count >= MAX_SAVED_VIDEOS_PER_ACCOUNT) {
      return { ok: false, reason: "limit-reached" };
    }
  }

  const now = new Date().toISOString();
  const entity = {
    partitionKey: sub,
    rowKey: videoId,
    videoTitle: req.videoTitle,
    channelName: req.channelName,
    videoUrl: req.videoUrl,
    durationSeconds: req.durationSeconds,
    summaryJson: JSON.stringify(req.summary),
    ...chunkChatJson(req.messages),
    savedAt: (existing?.savedAt as string | undefined) ?? now,
    updatedAt: now,
  };

  // "Replace" (not merge) so chunk properties dropped since the last save don't linger.
  await getClient().upsertEntity(entity, "Replace");

  return { ok: true, response: toDetailResponse(videoId, entity) };
}

/** Returns null (not-found) if the caller has no saved video for this videoId (FR-010: always scoped to sub). */
export async function getVideo(sub: string, videoId: string): Promise<SavedVideoDetailResponse | null> {
  await ensureTable();
  try {
    const entity = await getClient().getEntity(sub, videoId);
    return toDetailResponse(videoId, entity);
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 404) return null;
    throw err;
  }
}

const LIST_SELECT_FIELDS = [
  "rowKey",
  "videoTitle",
  "channelName",
  "videoUrl",
  "durationSeconds",
  "savedAt",
  "updatedAt",
];

/** Lists the caller's saved videos (FR-012), omitting summary/chat content to keep the list response small. */
export async function listVideos(sub: string): Promise<SavedVideoSummaryResponse[]> {
  await ensureTable();
  const escapedSub = sub.replace(/'/g, "''");
  const iter = getClient().listEntities({
    queryOptions: { filter: `PartitionKey eq '${escapedSub}'`, select: LIST_SELECT_FIELDS },
  });

  const videos: SavedVideoSummaryResponse[] = [];
  for await (const entity of iter) {
    videos.push({
      videoId: entity.rowKey as string,
      videoTitle: entity.videoTitle as string,
      channelName: entity.channelName as string,
      videoUrl: entity.videoUrl as string,
      durationSeconds: entity.durationSeconds as number,
      savedAt: entity.savedAt as string,
      updatedAt: entity.updatedAt as string,
    });
  }
  return videos;
}

/** Removes a saved video (US3 unsave); idempotent — absent rows are not an error. */
export async function deleteVideo(sub: string, videoId: string): Promise<void> {
  await ensureTable();
  try {
    await getClient().deleteEntity(sub, videoId);
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 404) return;
    throw err;
  }
}
