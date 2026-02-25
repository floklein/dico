import {
  createRoomCode,
  ensureUniquePlayerName,
  normalizePlayerName,
  normalizeRoomCode,
  randomId,
  randomSessionToken,
  shuffle,
} from "@/lib/game/helpers";
import { generateRoundWord, normalizeAndFillDefinitions } from "@/lib/game/ai";
import type {
  DefinitionOption,
  GameSettings,
  InternalDefinitionOption,
  InternalRoom,
  InternalRoundState,
  PlayerRoundDefinition,
  PlayerState,
  RoomState,
  SessionPayload,
} from "@/lib/game/types";

interface Subscriber {
  id: string;
  viewerPlayerId?: string;
  onUpdate: (snapshot: RoomState) => void;
}

const DEFAULT_SETTINGS: GameSettings = {
  totalRounds: 5,
  writingDurationSec: 45,
  votingDurationSec: 20,
  minPlayers: 2,
  maxPlayers: 8,
};

function now(): number {
  return Date.now();
}

export class RoomManager {
  private rooms = new Map<string, InternalRoom>();
  private subscribers = new Map<string, Map<string, Subscriber>>();

  private clearTimer(room: InternalRoom): void {
    if (room.roundTimeout) {
      clearTimeout(room.roundTimeout);
      room.roundTimeout = null;
    }
  }

  private getRoomOrThrow(codeInput: string): InternalRoom {
    const code = normalizeRoomCode(codeInput);
    const room = this.rooms.get(code);
    if (!room) {
      throw new Error("Salon introuvable.");
    }
    return room;
  }

  private touchRoom(room: InternalRoom): void {
    room.updatedAt = now();
  }

  private removeRoomIfEmpty(room: InternalRoom): void {
    if (room.players.size > 0) {
      return;
    }

    this.clearTimer(room);
    this.rooms.delete(room.code);
    this.subscribers.delete(room.code);
  }

