import type { Express } from "express";
import { type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import type {
  RoomState,
  ClientRoomState,
  ClientMatchup,
  Choice,
  Player,
  Matchup,
  ServerToClientEvents,
  ClientToServerEvents,
} from "@shared/gameTypes";
import { PAYOFF } from "@shared/gameTypes";

const rooms = new Map<string, RoomState>();
const socketToRoom = new Map<string, string>();
const socketToPlayer = new Map<string, string>();
const timers = new Map<string, NodeJS.Timeout>();

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function generatePlayerId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getActivePlayers(room: RoomState): Player[] {
  return room.players.filter((p) => {
    if (!room.adminPlays && p.isAdmin) return false;
    return true;
  });
}

function createMatchups(room: RoomState): Matchup[] {
  const active = shuffleArray(getActivePlayers(room));
  const matchups: Matchup[] = [];

  for (let i = 0; i + 1 < active.length; i += 2) {
    matchups.push({
      player1Id: active[i].id,
      player2Id: active[i + 1].id,
      player1Choice: null,
      player2Choice: null,
      player1Points: 0,
      player2Points: 0,
      revealed: false,
    });
  }

  return matchups;
}

function allChoicesMade(room: RoomState): boolean {
  return room.matchups.every(
    (m) => m.player1Choice !== null && m.player2Choice !== null
  );
}

function calculateMatchupPoints(matchup: Matchup): void {
  if (matchup.player1Choice && matchup.player2Choice) {
    const key = `${matchup.player1Choice}_${matchup.player2Choice}`;
    const [p1, p2] = PAYOFF[key] || [0, 0];
    matchup.player1Points = p1;
    matchup.player2Points = p2;
  }
}

function toClientState(room: RoomState, playerId: string): ClientRoomState {
  const isRevealed = room.phase === "round_results" || room.phase === "final_results";

  const clientMatchups: ClientMatchup[] = room.matchups.map((m) => {
    const isInMatchup = m.player1Id === playerId || m.player2Id === playerId;
    const showChoices = isRevealed || m.revealed;

    return {
      player1Id: m.player1Id,
      player2Id: m.player2Id,
      player1Choice: showChoices ? m.player1Choice : (isInMatchup && m.player1Id === playerId ? m.player1Choice : null),
      player2Choice: showChoices ? m.player2Choice : (isInMatchup && m.player2Id === playerId ? m.player2Choice : null),
      player1Points: showChoices ? m.player1Points : 0,
      player2Points: showChoices ? m.player2Points : 0,
      revealed: showChoices,
    };
  });

  const clientHistory: ClientMatchup[][] = room.roundHistory.map((round) =>
    round.map((m) => ({
      player1Id: m.player1Id,
      player2Id: m.player2Id,
      player1Choice: m.player1Choice,
      player2Choice: m.player2Choice,
      player1Points: m.player1Points,
      player2Points: m.player2Points,
      revealed: true,
    }))
  );

  return {
    roomCode: room.roomCode,
    totalRounds: room.totalRounds,
    roundTimer: room.roundTimer,
    adminPlays: room.adminPlays,
    currentRound: room.currentRound,
    phase: room.phase,
    players: room.players,
    matchups: clientMatchups,
    roundHistory: clientHistory,
    timerEnd: null,
  };
}

function broadcastState(io: SocketIOServer, room: RoomState): void {
  const sockets = Array.from(io.sockets.sockets.values());
  for (const socket of sockets) {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayer.get(socket.id);
    if (roomCode === room.roomCode && playerId) {
      const state = toClientState(room, playerId);
      socket.emit("roomState", state);
    }
  }
}

function clearTimer(roomCode: string): void {
  const t = timers.get(roomCode);
  if (t) {
    clearInterval(t);
    timers.delete(roomCode);
  }
}

function startRoundTimer(io: SocketIOServer, room: RoomState): void {
  if (room.roundTimer <= 0) return;

  clearTimer(room.roomCode);

  let secondsLeft = room.roundTimer;

  const interval = setInterval(() => {
    secondsLeft--;

    const sockets = Array.from(io.sockets.sockets.values());
    for (const socket of sockets) {
      if (socketToRoom.get(socket.id) === room.roomCode) {
        socket.emit("timerTick", secondsLeft);
      }
    }

    if (secondsLeft <= 0) {
      clearTimer(room.roomCode);
      room.phase = "waiting_reveal";
      room.matchups.forEach((m) => {
        if (m.player1Choice !== null && m.player2Choice !== null) {
          calculateMatchupPoints(m);
        }
      });
      broadcastState(io, room);
    }
  }, 1000);

  timers.set(room.roomCode, interval);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: "*" },
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    socket.on("createRoom", ({ playerName, totalRounds, roundTimer, adminPlays }) => {
      const roomCode = generateRoomCode();
      const playerId = generatePlayerId();

      const admin: Player = {
        id: playerId,
        name: playerName,
        score: 0,
        isAdmin: true,
        connected: true,
      };

      const room: RoomState = {
        roomCode,
        adminId: playerId,
        totalRounds: Math.max(1, Math.min(20, totalRounds)),
        roundTimer: Math.max(0, Math.min(120, roundTimer)),
        adminPlays,
        currentRound: 0,
        phase: "lobby",
        players: [admin],
        matchups: [],
        roundHistory: [],
      };

      rooms.set(roomCode, room);
      socketToRoom.set(socket.id, roomCode);
      socketToPlayer.set(socket.id, playerId);
      socket.join(roomCode);

      socket.emit("joined", { playerId, roomCode });
      broadcastState(io, room);
    });

    socket.on("joinRoom", ({ roomCode, playerName }) => {
      const code = roomCode.toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        socket.emit("error", "Room not found");
        return;
      }

      if (room.phase !== "lobby") {
        socket.emit("error", "Game already in progress");
        return;
      }

      if (room.players.some((p) => p.name === playerName)) {
        socket.emit("error", "Name already taken in this room");
        return;
      }

      const playerId = generatePlayerId();
      const player: Player = {
        id: playerId,
        name: playerName,
        score: 0,
        isAdmin: false,
        connected: true,
      };

      room.players.push(player);
      socketToRoom.set(socket.id, code);
      socketToPlayer.set(socket.id, playerId);
      socket.join(code);

      socket.emit("joined", { playerId, roomCode: code });
      broadcastState(io, room);
    });

    socket.on("startGame", () => {
      const roomCode = socketToRoom.get(socket.id);
      const playerId = socketToPlayer.get(socket.id);
      if (!roomCode || !playerId) return;

      const room = rooms.get(roomCode);
      if (!room) return;

      if (room.adminId !== playerId) {
        socket.emit("error", "Only the admin can start the game");
        return;
      }

      const activePlayers = getActivePlayers(room);
      if (activePlayers.length < 2) {
        socket.emit("error", "Need at least 2 active players to start");
        return;
      }

      room.currentRound = 1;
      room.phase = "choosing";
      room.matchups = createMatchups(room);
      room.roundHistory = [];

      broadcastState(io, room);
      startRoundTimer(io, room);
    });

    socket.on("makeChoice", (choice) => {
      const roomCode = socketToRoom.get(socket.id);
      const playerId = socketToPlayer.get(socket.id);
      if (!roomCode || !playerId) return;

      const room = rooms.get(roomCode);
      if (!room || room.phase !== "choosing") return;

      if (choice !== "C" && choice !== "D") return;

      for (const m of room.matchups) {
        if (m.player1Id === playerId) {
          m.player1Choice = choice;
          calculateMatchupPoints(m);
          break;
        }
        if (m.player2Id === playerId) {
          m.player2Choice = choice;
          calculateMatchupPoints(m);
          break;
        }
      }

      if (allChoicesMade(room)) {
        clearTimer(room.roomCode);
        room.phase = "waiting_reveal";
      }

      broadcastState(io, room);
    });

    socket.on("revealResults", () => {
      const roomCode = socketToRoom.get(socket.id);
      const playerId = socketToPlayer.get(socket.id);
      if (!roomCode || !playerId) return;

      const room = rooms.get(roomCode);
      if (!room || room.adminId !== playerId) return;

      if (room.phase !== "waiting_reveal" && room.phase !== "choosing") {
        socket.emit("error", "Cannot reveal results right now");
        return;
      }

      clearTimer(room.roomCode);

      room.matchups.forEach((m) => {
        if (m.player1Choice !== null && m.player2Choice !== null) {
          calculateMatchupPoints(m);
        }
        m.revealed = true;
        const p1 = room.players.find((p) => p.id === m.player1Id);
        const p2 = room.players.find((p) => p.id === m.player2Id);
        if (p1) p1.score += m.player1Points;
        if (p2) p2.score += m.player2Points;
      });

      room.roundHistory.push([...room.matchups]);

      if (room.currentRound >= room.totalRounds) {
        room.phase = "final_results";
      } else {
        room.phase = "round_results";
      }

      broadcastState(io, room);
    });

    socket.on("nextRound", () => {
      const roomCode = socketToRoom.get(socket.id);
      const playerId = socketToPlayer.get(socket.id);
      if (!roomCode || !playerId) return;

      const room = rooms.get(roomCode);
      if (!room || room.adminId !== playerId) return;
      if (room.phase !== "round_results") return;

      room.currentRound++;
      room.phase = "choosing";
      room.matchups = createMatchups(room);

      broadcastState(io, room);
      startRoundTimer(io, room);
    });

    socket.on("resetGame", () => {
      const roomCode = socketToRoom.get(socket.id);
      const playerId = socketToPlayer.get(socket.id);
      if (!roomCode || !playerId) return;

      const room = rooms.get(roomCode);
      if (!room || room.adminId !== playerId) return;

      clearTimer(roomCode);

      room.currentRound = 0;
      room.phase = "lobby";
      room.matchups = [];
      room.roundHistory = [];
      room.players.forEach((p) => {
        p.score = 0;
      });

      broadcastState(io, room);
    });

    socket.on("disconnect", () => {
      const roomCode = socketToRoom.get(socket.id);
      const playerId = socketToPlayer.get(socket.id);

      if (roomCode && playerId) {
        const room = rooms.get(roomCode);
        if (room) {
          const player = room.players.find((p) => p.id === playerId);
          if (player) {
            player.connected = false;
          }

          const allDisconnected = room.players.every((p) => !p.connected);
          if (allDisconnected) {
            clearTimer(roomCode);
            rooms.delete(roomCode);
          } else {
            broadcastState(io, room);
          }
        }
      }

      socketToRoom.delete(socket.id);
      socketToPlayer.delete(socket.id);
    });
  });

  return httpServer;
}
