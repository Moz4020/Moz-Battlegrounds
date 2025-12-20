import { ColoredTeams, PlayerInfo, PlayerType } from "../src/core/game/Game";
import { assignTeams } from "../src/core/game/TeamAssignment";

const teams = [ColoredTeams.Red, ColoredTeams.Blue];

describe("assignTeams", () => {
  const createPlayer = (id: string, clan?: string): PlayerInfo => {
    const name = clan ? `[${clan}]Player ${id}` : `Player ${id}`;
    return new PlayerInfo(
      name,
      PlayerType.Human,
      null, // clientID (null for testing)
      id,
    );
  };

  it("should assign players to teams when no clans are present", () => {
    const players = [
      createPlayer("1"),
      createPlayer("2"),
      createPlayer("3"),
      createPlayer("4"),
    ];

    const result = assignTeams(players, teams);

    // Check that players are assigned alternately
    expect(result.get(players[0])).toEqual(ColoredTeams.Red);
    expect(result.get(players[1])).toEqual(ColoredTeams.Blue);
    expect(result.get(players[2])).toEqual(ColoredTeams.Red);
    expect(result.get(players[3])).toEqual(ColoredTeams.Blue);
  });

  it("should keep clan members together on the same team", () => {
    const players = [
      createPlayer("1", "CLANA"),
      createPlayer("2", "CLANA"),
      createPlayer("3", "CLANB"),
      createPlayer("4", "CLANB"),
    ];

    const result = assignTeams(players, teams);

    // Check that clan members are on the same team
    expect(result.get(players[0])).toEqual(ColoredTeams.Red);
    expect(result.get(players[1])).toEqual(ColoredTeams.Red);
    expect(result.get(players[2])).toEqual(ColoredTeams.Blue);
    expect(result.get(players[3])).toEqual(ColoredTeams.Blue);
  });

  it("should handle mixed clan and non-clan players", () => {
    const players = [
      createPlayer("1", "CLANA"),
      createPlayer("2", "CLANA"),
      createPlayer("3"),
      createPlayer("4"),
    ];

    const result = assignTeams(players, teams);

    // Check that clan members are together and non-clan players balance teams
    expect(result.get(players[0])).toEqual(ColoredTeams.Red);
    expect(result.get(players[1])).toEqual(ColoredTeams.Red);
    expect(result.get(players[2])).toEqual(ColoredTeams.Blue);
    expect(result.get(players[3])).toEqual(ColoredTeams.Blue);
  });

  it("should kick players when teams are full", () => {
    const players = [
      createPlayer("1", "CLANA"),
      createPlayer("2", "CLANA"),
      createPlayer("3", "CLANA"),
      createPlayer("4", "CLANA"),
      createPlayer("5", "CLANB"),
      createPlayer("6", "CLANB"),
    ];

    const result = assignTeams(players, teams);

    // Check that players are kicked when teams are full
    expect(result.get(players[0])).toEqual(ColoredTeams.Red);
    expect(result.get(players[1])).toEqual(ColoredTeams.Red);
    expect(result.get(players[2])).toEqual(ColoredTeams.Red);

    expect(result.get(players[3])).toEqual("kicked");

    expect(result.get(players[4])).toEqual(ColoredTeams.Blue);
    expect(result.get(players[5])).toEqual(ColoredTeams.Blue);
  });

  it("should handle empty player list", () => {
    const result = assignTeams([], teams);
    expect(result.size).toBe(0);
  });

  it("should handle single player", () => {
    const players = [createPlayer("1")];
    const result = assignTeams(players, teams);
    expect(result.get(players[0])).toEqual(ColoredTeams.Red);
  });

  it("should handle multiple clans with different sizes", () => {
    const players = [
      createPlayer("1", "CLANA"),
      createPlayer("2", "CLANA"),
      createPlayer("3", "CLANA"),
      createPlayer("4", "CLANB"),
      createPlayer("5", "CLANB"),
      createPlayer("6", "CLANC"),
    ];

    const result = assignTeams(players, teams);

    // Check that larger clans are assigned first
    expect(result.get(players[0])).toEqual(ColoredTeams.Red);
    expect(result.get(players[1])).toEqual(ColoredTeams.Red);
    expect(result.get(players[2])).toEqual(ColoredTeams.Red);
    expect(result.get(players[3])).toEqual(ColoredTeams.Blue);
    expect(result.get(players[4])).toEqual(ColoredTeams.Blue);
    expect(result.get(players[5])).toEqual(ColoredTeams.Blue);
  });

  it("should distribute players among a larger number of teams", () => {
    const players = [
      createPlayer("1", "CLANA"),
      createPlayer("2", "CLANA"),
      createPlayer("3", "CLANA"),
      createPlayer("4", "CLANB"),
      createPlayer("5", "CLANB"),
      createPlayer("6", "CLANC"),
      createPlayer("7"),
      createPlayer("8"),
      createPlayer("9"),
      createPlayer("10"),
      createPlayer("11"),
      createPlayer("12"),
      createPlayer("13"),
      createPlayer("14"),
    ];

    const result = assignTeams(players, [
      ColoredTeams.Red,
      ColoredTeams.Blue,
      ColoredTeams.Yellow,
      ColoredTeams.Green,
      ColoredTeams.Purple,
      ColoredTeams.Orange,
      ColoredTeams.Teal,
    ]);

    expect(result.get(players[0])).toEqual(ColoredTeams.Red);
    expect(result.get(players[1])).toEqual(ColoredTeams.Red);
    expect(result.get(players[2])).toEqual("kicked");
    expect(result.get(players[3])).toEqual(ColoredTeams.Blue);
    expect(result.get(players[4])).toEqual(ColoredTeams.Blue);
    expect(result.get(players[5])).toEqual(ColoredTeams.Yellow);
    expect(result.get(players[6])).toEqual(ColoredTeams.Green);
    expect(result.get(players[7])).toEqual(ColoredTeams.Purple);
    expect(result.get(players[8])).toEqual(ColoredTeams.Orange);
    expect(result.get(players[9])).toEqual(ColoredTeams.Teal);
    expect(result.get(players[10])).toEqual(ColoredTeams.Yellow);
    expect(result.get(players[11])).toEqual(ColoredTeams.Green);
    expect(result.get(players[12])).toEqual(ColoredTeams.Purple);
    expect(result.get(players[13])).toEqual(ColoredTeams.Orange);
  });

  describe("manual team assignments", () => {
    const createPlayerWithClientID = (
      id: string,
      clientID: string,
      clan?: string,
    ): PlayerInfo => {
      const name = clan ? `[${clan}]Player ${id}` : `Player ${id}`;
      return new PlayerInfo(name, PlayerType.Human, clientID, id);
    };

    it("should respect manual team assignments", () => {
      const players = [
        createPlayerWithClientID("1", "client1"),
        createPlayerWithClientID("2", "client2"),
        createPlayerWithClientID("3", "client3"),
        createPlayerWithClientID("4", "client4"),
      ];

      const manualAssignments = {
        client1: ColoredTeams.Blue,
        client2: ColoredTeams.Blue,
      };

      const result = assignTeams(players, teams, undefined, manualAssignments);

      // Manual assignments should be respected
      expect(result.get(players[0])).toEqual(ColoredTeams.Blue);
      expect(result.get(players[1])).toEqual(ColoredTeams.Blue);
      // Remaining players should be auto-assigned to balance
      expect(result.get(players[2])).toEqual(ColoredTeams.Red);
      expect(result.get(players[3])).toEqual(ColoredTeams.Red);
    });

    it("should ignore manual assignments for invalid teams", () => {
      const players = [
        createPlayerWithClientID("1", "client1"),
        createPlayerWithClientID("2", "client2"),
      ];

      const manualAssignments = {
        client1: "NonExistentTeam", // Invalid team
      };

      const result = assignTeams(players, teams, undefined, manualAssignments);

      // Player should be auto-assigned since team doesn't exist
      expect(result.get(players[0])).toEqual(ColoredTeams.Red);
      expect(result.get(players[1])).toEqual(ColoredTeams.Blue);
    });

    it("should handle partial manual assignments", () => {
      const players = [
        createPlayerWithClientID("1", "client1"),
        createPlayerWithClientID("2", "client2"),
        createPlayerWithClientID("3", "client3"),
        createPlayerWithClientID("4", "client4"),
      ];

      const manualAssignments = {
        client3: ColoredTeams.Red, // Only one manual assignment
      };

      const result = assignTeams(players, teams, undefined, manualAssignments);

      // Manual assignment should be respected
      expect(result.get(players[2])).toEqual(ColoredTeams.Red);
      // Other players auto-assigned
      expect(result.get(players[0])).toEqual(ColoredTeams.Blue);
      expect(result.get(players[1])).toEqual(ColoredTeams.Red);
      expect(result.get(players[3])).toEqual(ColoredTeams.Blue);
    });

    it("should not exceed team max size with manual assignments", () => {
      const players = [
        createPlayerWithClientID("1", "client1"),
        createPlayerWithClientID("2", "client2"),
        createPlayerWithClientID("3", "client3"),
        createPlayerWithClientID("4", "client4"),
      ];

      // Try to assign all players to one team (max size is 2)
      const manualAssignments = {
        client1: ColoredTeams.Red,
        client2: ColoredTeams.Red,
        client3: ColoredTeams.Red, // Should be ignored (team full)
        client4: ColoredTeams.Red, // Should be ignored (team full)
      };

      const result = assignTeams(players, teams, undefined, manualAssignments);

      // First two should be on Red, others auto-assigned
      expect(result.get(players[0])).toEqual(ColoredTeams.Red);
      expect(result.get(players[1])).toEqual(ColoredTeams.Red);
      expect(result.get(players[2])).toEqual(ColoredTeams.Blue);
      expect(result.get(players[3])).toEqual(ColoredTeams.Blue);
    });

    it("should work with clans and manual assignments together", () => {
      const players = [
        createPlayerWithClientID("1", "client1", "CLANA"),
        createPlayerWithClientID("2", "client2", "CLANA"),
        createPlayerWithClientID("3", "client3"),
        createPlayerWithClientID("4", "client4"),
      ];

      // Manually assign a clan member to Blue
      const manualAssignments = {
        client1: ColoredTeams.Blue,
      };

      const result = assignTeams(players, teams, undefined, manualAssignments);

      // Manual assignment respected
      expect(result.get(players[0])).toEqual(ColoredTeams.Blue);
      // Clan member stays together but on the team with fewer players (Red is empty)
      expect(result.get(players[1])).toEqual(ColoredTeams.Red);
      // Other players balance - Red has 1, Blue has 1
      expect(result.get(players[2])).toEqual(ColoredTeams.Red);
      expect(result.get(players[3])).toEqual(ColoredTeams.Blue);
    });
  });
});
