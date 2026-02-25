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

export default function GamePage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const roomCode = useMemo(
    () => (params.code || "").toUpperCase(),
    [params.code],
  );
  const [session, setSession] = useState<RoomSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [definitionInput, setDefinitionInput] = useState("");
  const [pendingAction, setPendingAction] = useState<
    "submit" | "vote" | "next" | "leave" | null
  >(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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

    if (snapshot.phase === "LOBBY" || snapshot.phase === "FINAL_RESULTS") {
      router.replace(routeForPhase(roomCode, snapshot.phase));
    }
  }, [roomCode, router, snapshot]);

  const me = useMemo(
    () => snapshot?.players.find((player) => player.id === session?.playerId),
    [session?.playerId, snapshot?.players],
  );

  const secondsLeft = useMemo(() => {
    const phaseEndsAt = snapshot?.round?.phaseEndsAt;
    if (!phaseEndsAt) {
      return null;
    }

    return Math.max(0, Math.ceil((phaseEndsAt - nowMs) / 1000));
  }, [nowMs, snapshot?.round?.phaseEndsAt]);

  const sortedPlayers = useMemo(
    () =>
      [...(snapshot?.players ?? [])].sort(
        (a, b) => b.score - a.score || a.joinedAt - b.joinedAt,
      ),
    [snapshot?.players],
  );

  useEffect(() => {
    if (snapshot?.phase === "WRITING") {
      setDefinitionInput("");
    }
  }, [snapshot?.phase, snapshot?.round?.roundNumber]);

  async function handleSubmitDefinition(): Promise<void> {
    if (!session || !snapshot || !definitionInput.trim()) {
      return;
    }

    setPendingAction("submit");
    setError(null);

    try {
      await apiPost<{ snapshot: RoomState }>(
        `/api/rooms/${encodeURIComponent(roomCode)}/submit`,
        {
          playerId: session.playerId,
          sessionToken: session.sessionToken,
          definition: definitionInput,
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'envoyer la définition.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleVote(optionId: string): Promise<void> {
    if (!session) {
      return;
    }

    setPendingAction("vote");
    setError(null);

    try {
      await apiPost<{ snapshot: RoomState }>(
        `/api/rooms/${encodeURIComponent(roomCode)}/vote`,
        {
          playerId: session.playerId,
          sessionToken: session.sessionToken,
          optionId,
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'envoyer le vote.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleNextRound(): Promise<void> {
    if (!session) {
      return;
    }

    setPendingAction("next");
    setError(null);

    try {
      await apiPost<{ snapshot: RoomState }>(
        `/api/rooms/${encodeURIComponent(roomCode)}/next-round`,
        {
          playerId: session.playerId,
          sessionToken: session.sessionToken,
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de passer à la manche suivante.");
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
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 px-4 py-5 text-zinc-900">
      <div className="mx-auto w-full max-w-xl space-y-3">
        <header className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-800">
            Manche {snapshot?.round?.roundNumber ?? "..."}/{snapshot?.settings.totalRounds ?? 5} · Salon {roomCode}
          </p>
          <div className="rounded-full bg-orange-100 px-3 py-1 text-sm font-black text-orange-800">
            {secondsLeft ?? "--"}s
          </div>
        </header>

        {snapshot?.round?.word ? (
          <section className="rounded-2xl bg-white/80 px-4 py-4 text-center">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Mot</p>
            <p className="mt-1 text-3xl font-black text-orange-900">{snapshot.round.word}</p>
          </section>
        ) : null}

        {snapshot?.phase === "ERROR" ? (
          <section className="space-y-2 rounded-2xl bg-red-50 px-4 py-4">
            <p className="text-sm font-semibold text-red-800">Erreur IA</p>
            <p className="text-sm text-red-700">
              {snapshot.errorMessage ?? "Une erreur IA est survenue pendant la manche."}
            </p>
          </section>
        ) : null}

        {snapshot?.phase === "WRITING" ? (
          <section className="space-y-3 rounded-2xl bg-white/85 px-4 py-4">
            <p className="text-sm font-semibold text-zinc-700">
              Écrivez une définition crédible pour piéger les autres joueurs
            </p>
            <textarea
              value={definitionInput}
              onChange={(event) => setDefinitionInput(event.target.value)}
              maxLength={280}
              rows={4}
              placeholder="Votre définition..."
              className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm outline-none ring-orange-400 focus:ring-2"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
                Soumissions: {snapshot.round?.submittedCount ?? 0}/{snapshot.players.length}
              </p>
              <button
                type="button"
                onClick={handleSubmitDefinition}
                disabled={pendingAction !== null || !definitionInput.trim()}
                className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {snapshot.round?.hasSubmitted
                  ? "Modifier ma définition"
                  : pendingAction === "submit"
                    ? "Envoi..."
                    : "Envoyer"}
              </button>
            </div>
          </section>
        ) : null}

        {snapshot?.phase === "VOTING" ? (
          <section className="space-y-3 rounded-2xl bg-white/85 px-4 py-4">
            <p className="text-sm font-semibold text-zinc-700">
              Votez pour la définition que vous pensez correcte
            </p>
            <div className="space-y-2">
              {(snapshot.round?.options ?? []).map((option, index) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleVote(option.id)}
                  disabled={pendingAction !== null}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                    snapshot.round?.votedOptionId === option.id
                      ? "bg-orange-100"
                      : "bg-white hover:bg-sky-100"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span className="mr-2 font-bold text-sky-700">{index + 1}.</span>
                  {option.text}
                </button>
              ))}
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
              Votes: {snapshot.round?.votedCount ?? 0}/{snapshot.players.length}
            </p>
          </section>
        ) : null}

        {snapshot?.phase === "ROUND_RESULTS" ? (
          <section className="space-y-3 rounded-2xl bg-white/90 px-4 py-4">
            <p className="text-sm font-semibold text-zinc-700">Révélation des définitions</p>
            <div className="space-y-2">
              {(snapshot.round?.options ?? []).map((option) => (
                <div
                  key={option.id}
                  className={`rounded-xl px-3 py-2 text-sm ${
                    option.id === snapshot.round?.correctOptionId
                      ? "bg-emerald-100 text-emerald-900"
                      : "bg-white"
                  }`}
                >
                  {option.text}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                Classement après la manche
              </p>
              {sortedPlayers.map((player) => {
                const roundGain = snapshot.round?.roundScoreDeltaByPlayerId?.[player.id] ?? 0;

                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-xl bg-white px-3 py-2"
                  >
                    <span className="text-sm font-semibold text-zinc-800">
                      {player.name}
                      {player.id === session?.playerId ? " (vous)" : ""}
                      {player.isHost ? " · hôte" : ""}
                    </span>
                    <div className="flex items-center gap-2">
                      {roundGain > 0 ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                          +{roundGain}
                        </span>
                      ) : null}
                      <span className="text-sm font-black text-orange-700">{player.score} pts</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {me?.isHost ? (
              <button
                type="button"
                onClick={handleNextRound}
                disabled={pendingAction !== null}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingAction === "next" ? "Chargement..." : "Manche suivante"}
              </button>
            ) : (
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                En attente de l&apos;hôte pour la manche suivante
              </p>
            )}
          </section>
        ) : null}

        <button
          type="button"
          onClick={handleLeave}
          disabled={pendingAction !== null}
          className="w-full rounded-xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Quitter la partie
        </button>

        {error || streamError ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error ?? streamError}
          </p>
        ) : null}
      </div>
    </main>
  );
}
