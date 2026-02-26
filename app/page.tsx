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
    return `/room/${code}/lobby`;
  }

  if (phase === "FINAL_RESULTS") {
    return `/room/${code}/results`;
  }

  return `/room/${code}/game`;
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

  const hasUsername = playerName.trim().length > 0;

  async function handleCreate(event: FormEvent) {
    event.preventDefault();

    if (!hasUsername) {
      setError("Commencez par choisir un pseudo.");
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

    if (!hasUsername) {
      setError("Commencez par choisir un pseudo.");
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
    <main className="min-h-dvh bg-gradient-to-b from-game-bg-start to-game-bg-end px-4 py-8 text-foreground">
      <div className="mx-auto w-full max-w-md space-y-4">
        <header className="rounded-2xl bg-game-surface px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-game-accent-soft-foreground">
            Le jeu du Dico
          </p>
          <h1 className="mt-1 text-2xl font-black text-primary">Bluffe sur des définitions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Écris une définition plausible, vote pour la vraie, marque des points
          </p>
        </header>

        <section className="rounded-2xl bg-game-surface-strong px-4 py-4">
          <label className="block space-y-2 text-sm font-semibold text-muted-foreground">
            Pseudo
            <input
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder="Ex: Camille"
              maxLength={32}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base text-foreground outline-none ring-ring transition focus:ring-2"
            />
          </label>
        </section>

        <section className="space-y-3 rounded-2xl bg-game-surface-strong px-4 py-4">
          <form onSubmit={handleCreate}>
            <button
              type="submit"
              disabled={pendingAction !== null || !hasUsername}
              className="w-full rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingAction === "create" ? "Création..." : "Créer un salon"}
            </button>
          </form>

          <div className="relative py-1">
            <div className="h-px w-full bg-border" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs font-semibold uppercase tracking-[0.12em] text-game-accent-soft-foreground">
              ou
            </span>
          </div>

          <form className="space-y-3" onSubmit={handleJoin}>
            <label className="block space-y-2 text-sm font-semibold text-muted-foreground">
              Code
              <input
                value={normalizedRoomCode}
                onChange={(event) => setRoomCode(event.target.value)}
                placeholder="ABCD"
                maxLength={4}
                autoCapitalize="characters"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base uppercase tracking-[0.2em] text-foreground outline-none ring-ring transition focus:ring-2"
              />
            </label>

            <button
              type="submit"
              disabled={pendingAction !== null || !hasUsername}
              className="w-full rounded-xl bg-secondary px-4 py-3 text-base font-semibold text-secondary-foreground transition hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingAction === "join" ? "Connexion..." : "Rejoindre le salon"}
            </button>
          </form>
        </section>

        {error ? (
          <p className="rounded-xl bg-game-danger-soft px-3 py-2 text-sm text-game-danger-soft-foreground">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
