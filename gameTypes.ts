export type Choice = "C" | "D" | null;

export interface Player {
  id: string;
  name: string;
  score: number;
  isAdmin: boolean;
  connected: boolean;
}

export interface Matchup {
  player1Id: string;
  player2Id: string;
  player1Choice: Choice;
  player2Choice: Choice;
  player1Points: number;
  player2Points: number;
  revealed: boolean;
}

export type GamePhase = "lobby" | "choosing" | "waiting_reveal" | "round_results" | "final_results";

export interface RoomState {
  roomCode: string;
  adminId: string;
  totalRounds: number;
  roundTimer: number;
  adminPlays: boolean;
  currentRound: number;
  phase: GamePhase;
  players: Player[];
  matchups: Matchup[];
  roundHistory: Matchup[][];
}

export interface ClientRoomState {
  roomCode: string;
  totalRounds: number;
  roundTimer: number;
  adminPlays: boolean;
  currentRound: number;
  phase: GamePhase;
  players: Player[];
  matchups: ClientMatchup[];
  roundHistory: ClientMatchup[][];
  timerEnd: number | null;
}

export interface ClientMatchup {
  player1Id: string;
  player2Id: string;
  player1Choice: Choice;
  player2Choice: Choice;
  player1Points: number;
  player2Points: number;
  revealed: boolean;
}

export const PAYOFF: Record<string, [number, number]> = {
  "C_C": [3, 3],
  "C_D": [0, 5],
  "D_C": [5, 0],
  "D_D": [1, 1],
};

export interface ServerToClientEvents {
  roomState: (state: ClientRoomState) => void;
  joined: (data: { playerId: string; roomCode: string }) => void;
  error: (message: string) => void;
  timerTick: (secondsLeft: number) => void;
  kicked: () => void;
}

export interface ClientToServerEvents {
  createRoom: (data: { playerName: string; totalRounds: number; roundTimer: number; adminPlays: boolean }) => void;
  joinRoom: (data: { roomCode: string; playerName: string }) => void;
  startGame: () => void;
  makeChoice: (choice: "C" | "D") => void;
  revealResults: () => void;
  nextRound: () => void;
  resetGame: () => void;
}
