import { PseudoRandom } from "../PseudoRandom";
import { ManualTeamAssignments } from "../Schemas";
import { simpleHash } from "../Util";
import { PlayerInfo, PlayerType, Team } from "./Game";

export function assignTeams(
  players: PlayerInfo[],
  teams: Team[],
  maxTeamSize: number = getMaxTeamSize(players.length, teams.length),
  manualAssignments?: ManualTeamAssignments,
): Map<PlayerInfo, Team | "kicked"> {
  const result = new Map<PlayerInfo, Team | "kicked">();
  const teamPlayerCount = new Map<Team, number>();

  // Initialize team counts
  for (const team of teams) {
    teamPlayerCount.set(team, 0);
  }

  // First, apply manual assignments
  const manuallyAssignedPlayers = new Set<PlayerInfo>();
  if (manualAssignments) {
    for (const player of players) {
      if (player.clientID === null) continue; // Skip bots (no clientID)
      const assignedTeam = manualAssignments[player.clientID];
      if (assignedTeam && teams.includes(assignedTeam)) {
        const currentCount = teamPlayerCount.get(assignedTeam) ?? 0;
        if (currentCount < maxTeamSize) {
          result.set(player, assignedTeam);
          teamPlayerCount.set(assignedTeam, currentCount + 1);
          manuallyAssignedPlayers.add(player);
        }
        // If team is full, player will be assigned automatically below
      }
    }
  }

  // Filter out manually assigned players for auto-assignment
  const remainingPlayers = players.filter((p) => !manuallyAssignedPlayers.has(p));

  // Group remaining players by clan
  const clanGroups = new Map<string, PlayerInfo[]>();
  const noClanPlayers: PlayerInfo[] = [];

  // Sort players into clan groups or no-clan list
  for (const player of remainingPlayers) {
    if (player.clan) {
      if (!clanGroups.has(player.clan)) {
        clanGroups.set(player.clan, []);
      }
      clanGroups.get(player.clan)!.push(player);
    } else {
      noClanPlayers.push(player);
    }
  }

  // Sort clans by size (largest first)
  const sortedClans = Array.from(clanGroups.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  );

  // Then, assign clan players
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const [_, clanPlayers] of sortedClans) {
    // Try to keep the clan together on the team with fewer players
    let team: Team | null = null;
    let teamSize = Infinity;
    for (const t of teams) {
      const p = teamPlayerCount.get(t) ?? 0;
      if (p < teamSize) {
        teamSize = p;
        team = t;
      }
    }

    if (team === null) continue;

    for (const player of clanPlayers) {
      const currentSize = teamPlayerCount.get(team) ?? 0;
      if (currentSize < maxTeamSize) {
        result.set(player, team);
        teamPlayerCount.set(team, currentSize + 1);
      } else {
        result.set(player, "kicked");
      }
    }
  }

  // Then, assign non-clan players to balance teams
  let nationPlayers = noClanPlayers.filter(
    (player) => player.playerType === PlayerType.Nation,
  );
  if (nationPlayers.length > 0) {
    // Shuffle only nations to randomize their team assignment
    const random = new PseudoRandom(simpleHash(nationPlayers[0].id));
    nationPlayers = random.shuffleArray(nationPlayers);
  }
  const otherPlayers = noClanPlayers.filter(
    (player) => player.playerType !== PlayerType.Nation,
  );

  for (const player of otherPlayers.concat(nationPlayers)) {
    let team: Team | null = null;
    let teamSize = Infinity;
    for (const t of teams) {
      const p = teamPlayerCount.get(t) ?? 0;
      if (p < teamSize) {
        teamSize = p;
        team = t;
      }
    }
    if (team === null) continue;
    const currentSize = teamPlayerCount.get(team) ?? 0;
    if (currentSize < maxTeamSize) {
      result.set(player, team);
      teamPlayerCount.set(team, currentSize + 1);
    } else {
      result.set(player, "kicked");
    }
  }

  return result;
}

export function assignTeamsLobbyPreview(
  players: PlayerInfo[],
  teams: Team[],
  nationCount: number,
  manualAssignments?: ManualTeamAssignments,
): Map<PlayerInfo, Team | "kicked"> {
  const maxTeamSize = getMaxTeamSize(
    players.length + nationCount,
    teams.length,
  );
  return assignTeams(players, teams, maxTeamSize, manualAssignments);
}

export function getMaxTeamSize(numPlayers: number, numTeams: number): number {
  return Math.ceil(numPlayers / numTeams);
}
