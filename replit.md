# Prisoner's Dilemma - Multiplayer Game

## Overview
Real-time multiplayer Prisoner's Dilemma game using Socket.io for communication. In-memory room state (no database).

## Architecture
- **Server**: Express + Socket.io (`server/routes.ts` handles all game logic)
- **Client**: Vite + React + TypeScript (`client/src/App.tsx` is the main component)
- **Shared Types**: `shared/gameTypes.ts` - all game state types and payoff matrix
- **Communication**: Socket.io events only, no REST API polling

## Game Flow
1. Create/Join room with code
2. Lobby with player list
3. Admin starts game -> players paired randomly each round
4. Players choose Cooperate (C) or Defect (D)
5. Admin reveals results
6. Leaderboard updates
7. Next round or final results
8. Admin can reset

## Key Files
- `server/routes.ts` - Socket.io server, room management, game logic
- `client/src/App.tsx` - All React components for the game UI
- `shared/gameTypes.ts` - TypeScript types shared between client and server

## Running
- `npm run dev` starts both server and client on port 5000
