import { normalizeRoomCode } from "@/lib/game/helpers";
import type { ApiError, ApiSuccess, SessionPayload } from "@/lib/game/types";

export function ok<T>(data: T, status = 200): Response {
  const body: ApiSuccess<T> = { ok: true, data };
  return Response.json(body, { status });
}

export function fail(message: string, status = 400): Response {
  const body: ApiError = { ok: false, error: message };
  return Response.json(body, { status });
}

export function statusFromErrorMessage(message: string): number {
  if (message.includes("introuvable")) {
    return 404;
  }
  if (message.includes("Session invalide")) {
    return 401;
  }
  if (message.includes("Seul l'hôte")) {
    return 403;
  }
  return 400;
}

export async function parseJsonBody<T extends Record<string, unknown>>(
  request: Request,
): Promise<T> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Le corps de requête doit être en JSON.");
  }

  return (await request.json()) as T;
}

export function parseRoomCodeParam(code: string): string {
  const normalized = normalizeRoomCode(code);
  if (normalized.length !== 4) {
    throw new Error("Code salon invalide.");
  }
  return normalized;
}

export function parseSession(
  payload: Record<string, unknown>,
  allowMissing = false,
): SessionPayload {
  const playerId = typeof payload.playerId === "string" ? payload.playerId : "";
  const sessionToken =
    typeof payload.sessionToken === "string" ? payload.sessionToken : "";

  if (allowMissing && !playerId && !sessionToken) {
    return { playerId: "", sessionToken: "" };
  }

  if (!playerId || !sessionToken) {
    throw new Error("Session invalide.");
  }

  return { playerId, sessionToken };
}
