import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ClientRoomState,
  ClientMatchup,
  ServerToClientEvents,
  ClientToServerEvents,
  Player,
} from "@shared/gameTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import {
  Users,
  Trophy,
  Swords,
  Clock,
  Crown,
  Handshake,
  ArrowRight,
  RotateCcw,
  Play,
  Eye,
  CheckCircle,
  Wifi,
  WifiOff,
  Copy,
  HelpCircle,
} from "lucide-react";

type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

function App() {
  const [socket, setSocket] = useState<SocketType | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<ClientRoomState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<SocketType | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL?.trim();
    const s: SocketType = io(socketUrl || undefined, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));

    s.on("roomState", (state) => {
      setRoomState(state);
      setErrorMsg(null);
      if (state.phase !== "choosing") {
        setTimerSeconds(null);
      }
    });

    s.on("error", (msg) => {
      setErrorMsg(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    });

    s.on("timerTick", (seconds) => {
      setTimerSeconds(seconds);
    });

    s.on("joined", ({ playerId: pid }) => {
      setPlayerId(pid);
    });

    s.on("kicked", () => {
      setRoomState(null);
      setPlayerId(null);
    });

    setSocket(s);
    socketRef.current = s;

    return () => {
      s.disconnect();
    };
  }, []);

  const isAdmin = roomState?.players.find((p) => p.id === playerId)?.isAdmin ?? false;

  if (!roomState) {
    return (
      <>
        <HomeScreen
          socket={socket}
          connected={connected}
          errorMsg={errorMsg}
        />
        <Toaster />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b px-4 py-3 flex items-center justify-between gap-2 flex-wrap sticky top-0 z-50 bg-background">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Prisoner's Dilemma</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">
              Room: {roomState.roomCode}
            </Badge>
            <Badge variant={connected ? "default" : "destructive"} className="text-xs">
              {connected ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
              {connected ? "Live" : "Offline"}
            </Badge>
          </div>
        </header>

        <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
          {roomState.phase === "lobby" && (
            <LobbyScreen
              roomState={roomState}
              isAdmin={isAdmin}
              socket={socket}
              playerId={playerId}
            />
          )}
          {roomState.phase === "choosing" && (
            <ChoosingScreen
              roomState={roomState}
              playerId={playerId!}
              socket={socket}
              timerSeconds={timerSeconds}
              isAdmin={isAdmin}
            />
          )}
          {roomState.phase === "waiting_reveal" && (
            <WaitingRevealScreen
              roomState={roomState}
              isAdmin={isAdmin}
              playerId={playerId!}
              socket={socket}
            />
          )}
          {(roomState.phase === "round_results" || roomState.phase === "final_results") && (
            <ResultsScreen
              roomState={roomState}
              isAdmin={isAdmin}
              playerId={playerId!}
              socket={socket}
            />
          )}
        </main>

        <footer className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
          <p>Made irresponsibly By Pinky</p>
          <p>Play at your own risk</p>
        </footer>
      </div>
      <Toaster />
    </>
  );
}

function HomeScreen({
  socket,
  connected,
  errorMsg,
}: {
  socket: SocketType | null;
  connected: boolean;
  errorMsg: string | null;
}) {
  const [mode, setMode] = useState<"home" | "create" | "join">("home");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [totalRounds, setTotalRounds] = useState(5);
  const [roundTimer, setRoundTimer] = useState(30);
  const [adminPlays, setAdminPlays] = useState(false);

  const handleCreate = () => {
    if (!socket || !playerName.trim()) return;
    socket.emit("createRoom", {
      playerName: playerName.trim(),
      totalRounds,
      roundTimer,
      adminPlays,
    });
  };

  const handleJoin = () => {
    if (!socket || !playerName.trim() || !roomCode.trim()) return;
    socket.emit("joinRoom", {
      roomCode: roomCode.trim().toUpperCase(),
      playerName: playerName.trim(),
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-md bg-primary/10 mb-4">
            <Swords className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Prisoner's Dilemma</h1>
          <p className="text-muted-foreground text-sm">Trust your friends.... or not</p>
        </div>

        {mode === "home" && (
          <Card>
            <CardContent className="p-6 space-y-3">
              <Button
                className="w-full"
                onClick={() => setMode("create")}
                disabled={!connected}
                data-testid="button-create-room"
              >
                <Crown className="w-4 h-4 mr-2" />
                Create Room
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setMode("join")}
                disabled={!connected}
                data-testid="button-join-room"
              >
                <Users className="w-4 h-4 mr-2" />
                Join Room
              </Button>
              {!connected && (
                <p className="text-xs text-muted-foreground text-center">Connecting to server...</p>
              )}
            </CardContent>
          </Card>
        )}

        {mode === "create" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Create a Room</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={20}
                  data-testid="input-player-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rounds">Total Rounds</Label>
                <Input
                  id="rounds"
                  type="number"
                  min={1}
                  max={20}
                  value={totalRounds}
                  onChange={(e) => setTotalRounds(Number(e.target.value))}
                  data-testid="input-total-rounds"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timer">Round Timer (seconds, 0 = no timer)</Label>
                <Input
                  id="timer"
                  type="number"
                  min={0}
                  max={120}
                  value={roundTimer}
                  onChange={(e) => setRoundTimer(Number(e.target.value))}
                  data-testid="input-round-timer"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="admin-plays">Admin plays in rounds</Label>
                <Switch
                  id="admin-plays"
                  checked={adminPlays}
                  onCheckedChange={setAdminPlays}
                  data-testid="switch-admin-plays"
                />
              </div>

              {errorMsg && (
                <p className="text-destructive text-sm" data-testid="text-error">{errorMsg}</p>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMode("home")} data-testid="button-back">
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreate}
                  disabled={!playerName.trim()}
                  data-testid="button-confirm-create"
                >
                  Create Room
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {mode === "join" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Join a Room</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="join-name">Your Name</Label>
                <Input
                  id="join-name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={20}
                  data-testid="input-join-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Room Code</Label>
                <Input
                  id="code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="e.g. AB12"
                  maxLength={4}
                  className="font-mono tracking-widest text-center text-lg"
                  data-testid="input-room-code"
                />
              </div>

              {errorMsg && (
                <p className="text-destructive text-sm" data-testid="text-error">{errorMsg}</p>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMode("home")} data-testid="button-back-join">
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleJoin}
                  disabled={!playerName.trim() || roomCode.length < 4}
                  data-testid="button-confirm-join"
                >
                  Join Room
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-4">
          <HowToPlayButton />
        </div>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          <p>Made irresponsibly By Pinky</p>
          <p>Play at your own risk</p>
        </div>
      </div>
    </div>
  );
}

function LobbyScreen({
  roomState,
  isAdmin,
  socket,
  playerId,
}: {
  roomState: ClientRoomState;
  isAdmin: boolean;
  socket: SocketType | null;
  playerId: string | null;
}) {
  const { toast } = useToast();
  const activePlayers = roomState.players.filter((p) => {
    if (!roomState.adminPlays && p.isAdmin) return false;
    return true;
  });

  const canStart = activePlayers.length >= 2;

  const copyCode = () => {
    navigator.clipboard.writeText(roomState.roomCode);
    toast({ title: "Copied!", description: "Room code copied to clipboard" });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">Share this code to invite players</p>
            <div className="flex items-center justify-center gap-2">
              <span
                className="text-4xl font-mono font-bold tracking-[0.3em] text-primary"
                data-testid="text-room-code"
              >
                {roomState.roomCode}
              </span>
              <Button size="icon" variant="ghost" onClick={copyCode} data-testid="button-copy-code">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center justify-center gap-4 flex-wrap text-xs text-muted-foreground">
              <span>{roomState.totalRounds} rounds</span>
              <span>{roomState.roundTimer > 0 ? `${roomState.roundTimer}s timer` : "No timer"}</span>
              <span>{roomState.adminPlays ? "Admin plays" : "Admin observes"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Players ({roomState.players.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {roomState.players.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50"
              data-testid={`player-item-${p.id}`}
            >
              <div className="flex items-center gap-2">
                {p.connected ? (
                  <Wifi className="w-3 h-3 text-green-500" />
                ) : (
                  <WifiOff className="w-3 h-3 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">{p.name}</span>
                {p.id === playerId && (
                  <Badge variant="outline" className="text-xs">You</Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {p.isAdmin && (
                  <Badge variant="secondary" className="text-xs">
                    <Crown className="w-3 h-3 mr-1" />
                    Admin
                  </Badge>
                )}
                {!roomState.adminPlays && p.isAdmin && (
                  <Badge variant="outline" className="text-xs">Observer</Badge>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {isAdmin && (
        <Button
          className="w-full"
          onClick={() => socket?.emit("startGame")}
          disabled={!canStart}
          data-testid="button-start-game"
        >
          <Play className="w-4 h-4 mr-2" />
          {canStart ? "Start Game" : `Need ${2 - activePlayers.length} more player(s)`}
        </Button>
      )}

      {!isAdmin && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Waiting for admin to start the game...</p>
          </CardContent>
        </Card>
      )}

      <div className="mt-2">
        <HowToPlayButton />
      </div>
    </div>
  );
}

function ChoosingScreen({
  roomState,
  playerId,
  socket,
  timerSeconds,
  isAdmin,
}: {
  roomState: ClientRoomState;
  playerId: string;
  socket: SocketType | null;
  timerSeconds: number | null;
  isAdmin: boolean;
}) {
  const myMatchup = roomState.matchups.find(
    (m) => m.player1Id === playerId || m.player2Id === playerId
  );
  const isPlayer1 = myMatchup?.player1Id === playerId;
  const myChoice = myMatchup ? (isPlayer1 ? myMatchup.player1Choice : myMatchup.player2Choice) : null;

  const opponentId = myMatchup ? (isPlayer1 ? myMatchup.player2Id : myMatchup.player1Id) : null;
  const opponent = roomState.players.find((p) => p.id === opponentId);

  const isObserver = !myMatchup;

  const votedCount = roomState.matchups.reduce((acc, m) => {
    let c = 0;
    if (m.player1Choice !== null) c++;
    if (m.player2Choice !== null) c++;
    return acc + c;
  }, 0);
  const totalVoters = roomState.matchups.length * 2;

  const timerPercent = timerSeconds !== null && roomState.roundTimer > 0
    ? (timerSeconds / roomState.roundTimer) * 100
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Badge variant="secondary" className="text-sm">
          Round {roomState.currentRound} / {roomState.totalRounds}
        </Badge>
        {timerSeconds !== null && (
          <Badge variant={timerSeconds <= 5 ? "destructive" : "outline"} className="text-sm font-mono">
            <Clock className="w-3 h-3 mr-1" />
            {timerSeconds}s
          </Badge>
        )}
      </div>

      {timerPercent !== null && (
        <div className="w-full bg-muted rounded-md h-2 overflow-hidden" data-testid="timer-bar">
          <div
            className={`h-full rounded-md transition-all duration-1000 ease-linear ${
              timerSeconds !== null && timerSeconds <= 5
                ? "bg-destructive"
                : timerSeconds !== null && timerSeconds <= 10
                ? "bg-yellow-500"
                : "bg-primary"
            }`}
            style={{ width: `${timerPercent}%` }}
          />
        </div>
      )}

      <PayoffMatrix />

      {isAdmin && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm">
              <span className="font-medium">{votedCount} / {totalVoters}</span>
              <span className="text-muted-foreground"> votes in</span>
            </div>
            <Button
              onClick={() => socket?.emit("revealResults")}
              disabled={votedCount === 0}
              data-testid="button-reveal-choosing"
            >
              <Eye className="w-4 h-4 mr-2" />
              Reveal Results
            </Button>
          </CardContent>
        </Card>
      )}

      {isObserver ? (
        <Card>
          <CardContent className="p-6 text-center space-y-2">
            <Eye className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">You are observing this round</p>
            <p className="text-xs text-muted-foreground">
              {votedCount} / {totalVoters} votes in
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-6 text-center space-y-1">
              <p className="text-sm text-muted-foreground">Your opponent</p>
              <p className="text-lg font-semibold" data-testid="text-opponent-name">{opponent?.name ?? "?"}</p>
            </CardContent>
          </Card>

          {myChoice ? (
            <Card>
              <CardContent className="p-6 text-center space-y-3">
                <CheckCircle className="w-8 h-8 mx-auto text-green-500" />
                <p className="font-medium">
                  You chose: <ChoiceBadge choice={myChoice} />
                </p>
                <p className="text-xs text-muted-foreground">Waiting for other players...</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2"
                onClick={() => socket?.emit("makeChoice", "C")}
                data-testid="button-cooperate"
              >
                <Handshake className="w-8 h-8 text-green-600" />
                <span className="font-semibold">Cooperate</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2"
                onClick={() => socket?.emit("makeChoice", "D")}
                data-testid="button-defect"
              >
                <Swords className="w-8 h-8 text-red-500" />
                <span className="font-semibold">Defect</span>
              </Button>
            </div>
          )}
        </>
      )}

      <Leaderboard players={roomState.players} playerId={playerId} />
    </div>
  );
}

function PayoffMatrix() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
          Payoff Matrix
        </CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm" data-testid="payoff-matrix">
          <thead>
            <tr>
              <th className="p-2 text-left text-muted-foreground font-medium">You \ Them</th>
              <th className="p-2 text-center font-medium">
                <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Handshake className="w-3 h-3" /> Cooperate
                </span>
              </th>
              <th className="p-2 text-center font-medium">
                <span className="inline-flex items-center gap-1 text-red-500 dark:text-red-400">
                  <Swords className="w-3 h-3" /> Defect
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="p-2 font-medium">
                <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Handshake className="w-3 h-3" /> Cooperate
                </span>
              </td>
              <td className="p-2 text-center">
                <span className="font-mono font-semibold">3</span>
                <span className="text-muted-foreground"> , </span>
                <span className="font-mono font-semibold">3</span>
              </td>
              <td className="p-2 text-center">
                <span className="font-mono font-semibold text-red-500">0</span>
                <span className="text-muted-foreground"> , </span>
                <span className="font-mono font-semibold text-green-600">5</span>
              </td>
            </tr>
            <tr className="border-t">
              <td className="p-2 font-medium">
                <span className="inline-flex items-center gap-1 text-red-500 dark:text-red-400">
                  <Swords className="w-3 h-3" /> Defect
                </span>
              </td>
              <td className="p-2 text-center">
                <span className="font-mono font-semibold text-green-600">5</span>
                <span className="text-muted-foreground"> , </span>
                <span className="font-mono font-semibold text-red-500">0</span>
              </td>
              <td className="p-2 text-center">
                <span className="font-mono font-semibold">1</span>
                <span className="text-muted-foreground"> , </span>
                <span className="font-mono font-semibold">1</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Values shown as: Your points , Their points
        </p>
      </CardContent>
    </Card>
  );
}

function HowToPlayButton() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full" data-testid="button-how-to-play">
          <HelpCircle className="w-4 h-4 mr-2" />
          How to Play
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-primary" />
            The Prisoner's Dilemma
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold mb-1">The Story</h3>
            <p className="text-muted-foreground">
              Two suspects are arrested and held in separate cells. Each must decide
              whether to cooperate with the other by staying silent, or defect by
              betraying them. The catch: neither knows what the other will choose.
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">
              First described by Merrill Flood and Melvin Dresher in 1950 at the RAND
              Corporation, the Prisoner's Dilemma became one of the most studied problems
              in game theory. It reveals how rational self-interest can lead to outcomes
              that are worse for everyone.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-1">How to Play</h3>
            <ol className="text-muted-foreground space-y-2 list-decimal list-inside">
              <li>The admin creates a room and shares the 4-letter code with other players.</li>
              <li>Once everyone joins, the admin starts the game.</li>
              <li>Each round, players are randomly paired and secretly choose to <span className="text-green-600 dark:text-green-400 font-medium">Cooperate</span> or <span className="text-red-500 dark:text-red-400 font-medium">Defect</span>.</li>
              <li>The admin reveals all results at once.</li>
              <li>Points are awarded based on both players' choices, and the leaderboard updates.</li>
              <li>After all rounds, the player with the most points wins!</li>
            </ol>
          </div>
          <div>
            <h3 className="font-semibold mb-1">Scoring</h3>
            <ul className="text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded-md">C + C</span>
                <span>Both get <span className="font-semibold text-foreground">3 points</span> (mutual trust)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded-md">D + D</span>
                <span>Both get <span className="font-semibold text-foreground">1 point</span> (mutual betrayal)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded-md">D + C</span>
                <span>Defector gets <span className="font-semibold text-foreground">5</span>, Cooperator gets <span className="font-semibold text-foreground">0</span></span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-1">The Dilemma</h3>
            <p className="text-muted-foreground">
              Defecting always seems like the safer individual choice, but if everyone
              defects, everyone loses. The best collective outcome comes from mutual
              cooperation, but it requires trust.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WaitingRevealScreen({
  roomState,
  isAdmin,
  playerId,
  socket,
}: {
  roomState: ClientRoomState;
  isAdmin: boolean;
  playerId: string;
  socket: SocketType | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Badge variant="secondary" className="text-sm">
          Round {roomState.currentRound} / {roomState.totalRounds}
        </Badge>
        <Badge variant="outline" className="text-sm">All votes in</Badge>
      </div>

      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <CheckCircle className="w-10 h-10 mx-auto text-green-500" />
          <p className="font-medium">All players have voted!</p>
          {isAdmin ? (
            <Button onClick={() => socket?.emit("revealResults")} data-testid="button-reveal">
              <Eye className="w-4 h-4 mr-2" />
              Reveal Results
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for admin to reveal results...</p>
          )}
        </CardContent>
      </Card>

      <Leaderboard players={roomState.players} playerId={playerId} />
    </div>
  );
}

function ResultsScreen({
  roomState,
  isAdmin,
  playerId,
  socket,
}: {
  roomState: ClientRoomState;
  isAdmin: boolean;
  playerId: string;
  socket: SocketType | null;
}) {
  const isFinal = roomState.phase === "final_results";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Badge variant={isFinal ? "default" : "secondary"} className="text-sm">
          {isFinal ? "Final Results" : `Round ${roomState.currentRound} / ${roomState.totalRounds}`}
        </Badge>
      </div>

      {isFinal && (
        <Card>
          <CardContent className="p-6 text-center">
            <Trophy className="w-10 h-10 mx-auto text-yellow-500 mb-2" />
            <p className="text-lg font-bold">Game Over!</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isFinal ? "Final Round Matchups" : "Round Matchups"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {roomState.matchups.map((m, i) => (
            <MatchupResult
              key={i}
              matchup={m}
              players={roomState.players}
              playerId={playerId}
            />
          ))}
        </CardContent>
      </Card>

      <Leaderboard players={roomState.players} playerId={playerId} />

      {isAdmin && (
        <div className="flex gap-2">
          {!isFinal && (
            <Button className="flex-1" onClick={() => socket?.emit("nextRound")} data-testid="button-next-round">
              <ArrowRight className="w-4 h-4 mr-2" />
              Next Round
            </Button>
          )}
          <Button
            variant={isFinal ? "default" : "outline"}
            className={isFinal ? "flex-1" : ""}
            onClick={() => socket?.emit("resetGame")}
            data-testid="button-reset"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Game
          </Button>
        </div>
      )}
    </div>
  );
}

function MatchupResult({
  matchup,
  players,
  playerId,
}: {
  matchup: ClientMatchup;
  players: Player[];
  playerId: string;
}) {
  const p1 = players.find((p) => p.id === matchup.player1Id);
  const p2 = players.find((p) => p.id === matchup.player2Id);

  return (
    <div className="p-3 rounded-md bg-muted/50 space-y-2" data-testid={`matchup-${matchup.player1Id}-${matchup.player2Id}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 text-right">
          <span className={`text-sm font-medium ${matchup.player1Id === playerId ? "text-primary" : ""}`}>
            {p1?.name ?? "?"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ChoiceBadge choice={matchup.player1Choice} />
          <span className="text-xs text-muted-foreground">vs</span>
          <ChoiceBadge choice={matchup.player2Choice} />
        </div>
        <div className="flex-1">
          <span className={`text-sm font-medium ${matchup.player2Id === playerId ? "text-primary" : ""}`}>
            {p2?.name ?? "?"}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex-1 text-right pr-4">+{matchup.player1Points} pts</span>
        <span className="flex-1 pl-4">+{matchup.player2Points} pts</span>
      </div>
    </div>
  );
}

function ChoiceBadge({ choice }: { choice: string | null }) {
  if (!choice) return <Badge variant="outline" className="text-xs">?</Badge>;
  if (choice === "C") {
    return (
      <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <Handshake className="w-3 h-3 mr-1" />C
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
      <Swords className="w-3 h-3 mr-1" />D
    </Badge>
  );
}

function Leaderboard({ players, playerId }: { players: Player[]; playerId: string }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center justify-between gap-2 p-2 rounded-md ${
                p.id === playerId ? "bg-primary/5" : ""
              }`}
              data-testid={`leaderboard-row-${p.id}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-5 text-right">
                  {i === 0 && p.score > 0 ? "1st" : `${i + 1}`}
                </span>
                <span className="text-sm font-medium">{p.name}</span>
                {p.id === playerId && (
                  <Badge variant="outline" className="text-xs">You</Badge>
                )}
                {p.isAdmin && <Crown className="w-3 h-3 text-muted-foreground" />}
              </div>
              <span className="text-sm font-mono font-semibold" data-testid={`score-${p.id}`}>
                {p.score}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default App;
