import {
  fail,
  parseRoomCodeParam,
  statusFromErrorMessage,
} from "@/lib/game/api";
import { roomManager } from "@/lib/game/store";
import type { RoomState } from "@/lib/game/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  try {
    const { code: rawCode } = await params;
    const code = parseRoomCodeParam(rawCode);
    const url = new URL(request.url);
    const viewerPlayerId = url.searchParams.get("playerId") || undefined;

    const encoder = new TextEncoder();

    let unsubscribe: (() => void) | null = null;
    let keepAliveTimer: NodeJS.Timeout | null = null;

    const sendEvent = (
      controller: ReadableStreamDefaultController<Uint8Array>,
      eventName: string,
      payload: RoomState,
    ): void => {
      controller.enqueue(
        encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`),
      );
    };

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        try {
          const initialSnapshot = roomManager.getSnapshot(code, viewerPlayerId);
          sendEvent(controller, "room", initialSnapshot);

          unsubscribe = roomManager.subscribe(code, viewerPlayerId, (snapshot) => {
            sendEvent(controller, "room", snapshot);
          });

          keepAliveTimer = setInterval(() => {
            controller.enqueue(encoder.encode(": ping\n\n"));
          }, 15000);
        } catch {
          controller.enqueue(
            encoder.encode("event: error\ndata: {\"error\":\"Salon indisponible\"}\n\n"),
          );
          controller.close();
        }
      },
      cancel() {
        if (keepAliveTimer) {
          clearInterval(keepAliveTimer);
        }
        unsubscribe?.();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    return fail(message, statusFromErrorMessage(message));
  }
}
