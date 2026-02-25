"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, saveRoomSession } from "@/lib/client/game-client";
import type { RoomState } from "@/lib/game/types";

interface CreateRoomResponse {
  roomCode: string;
  playerName: string;
  session: {
    playerId: string;
    sessionToken: string;
  };
  snapshot: RoomState;
}

interface JoinRoomResponse {
  playerName: string;
  session: {
    playerId: string;
    sessionToken: string;
  };
  snapshot: RoomState;
}

function phasePath(code: string, phase: RoomState["phase"]): string {
  if (phase === "LOBBY") {
    return `/salle/${code}/lobby`;
  }

  if (phase === "FINAL_RESULTS") {
    return `/salle/${code}/resultats`;
  }

  return `/salle/${code}/jeu`;
}

export default function HomePage() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"create" | "join" | null>(null);

  const normalizedRoomCode = useMemo(
    () => roomCode.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4),
    [roomCode],
  );

  const canSubmit = playerName.trim().length > 0;

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      setError("Entrez un pseudo.");
      return;
    }

    setPendingAction("create");
    setError(null);

    try {
      const data = await apiPost<CreateRoomResponse>("/api/rooms", {
        playerName,
      });

      saveRoomSession(data.roomCode, {
        playerId: data.session.playerId,
        sessionToken: data.session.sessionToken,
        playerName: data.playerName,
      });

      router.push(phasePath(data.roomCode, data.snapshot.phase));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer le salon.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      setError("Entrez un pseudo.");
      return;
    }

    if (normalizedRoomCode.length !== 4) {
      setError("Le code salon doit contenir 4 lettres.");
      return;
    }

    setPendingAction("join");
    setError(null);

    try {
      const data = await apiPost<JoinRoomResponse>(
        `/api/rooms/${encodeURIComponent(normalizedRoomCode)}/join`,
        {
          playerName,
        },
      );

      saveRoomSession(normalizedRoomCode, {
        playerId: data.session.playerId,
        sessionToken: data.session.sessionToken,
        playerName: data.playerName,
      });

      router.push(phasePath(normalizedRoomCode, data.snapshot.phase));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de rejoindre le salon.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 px-4 py-10 text-zinc-900">
      <section className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-3xl border border-amber-300/60 bg-white/90 p-6 shadow-lg shadow-orange-200/50">
        <header className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
            Multijoueur
          </p>
          <h1 className="text-3xl font-black leading-tight text-orange-900">
            Le jeu du Dico
          </h1>
          <p className="text-sm text-zinc-700">
            Écris une fausse définition crédible, puis vote pour la vraie.
          </p>
        </header>

        <form className="space-y-4" onSubmit={handleCreate}>
          <label className="block space-y-2 text-sm font-semibold text-zinc-700">
            Pseudo
            <input
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder="Ex: Camille"
              maxLength={32}
              className="w-full rounded-2xl border border-amber-300 bg-white px-4 py-3 text-base outline-none ring-orange-400 transition focus:ring-2"
            />
          </label>

          <button
            type="submit"
            disabled={pendingAction !== null}
            className="w-full rounded-2xl bg-orange-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "create" ? "Création..." : "Créer un salon"}
          </button>
        </form>

        <div className="relative text-center text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
          <span className="bg-white px-3">ou rejoindre</span>
        </div>

        <form className="space-y-4" onSubmit={handleJoin}>
          <label className="block space-y-2 text-sm font-semibold text-zinc-700">
            Code salon (4 lettres)
            <input
              value={normalizedRoomCode}
              onChange={(event) => setRoomCode(event.target.value)}
              placeholder="ABCD"
              maxLength={4}
              autoCapitalize="characters"
              className="w-full rounded-2xl border border-amber-300 bg-white px-4 py-3 text-base uppercase tracking-[0.2em] outline-none ring-orange-400 transition focus:ring-2"
            />
          </label>

          <button
            type="submit"
            disabled={pendingAction !== null}
            className="w-full rounded-2xl border border-orange-600 px-4 py-3 text-base font-semibold text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "join" ? "Connexion..." : "Rejoindre le salon"}
          </button>
        </form>

        {error ? (
          <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
