import { JWK } from "jose";
import { GameEnv } from "./Config";
import { DefaultServerConfig } from "./DefaultConfig";

/**
 * Render.com deployment configuration
 * Uses dev mode auth (test tokens) and single worker for free tier
 */
export class RenderServerConfig extends DefaultServerConfig {
  turnstileSiteKey(): string {
    // Test key - Turnstile is bypassed in dev mode anyway
    return "1x00000000000000000000AA";
  }

  turnstileSecretKey(): string {
    // Test key - Turnstile is bypassed in dev mode anyway
    return "1x0000000000000000000000000000000AA";
  }

  adminToken(): string {
    return process.env.ADMIN_TOKEN ?? "moz-battlegrounds-admin-token";
  }

  apiKey(): string {
    return process.env.API_KEY ?? "moz-battlegrounds-api-key";
  }

  // Use Dev environment to bypass external auth requirements
  env(): GameEnv {
    return GameEnv.Dev;
  }

  // Faster game creation for private games with friends
  gameCreationRate(): number {
    return 10 * 1000;
  }

  // Single worker for Render free tier (sufficient for 5 players)
  numWorkers(): number {
    return 1;
  }

  jwtAudience(): string {
    return "localhost";
  }

  // Skip network fetch for JWK - auth is bypassed in dev mode anyway
  // This speeds up cold starts significantly
  async jwkPublicKey(): Promise<JWK> {
    // Return a dummy Ed25519 public key - not used since auth is bypassed
    return {
      kty: "OKP",
      crv: "Ed25519",
      x: "dummy-key-not-used-in-dev-mode",
    };
  }

  gitCommit(): string {
    return process.env.GIT_COMMIT ?? "render";
  }

  domain(): string {
    return process.env.RENDER_EXTERNAL_HOSTNAME ?? "localhost";
  }

  subdomain(): string {
    return "";
  }

  // Disable matchmaking for private friends-only server
  enableMatchmaking(): boolean {
    return false;
  }
}

export const renderConfig = new RenderServerConfig();
