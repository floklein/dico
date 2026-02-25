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
    const body = await parseJsonBody<Record<string, unknown>>(request);
    const session = parseSession(body);

    const snapshot = roomManager.playAgain(code, session);
    return ok({ snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    return fail(message, statusFromErrorMessage(message));
  }
}
