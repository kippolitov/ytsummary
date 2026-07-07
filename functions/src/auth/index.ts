import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { withAuth } from "../services/auth";
import { saveVideo, getVideo, listVideos, deleteVideo } from "../services/savedVideosStore";
import { isSavedVideoRequest, AuthenticatedUser, FunctionError } from "../models/index";

const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

export async function putSavedVideoHandler(
  request: HttpRequest,
  context: InvocationContext,
  user: AuthenticatedUser
): Promise<HttpResponseInit> {
  const videoId = request.params.videoId;
  if (!videoId || !VIDEO_ID_PATTERN.test(videoId)) {
    return errorResponse(400, "invalid-request", "Invalid videoId.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid-request", "Request body must be valid JSON.");
  }

  if (!isSavedVideoRequest(body)) {
    return errorResponse(
      400,
      "invalid-request",
      "Missing or invalid required fields: videoTitle, channelName, videoUrl, durationSeconds, summary, messages."
    );
  }

  try {
    const result = await saveVideo(user.sub, videoId, body);
    if (!result.ok) {
      return errorResponse(
        409,
        "saved-video-limit-reached",
        "You already have 200 saved videos — remove a saved video before saving another."
      );
    }
    return { status: 200, headers: corsHeaders(), jsonBody: result.response };
  } catch (err) {
    context.error("saveVideo failed:", err);
    return errorResponse(500, "service-error", "Save failed. Please try again.");
  }
}

export async function getSavedVideoHandler(
  request: HttpRequest,
  context: InvocationContext,
  user: AuthenticatedUser
): Promise<HttpResponseInit> {
  const videoId = request.params.videoId;
  if (!videoId || !VIDEO_ID_PATTERN.test(videoId)) {
    return errorResponse(400, "invalid-request", "Invalid videoId.");
  }

  try {
    const video = await getVideo(user.sub, videoId);
    if (!video) {
      return errorResponse(404, "not-found", "No saved video found for this videoId.");
    }
    return { status: 200, headers: corsHeaders(), jsonBody: video };
  } catch (err) {
    context.error("getVideo failed:", err);
    return errorResponse(500, "service-error", "Could not load the saved video.");
  }
}

export async function listSavedVideosHandler(
  _request: HttpRequest,
  context: InvocationContext,
  user: AuthenticatedUser
): Promise<HttpResponseInit> {
  try {
    const videos = await listVideos(user.sub);
    return { status: 200, headers: corsHeaders(), jsonBody: { videos } };
  } catch (err) {
    context.error("listVideos failed:", err);
    return errorResponse(500, "service-error", "Could not load saved videos.");
  }
}

export async function deleteSavedVideoHandler(
  request: HttpRequest,
  context: InvocationContext,
  user: AuthenticatedUser
): Promise<HttpResponseInit> {
  const videoId = request.params.videoId;
  if (!videoId || !VIDEO_ID_PATTERN.test(videoId)) {
    return errorResponse(400, "invalid-request", "Invalid videoId.");
  }

  try {
    await deleteVideo(user.sub, videoId);
    return { status: 204, headers: corsHeaders() };
  } catch (err) {
    context.error("deleteVideo failed:", err);
    return errorResponse(500, "service-error", "Could not remove the saved video.");
  }
}

function errorResponse(status: number, code: string, message: string): HttpResponseInit {
  const body: FunctionError = { error: { code, message } };
  return { status, headers: corsHeaders(), jsonBody: body };
}

function corsHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-functions-key",
  };
}

app.http("saved-videos-put", {
  methods: ["PUT"],
  authLevel: "function",
  route: "saved-videos/{videoId}",
  handler: withAuth(putSavedVideoHandler),
});

app.http("saved-videos-get-one", {
  methods: ["GET"],
  authLevel: "function",
  route: "saved-videos/{videoId}",
  handler: withAuth(getSavedVideoHandler),
});

app.http("saved-videos-item-preflight", {
  methods: ["OPTIONS"],
  authLevel: "anonymous",
  route: "saved-videos/{videoId}",
  handler: () => ({ status: 204, headers: corsHeaders() }),
});

app.http("saved-videos-list", {
  methods: ["GET"],
  authLevel: "function",
  route: "saved-videos",
  handler: withAuth(listSavedVideosHandler),
});

app.http("saved-videos-delete", {
  methods: ["DELETE"],
  authLevel: "function",
  route: "saved-videos/{videoId}",
  handler: withAuth(deleteSavedVideoHandler),
});

app.http("saved-videos-list-preflight", {
  methods: ["OPTIONS"],
  authLevel: "anonymous",
  route: "saved-videos",
  handler: () => ({ status: 204, headers: corsHeaders() }),
});
