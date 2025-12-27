import { GameID, GameRecord, PartialGameRecord } from "../core/Schemas";

// Archive functionality disabled - no cloud storage configured

export async function archive(_gameRecord: GameRecord): Promise<void> {
  // No-op: Archive storage has been disabled
  return;
}

export async function readGameRecord(
  _gameId: GameID,
): Promise<GameRecord | null> {
  // No-op: Archive storage has been disabled
  return null;
}

export function finalizeGameRecord(
  clientRecord: PartialGameRecord,
): GameRecord {
  return {
    ...clientRecord,
    gitCommit: "",
    subdomain: "",
    domain: "",
  };
}
