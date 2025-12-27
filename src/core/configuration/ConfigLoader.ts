import { UserSettings } from "../game/UserSettings";
import { GameConfig } from "../Schemas";
import { Config, GameEnv, ServerConfig } from "./Config";
import { DefaultConfig } from "./DefaultConfig";
import { DevConfig, DevServerConfig } from "./DevConfig";
import { preprodConfig } from "./PreprodConfig";
import { prodConfig } from "./ProdConfig";
import { renderConfig } from "./RenderConfig";

export let cachedSC: ServerConfig | null = null;

export async function getConfig(
  gameConfig: GameConfig,
  userSettings: UserSettings | null,
  isReplay: boolean = false,
): Promise<Config> {
  const sc = await getServerConfigFromClient();
  switch (sc.env()) {
    case GameEnv.Dev:
      return new DevConfig(sc, gameConfig, userSettings, isReplay);
    case GameEnv.Preprod:
    case GameEnv.Prod:
      console.log("using prod config");
      return new DefaultConfig(sc, gameConfig, userSettings, isReplay);
    default:
      throw Error(`unsupported server configuration: ${process.env.GAME_ENV}`);
  }
}
export async function getServerConfigFromClient(): Promise<ServerConfig> {
  if (cachedSC) {
    return cachedSC;
  }
  const response = await fetch("/api/env");

  if (!response.ok) {
    throw new Error(
      `Failed to fetch server config: ${response.status} ${response.statusText}`,
    );
  }
  const config = await response.json();
  // Log the retrieved configuration
  console.log("Server config loaded:", config);

  cachedSC = getServerConfig(config.game_env);
  return cachedSC;
}
export function getServerConfigFromServer(): ServerConfig {
  // Render.com automatically sets RENDER_EXTERNAL_HOSTNAME
  // Use this as fallback detection if GAME_ENV isn't set
  const isRender = process.env.RENDER_EXTERNAL_HOSTNAME !== undefined;
  const gameEnv = process.env.GAME_ENV ?? (isRender ? "render" : "dev");
  return getServerConfig(gameEnv);
}
export function getServerConfig(gameEnv: string) {
  switch (gameEnv) {
    case "dev":
      console.log("using dev server config");
      return new DevServerConfig();
    case "staging":
      console.log("using preprod server config");
      return preprodConfig;
    case "prod":
      console.log("using prod server config");
      return prodConfig;
    case "render":
      console.log("using render server config");
      return renderConfig;
    default:
      throw Error(`unsupported server configuration: ${gameEnv}`);
  }
}
