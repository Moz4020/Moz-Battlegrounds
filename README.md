# Moz Battlegrounds

A real-time strategy game focused on territorial control and alliance building. Play with friends, expand your territory, and dominate the map!

This is a fork of [OpenFront.IO](https://github.com/openfrontio/OpenFrontIO).

## Play Now

**[https://moz-battlegrounds.onrender.com/](https://moz-battlegrounds.onrender.com/)**

## Features

- **Real-time Strategy Gameplay**: Expand your territory and engage in strategic battles
- **Alliance System**: Form alliances with other players for mutual defense
- **Multiple Maps**: Play across various geographical regions including Europe, Asia, Africa, and more
- **Resource Management**: Balance your expansion with defensive capabilities
- **Cross-platform**: Play in any modern web browser
- **Custom Game Options**: Free nukes and permanent allies

## Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- npm (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd moz-battlegrounds

# Install dependencies
npm run inst
```

### Running Locally

```bash
# Run in development mode
npm run dev
```

This starts both the client and server. Open http://localhost:9000 in your browser.

## Project Structure

- `/src/client` - Frontend game client
- `/src/core` - Shared game logic
- `/src/server` - Backend game server
- `/resources` - Static assets (images, maps, translations)

## Scripts

| Script               | Description             |
| -------------------- | ----------------------- |
| `npm run dev`        | Run in development mode |
| `npm run build-prod` | Build for production    |
| `npm test`           | Run tests               |
| `npm run lint`       | Check code style        |

## License

This project is based on OpenFront.IO which is licensed under the **GNU Affero General Public License v3.0**.

See [LICENSE](LICENSE) for details.

## Credits

- Original game: [OpenFront.IO](https://github.com/openfrontio/OpenFrontIO)
- Fork maintained by Moz
