"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RoomState } from "@/lib/game/types";

export interface RoomSession {
  playerId: string;
  sessionToken: string;
  playerName: string;
}

function sessionStorageKey(roomCode: string): string {
  return `dico-session-${roomCode.toUpperCase()}`;
}

export function loadRoomSession(roomCode: string): RoomSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(sessionStorageKey(roomCode));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as RoomSession;
    if (!parsed.playerId || !parsed.sessionToken || !parsed.playerName) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveRoomSession(roomCode: string, session: RoomSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(sessionStorageKey(roomCode), JSON.stringify(session));
}

export function clearRoomSession(roomCode: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(sessionStorageKey(roomCode));
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error ?? "Erreur réseau.");
  }

  return payload.data;
}

export async function apiPost<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return parseEnvelope<T>(response);
}

export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  return parseEnvelope<T>(response);
}

export function useRoomStream(
  roomCode: string,
  session: RoomSession | null,
): {
  snapshot: RoomState | null;
  error: string | null;
  reload: () => Promise<void>;
} {
  const [snapshot, setSnapshot] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      const query = new URLSearchParams({ playerId: session.playerId });
      const data = await apiGet<{ snapshot: RoomState }>(
        `/api/rooms/${encodeURIComponent(roomCode)}/snapshot?${query.toString()}`,
      );
      setSnapshot(data.snapshot);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    }
  }, [roomCode, session]);

  const eventUrl = useMemo(() => {
    if (!session) {
      return null;
    }

    const query = new URLSearchParams({ playerId: session.playerId });
    return `/api/rooms/${encodeURIComponent(roomCode)}/events?${query.toString()}`;
  }, [roomCode, session]);

  useEffect(() => {
    if (!session || !eventUrl) {
      return;
    }

    let isActive = true;

    const source = new EventSource(eventUrl);

    const onRoom = (event: MessageEvent<string>) => {
      if (!isActive) {
        return;
      }

      try {
        const next = JSON.parse(event.data) as RoomState;
        setSnapshot(next);
        setError(null);
      } catch {
        setError("Erreur de synchronisation temps réel.");
      }
    };

    source.addEventListener("room", onRoom as EventListener);
    source.addEventListener("error", () => {
      if (isActive) {
        setError("Connexion temps réel interrompue.");
      }
    });

    return () => {
      isActive = false;
      source.removeEventListener("room", onRoom as EventListener);
      source.close();
    };
  }, [eventUrl, session]);

  return {
    snapshot,
    error,
    reload: fetchSnapshot,
  };
}
