# Deploy the original multiplayer game

This project keeps the original Replit React design and Socket.io multiplayer gameplay.

- GitHub Pages hosts the visible frontend.
- Render hosts the multiplayer server.

## 1. Replace the files in GitHub

Upload this project's contents to the root of:

`https://github.com/ppinkky/Prisoners-Dilemma`

Do not upload the outer ZIP or an extra containing folder. GitHub should show `package.json`, `client`, `server`, and `.github` at the repository root.

## 2. Deploy the multiplayer server on Render

1. Sign in to Render with GitHub.
2. Select **New > Blueprint** and choose the `Prisoners-Dilemma` repository. Render will read `render.yaml`.
3. Create the service.
4. When deployment finishes, copy its URL, such as:
   `https://prisoners-dilemma-server.onrender.com`
5. Open that URL followed by `/health`. It should return `{"status":"ok"}`.

## 3. Give GitHub Pages the Render URL

In the GitHub repository:

1. Open **Settings > Secrets and variables > Actions**.
2. Select the **Variables** tab.
3. Click **New repository variable**.
4. Name it exactly `VITE_SOCKET_URL`.
5. Set its value to the Render URL with no trailing slash.

Example value:

`https://prisoners-dilemma-server.onrender.com`

## 4. Enable GitHub Pages

1. Open **Settings > Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open the **Actions** tab and run **Deploy frontend to GitHub Pages**, or push a new commit to `main`.
4. Wait for the workflow's green check.

The public game URL will be:

`https://ppinkky.github.io/Prisoners-Dilemma/`

## Test multiplayer

Open the Pages link in a normal browser window and an incognito window. Create a room in one and join with the room code in the other.

## Important

Render's free service can sleep when inactive, so the first connection may take longer. Active rooms are stored in server memory and disappear whenever the Render service restarts or redeploys.
