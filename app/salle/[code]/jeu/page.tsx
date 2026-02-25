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
    <main className="min-h-screen bg-gradient-to-b from-orange-50 to-amber-100 px-4 py-6 text-zinc-900">
      <section className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-3xl border border-amber-300/60 bg-white/90 p-4 shadow-lg shadow-orange-200/40">
        <header className="flex items-start justify-between gap-3 rounded-2xl bg-orange-50 px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">
              Manche {snapshot?.round?.roundNumber ?? "..."} / {snapshot?.settings.totalRounds ?? 5}
            </p>
            <h1 className="text-xl font-black text-orange-900">Le jeu du Dico</h1>
            <p className="text-sm text-zinc-700">Salon {roomCode}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Temps restant</p>
            <p className="text-2xl font-black text-orange-700">{secondsLeft ?? "--"}s</p>
          </div>
        </header>

        {snapshot?.round?.word ? (
          <div className="rounded-2xl border border-orange-200 bg-white px-4 py-3 text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Mot</p>
            <p className="mt-1 text-3xl font-black text-orange-900">{snapshot.round.word}</p>
          </div>
        ) : null}

        {snapshot?.phase === "WRITING" ? (
          <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-zinc-700">
              Écrivez une définition crédible pour piéger les autres joueurs.
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
          </div>
        ) : null}

        {snapshot?.phase === "VOTING" ? (
          <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-sm font-semibold text-zinc-700">
              Votez pour la définition que vous pensez correcte.
            </p>
            <div className="space-y-2">
              {(snapshot.round?.options ?? []).map((option, index) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleVote(option.id)}
                  disabled={pendingAction !== null}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                    snapshot.round?.votedOptionId === option.id
                      ? "border-orange-500 bg-orange-100"
                      : "border-sky-200 bg-white hover:bg-sky-100"
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
          </div>
        ) : null}

        {snapshot?.phase === "ROUND_RESULTS" ? (
          <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-zinc-700">Résultats de la manche.</p>
            <div className="space-y-2">
              {(snapshot.round?.options ?? []).map((option) => (
                <div
                  key={option.id}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    option.id === snapshot.round?.correctOptionId
                      ? "border-emerald-500 bg-emerald-100 text-emerald-900"
                      : "border-emerald-200 bg-white"
                  }`}
                >
                  {option.text}
                </div>
              ))}
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
                En attente de l&apos;hôte pour la manche suivante.
              </p>
            )}
          </div>
        ) : null}

        <section className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
            Classement en direct
          </p>
          {[...(snapshot?.players ?? [])]
            .sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt)
            .map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2"
              >
                <span className="text-sm font-semibold text-zinc-800">
                  {player.name}
                  {player.id === session?.playerId ? " (vous)" : ""}
                  {player.isHost ? " · hôte" : ""}
                </span>
                <span className="text-sm font-black text-orange-700">{player.score} pts</span>
              </div>
            ))}
        </section>

        <button
          type="button"
          onClick={handleLeave}
          disabled={pendingAction !== null}
          className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Quitter la partie
        </button>

        {error || streamError ? (
          <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error ?? streamError}
          </p>
        ) : null}
      </section>
    </main>
  );
}
