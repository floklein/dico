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

function getPlayerOptionOwnerId(optionId: string): string | null {
  const match = optionId.match(/^player-\d+-(.+)$/);
  return match?.[1] ?? null;
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

  const isLastRoundResults = Boolean(
    snapshot?.phase === "ROUND_RESULTS" &&
      snapshot.round &&
      snapshot.round.roundNumber >= snapshot.settings.totalRounds,
  );

  const playerNameById = useMemo(
    () => new Map((snapshot?.players ?? []).map((player) => [player.id, player.name])),
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
    <main className="min-h-dvh bg-gradient-to-b from-game-bg-start to-game-bg-end px-4 py-5 text-foreground">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-xl flex-col">
        <div className="space-y-3">
          <header className="flex items-center justify-between gap-3 rounded-2xl bg-game-surface-strong px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-game-accent-soft-foreground">
            Manche {snapshot?.round?.roundNumber ?? "..."}/{snapshot?.settings.totalRounds ?? 5} · Salon {roomCode}
          </p>
          <div className="rounded-full bg-game-accent-soft px-3 py-1 text-sm font-black text-game-accent-soft-foreground">
            {secondsLeft ?? "--"}s
          </div>
          </header>

        {snapshot?.round?.word ? (
          <section className="rounded-2xl bg-game-surface px-4 py-4 text-center">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Mot</p>
            <p className="mt-1 text-3xl font-black text-primary">{snapshot.round.word}</p>
          </section>
        ) : null}

        {snapshot?.phase === "ERROR" ? (
          <section className="space-y-2 rounded-2xl bg-game-danger-soft px-4 py-4">
            <p className="text-sm font-semibold text-game-danger-soft-foreground">Erreur IA</p>
            <p className="text-sm text-game-danger-soft-foreground">
              {snapshot.errorMessage ?? "Une erreur IA est survenue pendant la manche."}
            </p>
          </section>
        ) : null}

        {snapshot?.phase === "WRITING" ? (
          <section className="space-y-3 rounded-2xl bg-game-surface-strong px-4 py-4">
            <p className="text-sm font-semibold text-muted-foreground">
              Écrivez une définition crédible pour piéger les autres joueurs
            </p>
            <textarea
              value={definitionInput}
              onChange={(event) => setDefinitionInput(event.target.value)}
              maxLength={280}
              rows={4}
              placeholder="Votre définition..."
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-base text-foreground outline-none ring-ring focus:ring-2"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-game-accent-soft-foreground">
                Soumissions: {snapshot.round?.submittedCount ?? 0}/{snapshot.players.length}
              </p>
              <button
                type="button"
                onClick={handleSubmitDefinition}
                disabled={pendingAction !== null || !definitionInput.trim()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
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
          <section className="space-y-3 rounded-2xl bg-game-surface-strong px-4 py-4">
            <p className="text-sm font-semibold text-muted-foreground">
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
                      ? "bg-game-accent-soft"
                      : "bg-background hover:bg-game-info-soft"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span className="mr-2 font-bold text-game-info-soft-foreground">{index + 1}.</span>
                  {option.text}
                </button>
              ))}
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-game-info-soft-foreground">
              Votes: {snapshot.round?.votedCount ?? 0}/{snapshot.players.length}
            </p>
          </section>
        ) : null}

        {snapshot?.phase === "ROUND_RESULTS" ? (
          <section className="space-y-3 rounded-2xl bg-game-surface-strong px-4 py-4">
            <p className="text-sm font-semibold text-muted-foreground">Révélation des définitions</p>
            <div className="space-y-2">
              {(snapshot.round?.options ?? []).map((option) => (
                (() => {
                  const isCorrect = option.id === snapshot.round?.correctOptionId;
                  const isCurrentPlayerVote = option.id === snapshot.round?.votedOptionId;
                  const ownerPlayerId = getPlayerOptionOwnerId(option.id);

                  const optionClassName = isCurrentPlayerVote
                    ? isCorrect
                      ? "bg-game-success-soft text-game-success-soft-foreground"
                      : "bg-game-danger-soft text-game-danger-soft-foreground"
                    : "bg-background";

                  const authorLabel = ownerPlayerId
                    ? ownerPlayerId === session?.playerId
                      ? "Vous"
                      : playerNameById.get(ownerPlayerId) ?? "Joueur inconnu"
                    : "Dictionnaire";

                  return (
                    <div
                      key={option.id}
                      className={`rounded-xl px-3 py-2 text-sm ${optionClassName}`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] opacity-90">
                          {authorLabel}
                        </span>
                        <div className="flex items-center gap-1">
                          {isCurrentPlayerVote ? (
                            <span className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-90">
                              Votre vote
                            </span>
                          ) : null}
                          {isCorrect ? (
                            <span className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-90">
                              Correct
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {option.text}
                    </div>
                  );
                })()
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Classement après la manche
              </p>
              {sortedPlayers.map((player) => {
                const roundGain = snapshot.round?.roundScoreDeltaByPlayerId?.[player.id] ?? 0;

                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-xl bg-background px-3 py-2"
                  >
                    <span className="text-sm font-semibold text-foreground">
                      {player.name}
                      {player.id === session?.playerId ? " (vous)" : ""}
                      {player.isHost ? " · hôte" : ""}
                    </span>
                    <div className="flex items-center gap-2">
                      {roundGain > 0 ? (
                        <span className="rounded-full bg-game-success-soft px-2 py-0.5 text-xs font-bold text-game-success-soft-foreground">
                          +{roundGain}
                        </span>
                      ) : null}
                      <span className="text-sm font-black text-primary">{player.score} pts</span>
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
                className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingAction === "next"
                  ? "Chargement..."
                  : isLastRoundResults
                    ? "Résultats finaux"
                    : "Manche suivante"}
              </button>
            ) : (
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-game-success-soft-foreground">
                {isLastRoundResults
                  ? "En attente de l&apos;hôte pour afficher les résultats finaux"
                  : "En attente de l&apos;hôte pour la manche suivante"}
              </p>
            )}
          </section>
        ) : null}

        {error || streamError ? (
          <p className="rounded-xl bg-game-danger-soft px-3 py-2 text-sm text-game-danger-soft-foreground">
            {error ?? streamError}
          </p>
        ) : null}
        </div>

        <button
          type="button"
          onClick={handleLeave}
          disabled={pendingAction !== null}
          className="mt-auto w-full rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Quitter la partie
        </button>
      </div>
    </main>
  );
}
