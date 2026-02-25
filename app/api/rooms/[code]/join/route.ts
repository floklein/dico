import {
  fail,
  ok,
  parseJsonBody,
  parseRoomCodeParam,
  parseSession,
  statusFromErrorMessage,
} from "@/lib/game/api";
import { roomManager } from "@/lib/game/store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  try {
    const { code: rawCode } = await params;
    const code = parseRoomCodeParam(rawCode);

    const body = await parseJsonBody<{
      playerName?: string;
      playerId?: string;
      sessionToken?: string;
    }>(request);

    const playerName = typeof body.playerName === "string" ? body.playerName : "";
    const session = parseSession(body, true);

    const result = roomManager.joinRoom(
      code,
      playerName,
      session.playerId && session.sessionToken ? session : undefined,
    );

    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    return fail(message, statusFromErrorMessage(message));
  }
}