  private ensureHost(room: InternalRoom): void {
    if (room.players.has(room.hostId)) {
      return;
    }

    const nextHost = [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (nextHost) {
      room.hostId = nextHost.id;
    }
  }

  private assertHost(room: InternalRoom, playerId: string): void {
    if (room.hostId !== playerId) {
      throw new Error("Seul l'hôte peut effectuer cette action.");
    }
  }

  private getPublicPlayers(room: InternalRoom): PlayerState[] {
    return [...room.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((player) => ({
        id: player.id,
        name: player.name,
        score: player.score,
        isHost: player.id === room.hostId,
        connected: player.connected,
        joinedAt: player.joinedAt,
      }));
  }

  private getSubmittedCount(room: InternalRoom): number {
    if (!room.round) {
      return 0;
    }

    let count = 0;
    for (const definition of room.round.definitionsByPlayerId.values()) {
      if (definition.rawDefinition?.trim()) {
        count += 1;
      }
    }

    return count;
  }

  private getPublicOptions(room: InternalRoom): DefinitionOption[] {
    if (!room.round) {
      return [];
    }

    return room.round.options.map((option) => ({
      id: option.id,
      text: option.text,
    }));
  }

  getSnapshot(codeInput: string, viewerPlayerId?: string): RoomState {
    const room = this.getRoomOrThrow(codeInput);
    const round = room.round;

    return {
      code: room.code,
      phase: room.phase,
      hostId: room.hostId,
      players: this.getPublicPlayers(room),
      settings: room.settings,
      round: round
        ? {
            roundNumber: round.roundNumber,
            totalRounds: room.settings.totalRounds,
            word: room.phase === "LOBBY" ? null : round.word,
            options:
              room.phase === "WRITING"
                ? []
                : this.getPublicOptions(room),
            phaseStartedAt: round.phaseStartedAt,
            phaseEndsAt: round.phaseEndsAt,
            submittedCount: this.getSubmittedCount(room),
            votedCount: round.votesByPlayerId.size,
            hasSubmitted: viewerPlayerId
              ? Boolean(round.definitionsByPlayerId.get(viewerPlayerId)?.rawDefinition?.trim())
              : false,
            hasVoted: viewerPlayerId ? round.votesByPlayerId.has(viewerPlayerId) : false,
            votedOptionId: viewerPlayerId
              ? round.votesByPlayerId.get(viewerPlayerId) ?? null
              : null,
            correctOptionId:
              room.phase === "ROUND_RESULTS" || room.phase === "FINAL_RESULTS"
                ? round.correctOptionId
                : null,
            roundScoreDeltaByPlayerId:
              room.phase === "ROUND_RESULTS"
                ? Object.fromEntries(round.roundScoreDeltaByPlayerId.entries())
                : null,
          }
        : null,
      updatedAt: room.updatedAt,
    };
  }

  private broadcast(code: string): void {
    const subs = this.subscribers.get(code);
    if (!subs || subs.size === 0) {
      return;
    }

    for (const sub of subs.values()) {
      try {
        sub.onUpdate(this.getSnapshot(code, sub.viewerPlayerId));
      } catch {
        // Ignore subscriber failures.
      }
    }
  }

  subscribe(
    codeInput: string,
    viewerPlayerId: string | undefined,
    onUpdate: (snapshot: RoomState) => void,
  ): () => void {
    const code = normalizeRoomCode(codeInput);
    if (!this.rooms.has(code)) {
      throw new Error("Salon introuvable.");
    }

    const roomSubs = this.subscribers.get(code) ?? new Map<string, Subscriber>();
    this.subscribers.set(code, roomSubs);

    const id = randomId("sub");
    roomSubs.set(id, { id, viewerPlayerId, onUpdate });

    return () => {
      const subs = this.subscribers.get(code);
      subs?.delete(id);
      if (subs && subs.size === 0) {
        this.subscribers.delete(code);
      }
    };
  }

  createRoom(playerNameInput: string): {
    roomCode: string;
    playerName: string;
    session: SessionPayload;
    snapshot: RoomState;
  } {
    const playerName = normalizePlayerName(playerNameInput);
    if (!playerName) {
      throw new Error("Le pseudo est obligatoire.");
    }

    const roomCode = createRoomCode(new Set(this.rooms.keys()));
    const playerId = randomId("player");
    const sessionToken = randomSessionToken();
    const joinedAt = now();

    const room: InternalRoom = {
      code: roomCode,
      hostId: playerId,
      players: new Map([
        [
          playerId,
          {
            id: playerId,
            sessionToken,
            name: playerName,
            score: 0,
            joinedAt,
            connected: true,
          },
        ],
      ]),
      phase: "LOBBY",
      settings: { ...DEFAULT_SETTINGS },
      round: null,
      roundTimeout: null,
      currentRoundNumber: 0,
      usedWords: new Set<string>(),
      isFinalizingWriting: false,
      isFinalizingVoting: false,
      updatedAt: joinedAt,
    };

    this.rooms.set(roomCode, room);

    return {
      roomCode,
      playerName,
      session: {
        playerId,
        sessionToken,
      },
      snapshot: this.getSnapshot(roomCode, playerId),
    };
  }

  joinRoom(
    codeInput: string,
    playerNameInput: string,
    session?: SessionPayload,
  ): {
    playerName: string;
    session: SessionPayload;
    snapshot: RoomState;
  } {
    const room = this.getRoomOrThrow(codeInput);
    const normalizedName = normalizePlayerName(playerNameInput);

    if (!normalizedName) {
      throw new Error("Le pseudo est obligatoire.");
    }

    if (session) {
      const existingPlayer = room.players.get(session.playerId);
      if (existingPlayer && existingPlayer.sessionToken === session.sessionToken) {
        existingPlayer.connected = true;
        this.touchRoom(room);
        this.broadcast(room.code);

        return {
          playerName: existingPlayer.name,
          session,
          snapshot: this.getSnapshot(room.code, existingPlayer.id),
        };
      }
    }

    if (room.players.size >= room.settings.maxPlayers) {
      throw new Error("Le salon est complet.");
    }

    const existingNames = [...room.players.values()].map((player) => player.name);
    const playerName = ensureUniquePlayerName(normalizedName, existingNames);
    const playerId = randomId("player");
    const sessionToken = randomSessionToken();

    room.players.set(playerId, {
      id: playerId,
      sessionToken,
      name: playerName,
      score: 0,
      joinedAt: now(),
      connected: true,
    });

    this.touchRoom(room);
    this.broadcast(room.code);

    return {
      playerName,
      session: {
        playerId,
        sessionToken,
      },
      snapshot: this.getSnapshot(room.code, playerId),
    };
  }

  validateSession(codeInput: string, session: SessionPayload): void {
    const room = this.getRoomOrThrow(codeInput);
    const player = room.players.get(session.playerId);

    if (!player || player.sessionToken !== session.sessionToken) {
      throw new Error("Session invalide.");
    }
  }

  leaveRoom(codeInput: string, session: SessionPayload): RoomState | null {
    const room = this.getRoomOrThrow(codeInput);
    this.validateSession(codeInput, session);

    room.players.delete(session.playerId);
    this.ensureHost(room);

    if (room.players.size < room.settings.minPlayers && room.phase !== "LOBBY") {
      this.clearTimer(room);
      room.phase = "FINAL_RESULTS";
      if (room.round) {
        room.round.phaseEndsAt = null;
        room.round.phaseStartedAt = now();
      }
    }

    this.touchRoom(room);
    this.broadcast(room.code);
    this.removeRoomIfEmpty(room);

    if (!this.rooms.has(room.code)) {
      return null;
    }

    return this.getSnapshot(room.code);
  }

  private scheduleWritingTimeout(room: InternalRoom, roundNumber: number): void {
    this.clearTimer(room);
    room.roundTimeout = setTimeout(() => {
      void this.finalizeWriting(room.code, roundNumber);
    }, room.settings.writingDurationSec * 1000);
  }

  private scheduleVotingTimeout(room: InternalRoom, roundNumber: number): void {
    this.clearTimer(room);
    room.roundTimeout = setTimeout(() => {
      this.finalizeVoting(room.code, roundNumber);
    }, room.settings.votingDurationSec * 1000);
  }

  private async prepareNewRound(room: InternalRoom): Promise<void> {
    room.currentRoundNumber += 1;
    const roundNumber = room.currentRoundNumber;
    const generated = await generateRoundWord(roundNumber, [...room.usedWords]);
    room.usedWords.add(generated.word.toLocaleLowerCase("fr-FR"));
    const phaseStartedAt = now();

    const round: InternalRoundState = {
      roundNumber,
      word: generated.word,
      correctDefinition: generated.correctDefinition,
      correctOptionId: `correct-${roundNumber}`,
      definitionsByPlayerId: new Map<string, PlayerRoundDefinition>(),
      options: [],
      votesByPlayerId: new Map<string, string>(),
      roundScoreDeltaByPlayerId: new Map<string, number>(),
      phaseStartedAt,
      phaseEndsAt: phaseStartedAt + room.settings.writingDurationSec * 1000,
    };

    room.round = round;
    room.phase = "WRITING";
    room.isFinalizingWriting = false;
    room.isFinalizingVoting = false;
    this.touchRoom(room);
    this.broadcast(room.code);
    this.scheduleWritingTimeout(room, round.roundNumber);
  }

  async startGame(codeInput: string, session: SessionPayload): Promise<RoomState> {
    const room = this.getRoomOrThrow(codeInput);
    this.validateSession(codeInput, session);
    this.assertHost(room, session.playerId);

    if (room.phase !== "LOBBY") {
      throw new Error("La partie est déjà en cours.");
    }

    if (room.players.size < room.settings.minPlayers) {
      throw new Error(`Il faut au moins ${room.settings.minPlayers} joueurs.`);
    }

    for (const player of room.players.values()) {
      player.score = 0;
    }

    room.currentRoundNumber = 0;
    room.round = null;
    room.usedWords.clear();
    await this.prepareNewRound(room);

    return this.getSnapshot(room.code, session.playerId);
  }

  async submitDefinition(
    codeInput: string,
    session: SessionPayload,
    rawDefinitionInput: string,
  ): Promise<RoomState> {
    const room = this.getRoomOrThrow(codeInput);
    this.validateSession(codeInput, session);

    if (room.phase !== "WRITING" || !room.round) {
      throw new Error("Ce n'est pas la phase d'écriture.");
    }

    const rawDefinition = rawDefinitionInput.trim().slice(0, 280);
    if (!rawDefinition) {
      throw new Error("La définition ne peut pas être vide.");
    }

    const existing = room.round.definitionsByPlayerId.get(session.playerId);
    room.round.definitionsByPlayerId.set(session.playerId, {
      rawDefinition,
      displayDefinition: existing?.displayDefinition ?? rawDefinition,
      isAutoGenerated: false,
    });

    this.touchRoom(room);
    this.broadcast(room.code);

    const allSubmitted = [...room.players.keys()].every((playerId) =>
      Boolean(room.round?.definitionsByPlayerId.get(playerId)?.rawDefinition?.trim()),
    );

    if (allSubmitted) {
      await this.finalizeWriting(room.code, room.round.roundNumber);
    }

    return this.getSnapshot(room.code, session.playerId);
  }

  private async finalizeWriting(codeInput: string, expectedRound: number): Promise<void> {
    const code = normalizeRoomCode(codeInput);
    const room = this.rooms.get(code);
    if (!room) {
      return;
    }
    if (!room.round || room.phase !== "WRITING") {
      return;
    }

    if (room.round.roundNumber !== expectedRound || room.isFinalizingWriting) {
      return;
    }

    room.isFinalizingWriting = true;
    this.clearTimer(room);

    try {
      const round = room.round;
      const inputs = [...room.players.values()].map((player) => ({
        playerId: player.id,
        name: player.name,
        rawDefinition: round.definitionsByPlayerId.get(player.id)?.rawDefinition,
      }));

      const normalized = await normalizeAndFillDefinitions(
        round.word,
        round.correctDefinition,
        inputs,
      );

      if (!room.round || room.phase !== "WRITING" || room.round.roundNumber !== expectedRound) {
        return;
      }

      const definitions = new Map<string, PlayerRoundDefinition>();
      for (const item of normalized) {
        const rawDefinition = round.definitionsByPlayerId.get(item.playerId)?.rawDefinition;
        definitions.set(item.playerId, {
          rawDefinition,
          displayDefinition: item.correctedText,
          isAutoGenerated: item.isAutoGenerated,
        });
      }

      room.round.definitionsByPlayerId = definitions;

      const options: InternalDefinitionOption[] = [...room.players.values()].map((player) => ({
        id: `player-${room.round?.roundNumber}-${player.id}`,
        text:
          room.round?.definitionsByPlayerId.get(player.id)?.displayDefinition ||
          `Définition indisponible pour ${player.name}.`,
        source: "player",
        ownerPlayerId: player.id,
      }));

      options.push({
        id: room.round.correctOptionId,
        text: room.round.correctDefinition,
        source: "correct",
        ownerPlayerId: null,
      });

      room.round.options = shuffle(options);
      room.phase = "VOTING";
      room.round.phaseStartedAt = now();
      room.round.phaseEndsAt = now() + room.settings.votingDurationSec * 1000;
      this.touchRoom(room);
      this.broadcast(room.code);
      this.scheduleVotingTimeout(room, room.round.roundNumber);
    } finally {
      room.isFinalizingWriting = false;
    }
  }

  vote(
    codeInput: string,
    session: SessionPayload,
    optionId: string,
  ): RoomState {
    const room = this.getRoomOrThrow(codeInput);
    this.validateSession(codeInput, session);

    if (room.phase !== "VOTING" || !room.round) {
      throw new Error("Ce n'est pas la phase de vote.");
    }

    const optionExists = room.round.options.some((option) => option.id === optionId);
    if (!optionExists) {
      throw new Error("Option de vote invalide.");
    }

    room.round.votesByPlayerId.set(session.playerId, optionId);
    this.touchRoom(room);
    this.broadcast(room.code);

    if (room.round.votesByPlayerId.size >= room.players.size) {
      this.finalizeVoting(room.code, room.round.roundNumber);
    }

    return this.getSnapshot(room.code, session.playerId);
  }

  private finalizeVoting(codeInput: string, expectedRound: number): void {
    const code = normalizeRoomCode(codeInput);
    const room = this.rooms.get(code);
    if (!room) {
      return;
    }
    if (!room.round || room.phase !== "VOTING") {
      return;
    }

    if (room.round.roundNumber !== expectedRound || room.isFinalizingVoting) {
      return;
    }

    room.isFinalizingVoting = true;
    this.clearTimer(room);

    try {
      const round = room.round;
      const optionById = new Map(round.options.map((option) => [option.id, option]));
      const scoreDeltas = new Map<string, number>();

      for (const player of room.players.values()) {
        scoreDeltas.set(player.id, 0);
      }

      for (const [voterPlayerId, votedOptionId] of round.votesByPlayerId.entries()) {
        const votedOption = optionById.get(votedOptionId);
        if (!votedOption) {
          continue;
        }

        if (votedOption.source === "correct") {
          const voter = room.players.get(voterPlayerId);
          if (voter) {
            voter.score += 2;
            scoreDeltas.set(voter.id, (scoreDeltas.get(voter.id) ?? 0) + 2);
          }
          continue;
        }

        if (votedOption.source === "player" && votedOption.ownerPlayerId) {
          const owner = room.players.get(votedOption.ownerPlayerId);
          if (owner) {
            owner.score += 1;
            scoreDeltas.set(owner.id, (scoreDeltas.get(owner.id) ?? 0) + 1);
          }
        }
      }

      round.roundScoreDeltaByPlayerId = scoreDeltas;

      const isFinalRound = round.roundNumber >= room.settings.totalRounds;
      const notEnoughPlayers = room.players.size < room.settings.minPlayers;
      room.phase = isFinalRound || notEnoughPlayers ? "FINAL_RESULTS" : "ROUND_RESULTS";
      round.phaseStartedAt = now();
      round.phaseEndsAt = null;

      this.touchRoom(room);
      this.broadcast(room.code);
    } finally {
      room.isFinalizingVoting = false;
    }
  }

  async nextRound(codeInput: string, session: SessionPayload): Promise<RoomState> {
    const room = this.getRoomOrThrow(codeInput);
    this.validateSession(codeInput, session);
    this.assertHost(room, session.playerId);

    if (room.phase !== "ROUND_RESULTS") {
      throw new Error("La manche suivante n'est pas disponible.");
    }

    if (room.players.size < room.settings.minPlayers) {
      room.phase = "FINAL_RESULTS";
      this.touchRoom(room);
      this.broadcast(room.code);
      return this.getSnapshot(room.code, session.playerId);
    }

    await this.prepareNewRound(room);
    return this.getSnapshot(room.code, session.playerId);
  }

  playAgain(codeInput: string, session: SessionPayload): RoomState {
    const room = this.getRoomOrThrow(codeInput);
    this.validateSession(codeInput, session);
    this.assertHost(room, session.playerId);

    if (room.phase !== "FINAL_RESULTS") {
      throw new Error("La partie n'est pas terminée.");
    }

    this.clearTimer(room);
    room.currentRoundNumber = 0;
    room.round = null;
    room.usedWords.clear();
    room.phase = "LOBBY";
    room.isFinalizingWriting = false;
    room.isFinalizingVoting = false;

    for (const player of room.players.values()) {
      player.score = 0;
    }

    this.touchRoom(room);
    this.broadcast(room.code);

    return this.getSnapshot(room.code, session.playerId);
  }
}

declare global {
  var __dicoRoomManager: RoomManager | undefined;
}

export const roomManager =
  globalThis.__dicoRoomManager ?? (globalThis.__dicoRoomManager = new RoomManager());
