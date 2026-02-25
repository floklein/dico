"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  apiPost,
  clearRoomSession,
  loadRoomSession,
  saveRoomSession,
  useRoomStream,
  type RoomSession,
} from "@/lib/client/game-client";
import type { RoomState } from "@/lib/game/types";

function routeForPhase(code: string, phase: RoomState["phase"]): string {
  if (phase === "LOBBY") {
    return `/room/${code}/lobby`;
  }
  if (phase === "FINAL_RESULTS") {
    return `/room/${code}/results`;
  }
  return `/room/${code}/game`;
}

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const roomCode = useMemo(
    () => (params.code || "").toUpperCase(),
    [params.code],
  );
  const [session, setSession] = useState<RoomSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"start" | "leave" | null>(null);

  useEffect(() => {
    if (!roomCode) {
      return;
    }

    const stored = loadRoomSession(roomCode);
    if (!stored) {
      router.replace("/");
      return;
    }

    setSession(stored);

    void apiPost<{ playerName: string; session: RoomSession; snapshot: RoomState }>(
      `/api/rooms/${encodeURIComponent(roomCode)}/join`,
      {
        playerName: stored.playerName,
        playerId: stored.playerId,
        sessionToken: stored.sessionToken,
      },
    )
      .then((result) => {
        const updatedSession: RoomSession = {
          playerName: result.playerName,
          playerId: result.session.playerId,
          sessionToken: result.session.sessionToken,
        };
        saveRoomSession(roomCode, updatedSession);
        setSession(updatedSession);
      })
      .catch((err) => {
        clearRoomSession(roomCode);
        setError(err instanceof Error ? err.message : "Session invalide.");
        router.replace("/");
      });
  }, [roomCode, router]);

  const { snapshot, error: streamError } = useRoomStream(roomCode, session);

  useEffect(() => {
    if (!snapshot || !roomCode) {
      return;
    }

    if (snapshot.phase !== "LOBBY") {
      router.replace(routeForPhase(roomCode, snapshot.phase));
    }
  }, [roomCode, router, snapshot]);

  const me = useMemo(
    () => snapshot?.players.find((player) => player.id === session?.playerId),
    [session?.playerId, snapshot?.players],
  );

  async function handleStart(): Promise<void> {
    if (!session) {
      return;
    }

    setPendingAction("start");
    setError(null);

    try {
      await apiPost<{ snapshot: RoomState }>(
        `/api/rooms/${encodeURIComponent(roomCode)}/start`,
        {
          playerId: session.playerId,
          sessionToken: session.sessionToken,
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de démarrer.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleLeave(): Promise<void> {
    if (!session) {
      return;
    }

    setPendingAction("leave");
    setError(null);

    try {
      await apiPost<{ snapshot: RoomState | null }>(
        `/api/rooms/${encodeURIComponent(roomCode)}/leave`,
        {
          playerId: session.playerId,
          sessionToken: session.sessionToken,
        },
      );
    } catch {
      // Ignore leave failures; we still clear local session.
    } finally {
      clearRoomSession(roomCode);
      router.replace("/");
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-game-bg-start to-game-bg-end px-4 py-6 text-foreground">
      <div className="mx-auto w-full max-w-md space-y-4">
        <header className="rounded-2xl bg-game-surface px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-game-accent-soft-foreground">Lobby</p>
          <h1 className="mt-1 text-3xl font-black text-primary">{roomCode || "...."}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Attends les joueurs puis lance la partie</p>
        </header>

        <section className="rounded-2xl bg-game-surface-strong px-4 py-3 text-sm text-muted-foreground">
          <p>
            Vous êtes: <strong>{me?.name ?? session?.playerName ?? "..."}</strong>
          </p>
          <p>
            Hôte: <strong>{snapshot?.players.find((p) => p.isHost)?.name ?? "..."}</strong>
          </p>
          <p>
            Joueurs: <strong>{snapshot?.players.length ?? 0}</strong> / {snapshot?.settings.maxPlayers ?? 8}
          </p>
        </section>

        <ul className="space-y-2">
          {(snapshot?.players ?? []).map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between rounded-xl bg-game-surface-strong px-4 py-3"
            >
              <span className="font-semibold text-foreground">
                {player.name}
                {player.id === session?.playerId ? " (vous)" : ""}
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-game-accent-soft-foreground">
                {player.isHost ? "Hôte" : "Joueur"}
              </span>
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleStart}
            disabled={!me?.isHost || pendingAction !== null || (snapshot?.players.length ?? 0) < 2}
            className="w-full rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "start" ? "Démarrage..." : "Démarrer la partie"}
          </button>
          <button
            type="button"
            onClick={handleLeave}
            disabled={pendingAction !== null}
            className="w-full rounded-xl bg-secondary px-4 py-3 text-base font-semibold text-secondary-foreground transition hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Quitter le salon
          </button>
        </div>

        {error || streamError ? (
          <p className="rounded-xl bg-game-danger-soft px-3 py-2 text-sm text-game-danger-soft-foreground">
            {error ?? streamError}
          </p>
        ) : null}
      </div>
    </main>
  );
}
