import { ok, fail, parseJsonBody, statusFromErrorMessage } from "@/lib/game/api";
import { roomManager } from "@/lib/game/store";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await parseJsonBody<{ playerName?: string }>(request);
    const playerName = typeof body.playerName === "string" ? body.playerName : "";

    const result = roomManager.createRoom(playerName);
    return ok(result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    return fail(message, statusFromErrorMessage(message));
  }
}
