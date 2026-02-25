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

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const roomCode = useMemo(
    () => (params.code || "").toUpperCase(),
    [params.code],
  );
  const [session, setSession] = useState<RoomSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"replay" | "leave" | null>(null);

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

    if (snapshot.phase !== "FINAL_RESULTS") {
      router.replace(routeForPhase(roomCode, snapshot.phase));
    }
  }, [roomCode, router, snapshot]);

  const sortedPlayers = useMemo(
    () =>
      [...(snapshot?.players ?? [])].sort(
        (a, b) => b.score - a.score || a.joinedAt - b.joinedAt,
      ),
    [snapshot?.players],
  );

  const topScore = sortedPlayers[0]?.score ?? 0;
  const winners = sortedPlayers.filter((player) => player.score === topScore);
  const me = sortedPlayers.find((player) => player.id === session?.playerId);

  async function handleReplay(): Promise<void> {
    if (!session) {
      return;
    }

    setPendingAction("replay");
    setError(null);

    try {
      await apiPost<{ snapshot: RoomState }>(
        `/api/rooms/${encodeURIComponent(roomCode)}/play-again`,
        {
          playerId: session.playerId,
          sessionToken: session.sessionToken,
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de relancer une partie.");
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
      // Ignore leave errors.
    } finally {
      clearRoomSession(roomCode);
      router.replace("/");
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 px-4 py-6 text-zinc-900">
      <div className="mx-auto w-full max-w-md space-y-4">
        <header className="rounded-2xl bg-white/75 px-4 py-4 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
            Partie terminée
          </p>
          <h1 className="mt-1 text-3xl font-black text-orange-900">Résultats finaux</h1>
          <p className="mt-1 text-sm text-zinc-700">
            {winners.length > 1
              ? `Égalité: ${winners.map((player) => player.name).join(", ")}`
              : `Vainqueur: ${winners[0]?.name ?? "-"}`}
          </p>
        </header>

        <ul className="space-y-2">
          {sortedPlayers.map((player, index) => {
            const isCurrentPlayer = player.id === session?.playerId;

            return (
                <li
                  key={player.id}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                    isCurrentPlayer
                    ? "bg-orange-100"
                    : "bg-white/85"
                }`}
              >
                <span className="text-sm font-semibold text-zinc-800">
                  #{index + 1} {player.name}
                  {isCurrentPlayer ? " (vous)" : ""}
                  {player.isHost ? " · hôte" : ""}
                </span>
                <span className="text-sm font-black text-orange-700">{player.score} pts</span>
              </li>
            );
          })}
        </ul>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleReplay}
            disabled={!me?.isHost || pendingAction !== null}
            className="w-full rounded-xl bg-orange-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "replay" ? "Relance..." : "Rejouer"}
          </button>
          <button
            type="button"
            onClick={handleLeave}
            disabled={pendingAction !== null}
            className="w-full rounded-xl bg-zinc-100 px-4 py-3 text-base font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Quitter
          </button>
        </div>

        {error || streamError ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error ?? streamError}
          </p>
        ) : null}
      </div>
    </main>
  );
}
