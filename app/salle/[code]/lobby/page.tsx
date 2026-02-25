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
    return `/salle/${code}/lobby`;
  }
  if (phase === "FINAL_RESULTS") {
    return `/salle/${code}/resultats`;
  }
  return `/salle/${code}/jeu`;
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
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 px-4 py-8 text-zinc-900">
      <section className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-3xl border border-amber-300/60 bg-white/90 p-5 shadow-lg shadow-orange-200/40">
        <header className="space-y-1 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">
            Salon
          </p>
          <h1 className="text-3xl font-black text-orange-900">{roomCode || "...."}</h1>
          <p className="text-sm text-zinc-700">Attente des joueurs avant le lancement.</p>
        </header>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>
            Vous êtes: <strong>{me?.name ?? session?.playerName ?? "..."}</strong>
          </p>
          <p>
            Hôte: <strong>{snapshot?.players.find((p) => p.isHost)?.name ?? "..."}</strong>
          </p>
          <p>
            Joueurs: <strong>{snapshot?.players.length ?? 0}</strong> / {snapshot?.settings.maxPlayers ?? 8}
          </p>
        </div>

        <ul className="space-y-2">
          {(snapshot?.players ?? []).map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between rounded-2xl border border-orange-200 bg-white px-4 py-3"
            >
              <span className="font-semibold text-zinc-800">
                {player.name}
                {player.id === session?.playerId ? " (vous)" : ""}
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-orange-700">
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
            className="w-full rounded-2xl bg-orange-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "start" ? "Démarrage..." : "Démarrer la partie"}
          </button>
          <button
            type="button"
            onClick={handleLeave}
            disabled={pendingAction !== null}
            className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-base font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Quitter le salon
          </button>
        </div>

        {error || streamError ? (
          <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error ?? streamError}
          </p>
        ) : null}
      </section>
    </main>
  );
}
