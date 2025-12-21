import { Game, PlayerInfo, PlayerType } from "../game/Game";
import { TileRef } from "../game/GameMap";
import { PseudoRandom } from "../PseudoRandom";
import { GameID } from "../Schemas";
import { simpleHash } from "../Util";
import { SpawnExecution } from "./SpawnExecution";
import { BOT_NAMES, SPECIAL_BOT_NAMES } from "./utils/BotNames";

export class BotSpawner {
  private random: PseudoRandom;
  private bots: SpawnExecution[] = [];
  private shuffledNames: string[];
  private nameIndex = 0;

  constructor(
    private gs: Game,
    gameID: GameID,
  ) {
    this.random = new PseudoRandom(simpleHash(gameID));
    // Shuffle the bot names array for this game
    this.shuffledNames = this.random.shuffleArray([...BOT_NAMES]);
  }

  spawnBots(numBots: number): SpawnExecution[] {
    let tries = 0;
    while (this.bots.length < numBots) {
      if (tries > 10000) {
        console.log("too many retries while spawning bots, giving up");
        return this.bots;
      }
      const candidate = this.nextCandidateName();
      const spawn = this.spawnBot(candidate.name);
      if (spawn !== null) {
        // Only advance the name index after successful spawn
        // and only if we used a regular name (not special)
        if (candidate.source === "list") {
          this.nameIndex++;
        }
        this.bots.push(spawn);
      } else {
        tries++;
      }
    }
    return this.bots;
  }

  spawnBot(botName: string): SpawnExecution | null {
    const tile = this.randTile();
    if (!this.gs.isLand(tile)) {
      return null;
    }
    for (const spawn of this.bots) {
      if (this.gs.manhattanDist(spawn.tile, tile) < 30) {
        return null;
      }
    }
    return new SpawnExecution(
      new PlayerInfo(botName, PlayerType.Bot, null, this.random.nextID()),
      tile,
    );
  }

  private nextCandidateName(): { name: string; source: "list" | "special" } {
    // ~3% chance for a special name
    if (this.random.next() < 0.03) {
      const specialIndex = this.random.nextInt(0, SPECIAL_BOT_NAMES.length);
      return { name: SPECIAL_BOT_NAMES[specialIndex], source: "special" };
    }

    // Get next name from shuffled list (don't increment here - do it after successful spawn)
    const name = this.shuffledNames[this.nameIndex % this.shuffledNames.length];
    return { name, source: "list" };
  }

  private randTile(): TileRef {
    return this.gs.ref(
      this.random.nextInt(0, this.gs.width()),
      this.random.nextInt(0, this.gs.height()),
    );
  }
}
