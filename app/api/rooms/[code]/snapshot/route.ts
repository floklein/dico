import {
  fail,
  ok,
  parseRoomCodeParam,
  statusFromErrorMessage,
} from "@/lib/game/api";
import { roomManager } from "@/lib/game/store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  try {
    const { code: rawCode } = await params;
    const code = parseRoomCodeParam(rawCode);
    const url = new URL(request.url);
    const viewerPlayerId = url.searchParams.get("playerId") || undefined;

    return ok({ snapshot: roomManager.getSnapshot(code, viewerPlayerId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    return fail(message, statusFromErrorMessage(message));
  }
}
