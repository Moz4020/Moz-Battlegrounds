# Moz Battlegrounds

A real-time strategy game focused on territorial control and alliance building. Play with friends, expand your territory, and dominate the map!

This is a fork of [OpenFront.IO](https://github.com/openfrontio/OpenFrontIO).

## Features

- **Real-time Strategy Gameplay**: Expand your territory and engage in strategic battles
- **Alliance System**: Form alliances with other players for mutual defense
- **Multiple Maps**: Play across various geographical regions including Europe, Asia, Africa, and more
- **Resource Management**: Balance your expansion with defensive capabilities
- **Cross-platform**: Play in any modern web browser

## Deploy to Render (Free Hosting)

### Quick Deploy

1. Push this repository to your GitHub account
2. Go to [render.com](https://render.com) and sign up (free)
3. Click **New** → **Blueprint**
4. Connect your GitHub repository
5. Render will auto-detect the `render.yaml` and deploy

Your game will be available at `https://moz-battlegrounds.onrender.com` (or similar)

### Environment Variables (Optional)

For game replay storage, set up Cloudflare R2:

| Variable | Description |
|----------|-------------|
| `CF_ACCOUNT_ID` | Your Cloudflare Account ID |
| `R2_ACCESS_KEY` | R2 API Token Access Key |
| `R2_SECRET_KEY` | R2 API Token Secret Key |
| `R2_BUCKET` | Name of your R2 bucket |

See [Cloudflare R2 Setup](#cloudflare-r2-setup-optional) below.

## Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- npm (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd moz-battlegrounds

# Install dependencies (use this instead of npm install)
npm run inst
```

### Running Locally

```bash
# Run in development mode
npm run dev
```

This starts both the client and server. Open http://localhost:9000 in your browser.

## Cloudflare R2 Setup (Optional)

If you want to save game replays, set up Cloudflare R2:

1. **Create Cloudflare Account**
   - Go to [cloudflare.com](https://cloudflare.com) and sign up (free)

2. **Enable R2**
   - In dashboard, go to **R2 Object Storage**
   - Click **Create bucket**
   - Name it `moz-battlegrounds-replays` (or any name)

3. **Create API Token**
   - Go to **R2** → **Manage R2 API Tokens**
   - Click **Create API token**
   - Select **Object Read & Write** permission
   - Copy the Access Key ID and Secret Access Key

4. **Get Account ID**
   - Your Account ID is in the URL when viewing R2: `dash.cloudflare.com/<ACCOUNT_ID>/r2`

5. **Add to Render**
   - In Render dashboard, go to your service → **Environment**
   - Add the environment variables listed above

## Project Structure

- `/src/client` - Frontend game client
- `/src/core` - Shared game logic
- `/src/server` - Backend game server
- `/resources` - Static assets (images, maps, etc.)

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run in development mode |
| `npm run build-prod` | Build for production |
| `npm run start:render` | Start server (used by Render) |
| `npm test` | Run tests |
| `npm run lint` | Check code style |

## License

This project is based on OpenFront.IO which is licensed under the **GNU Affero General Public License v3.0**.

See [LICENSE](LICENSE) for details.

## Credits

- Original game: [OpenFront.IO](https://github.com/openfrontio/OpenFrontIO)
- Fork maintained for private multiplayer with friends
