import {
  Difficulty,
  Game,
  Player,
  PlayerType,
  Relation,
  TerraNullius,
  Tick,
} from "../../game/Game";
import { PseudoRandom } from "../../PseudoRandom";
import {
  assertNever,
  boundingBoxCenter,
  calculateBoundingBoxCenter,
  flattenedEmojiTable,
} from "../../Util";
import { AttackExecution } from "../AttackExecution";
import { EmojiExecution } from "../EmojiExecution";
import { TransportShipExecution } from "../TransportShipExecution";
import { closestTwoTiles } from "../Util";

const emojiId = (e: (typeof flattenedEmojiTable)[number]) =>
  flattenedEmojiTable.indexOf(e);
const EMOJI_ASSIST_ACCEPT = (["👍", "⛵", "🤝", "🎯"] as const).map(emojiId);
const EMOJI_RELATION_TOO_LOW = (["🥱", "🤦‍♂️"] as const).map(emojiId);
const EMOJI_TARGET_ME = (["🥺", "💀"] as const).map(emojiId);
const EMOJI_TARGET_ALLY = (["🕊️", "👎"] as const).map(emojiId);
const EMOJI_HECKLE = (["🤡", "😡"] as const).map(emojiId);
// New emoji constants for smart assist refusals
const EMOJI_BUSY = (["⏳", "🛡️", "⚠️"] as const).map(emojiId);
const EMOJI_TOO_STRONG = (["😱", "💀", "🆘"] as const).map(emojiId);
const EMOJI_LOW_TROOPS = (["😞", "🥺", "🏳️"] as const).map(emojiId);
const EMOJI_REJECT_CHANCE = (["🥱", "😞", "❓"] as const).map(emojiId);

// Thresholds for smart assist decisions
const TARGET_TOO_STRONG_RATIO = 2.0; // Target has 2x more troops
const LOW_TROOPS_RATIO = 0.3; // AI has less than 30% of max troops

export class AiAttackBehavior {
  private botAttackTroopsSent: number = 0;
  private readonly lastEmojiSent = new Map<Player, Tick>();

  constructor(
    private random: PseudoRandom,
    private game: Game,
    private player: Player,
    private triggerRatio: number,
    private reserveRatio: number,
    private expandRatio: number,
  ) {}

  /**
   * Check if the AI is currently busy (under significant attack)
   */
  private isUnderHeavyAttack(): boolean {
    const incomingAttacks = this.player.incomingAttacks();
    if (incomingAttacks.length === 0) return false;

    // Calculate total incoming troops
    const totalIncomingTroops = incomingAttacks.reduce(
      (sum, attack) => sum + attack.troops(),
      0,
    );

    // Consider "heavy attack" if incoming troops > 20% of our troops
    return totalIncomingTroops > this.player.troops() * 0.2;
  }

  /**
   * Check if the target is too strong for the AI to attack
   */
  private isTargetTooStrong(target: Player): boolean {
    return target.troops() > this.player.troops() * TARGET_TOO_STRONG_RATIO;
  }

  /**
   * Check if the AI has enough troops to spare for assisting
   */
  private hasEnoughTroopsToAssist(): boolean {
    const maxTroops = this.game.config().maxTroops(this.player);
    const ratio = this.player.troops() / maxTroops;
    return ratio >= LOW_TROOPS_RATIO;
  }

  /**
   * Get all friendly players (allies + teammates) who might need assistance
   */
  private getFriendlyPlayers(): Player[] {
    const allies = this.player.allies();
    const teammates = this.game
      .players()
      .filter((p) => p !== this.player && this.player.isOnSameTeam(p));

    // Combine and deduplicate (in case someone is both ally and teammate)
    const friendlySet = new Set([...allies, ...teammates]);
    return Array.from(friendlySet);
  }

  /**
   * Calculate the chance of assisting an ally/teammate based on various factors
   * Returns a percentage (0-100) representing likelihood to assist
   */
  private getAssistChance(ally: Player, target: Player): number {
    const { difficulty } = this.game.config().gameConfig();
    const isTeammate = this.player.isOnSameTeam(ally);
    const isAllied = this.player.isAlliedWith(ally);

    // Base chance based on difficulty
    let baseChance: number;
    switch (difficulty) {
      case Difficulty.Easy:
        // Easy AI is very helpful
        baseChance = 90;
        break;
      case Difficulty.Medium:
        baseChance = 70;
        break;
      case Difficulty.Hard:
        // Hard AI is more strategic
        baseChance = 50;
        break;
      default:
        assertNever(difficulty);
    }

    // Teammates get highest priority (almost always help)
    if (isTeammate) {
      baseChance *= 1.3; // 30% bonus for teammates
    } else if (isAllied) {
      baseChance *= 1.0; // No modifier for allies
    }
    // Note: If neither teammate nor allied, they shouldn't be in the friendly list

    // Reduce chance if target is stronger than us
    const troopRatio = this.player.troops() / target.troops();
    if (troopRatio < 0.5) {
      // We have less than half their troops - very reluctant
      baseChance *= 0.3;
    } else if (troopRatio < 1.0) {
      // We have fewer troops - somewhat reluctant
      baseChance *= 0.6;
    }
    // If we have more troops, no penalty

    // Reduce chance if under attack (but less reduction for teammates)
    if (this.player.incomingAttacks().length > 0) {
      baseChance *= isTeammate ? 0.7 : 0.5; // Teammates still get some priority
    }

    // Reduce chance if we don't share a border with target
    if (!this.player.sharesBorderWith(target)) {
      baseChance *= 0.7; // Less likely to send boats
    }

    return Math.min(100, Math.max(0, baseChance));
  }

  /**
   * Send a chat message to an ally about assist decision
   */
  private sendAssistChatMessage(
    ally: Player,
    messageKey: string,
    accepted: boolean,
  ): void {
    // Only send to human players
    if (ally.type() !== PlayerType.Human) return;

    // Use displayChat to show in the game log
    this.game.displayChat(
      messageKey,
      "assist",
      ally.id(),
      this.player.id(),
      false, // isFrom = false (AI is responding TO the ally)
      ally.id(),
    );
  }

  private emoji(player: Player, emoji: number) {
    if (player.type() !== PlayerType.Human) return;
    this.game.addExecution(new EmojiExecution(this.player, player.id(), emoji));
  }

  // Prevent attacking of humans on lower difficulties
  private shouldAttack(other: Player | TerraNullius): boolean {
    // Always attack Terra Nullius, non-humans and traitors
    if (
      other.isPlayer() === false ||
      other.type() !== PlayerType.Human ||
      other.isTraitor()
    ) {
      return true;
    }

    const { difficulty } = this.game.config().gameConfig();
    if (difficulty === Difficulty.Easy && this.random.chance(4)) {
      return false;
    }
    if (difficulty === Difficulty.Medium && this.random.chance(2)) {
      return false;
    }
    return true;
  }

  private betray(target: Player): void {
    const alliance = this.player.allianceWith(target);
    if (!alliance) return;
    this.player.breakAlliance(alliance);
  }

  private hasReserveRatioTroops(): boolean {
    const maxTroops = this.game.config().maxTroops(this.player);
    const ratio = this.player.troops() / maxTroops;
    return ratio >= this.reserveRatio;
  }

  private hasTriggerRatioTroops(): boolean {
    const maxTroops = this.game.config().maxTroops(this.player);
    const ratio = this.player.troops() / maxTroops;
    return ratio >= this.triggerRatio;
  }

  private findIncomingAttackPlayer(): Player | null {
    // Ignore bot attacks if we are not a bot.
    let incomingAttacks = this.player.incomingAttacks();
    if (this.player.type() !== PlayerType.Bot) {
      incomingAttacks = incomingAttacks.filter(
        (attack) => attack.attacker().type() !== PlayerType.Bot,
      );
    }
    let largestAttack = 0;
    let largestAttacker: Player | undefined;
    for (const attack of incomingAttacks) {
      if (attack.troops() <= largestAttack) continue;
      largestAttack = attack.troops();
      largestAttacker = attack.attacker();
    }
    if (largestAttacker !== undefined) {
      return largestAttacker;
    }
    return null;
  }

  getNeighborTraitorToAttack(): Player | null {
    const traitors = this.player
      .neighbors()
      .filter(
        (n): n is Player =>
          n.isPlayer() && this.player.isFriendly(n) === false && n.isTraitor(),
      );
    return traitors.length > 0 ? this.random.randElement(traitors) : null;
  }

  assistAllies() {
    // Get all friendly players (allies + teammates)
    const friendlyPlayers = this.getFriendlyPlayers();

    for (const friendly of friendlyPlayers) {
      if (friendly.targets().length === 0) continue;

      const isTeammate = this.player.isOnSameTeam(friendly);

      // Check if relation is too low (skip for teammates - they're always friendly)
      if (!isTeammate && this.player.relation(friendly) < Relation.Friendly) {
        this.emoji(friendly, this.random.randElement(EMOJI_RELATION_TOO_LOW));
        this.sendAssistChatMessage(friendly, "relation_too_low", false);
        continue;
      }

      for (const target of friendly.targets()) {
        // Don't attack ourselves
        if (target === this.player) {
          this.emoji(friendly, this.random.randElement(EMOJI_TARGET_ME));
          this.sendAssistChatMessage(friendly, "target_is_me", false);
          continue;
        }

        // Don't attack our friends (but for teammates, be more aggressive)
        if (this.player.isFriendly(target)) {
          // If both are teammates, this is a conflict - don't attack
          if (this.player.isOnSameTeam(target)) {
            this.emoji(friendly, this.random.randElement(EMOJI_TARGET_ALLY));
            this.sendAssistChatMessage(friendly, "target_is_teammate", false);
            continue;
          }
          // If target is just an ally (not teammate), and requester is teammate, might still help
          if (!isTeammate) {
            this.emoji(friendly, this.random.randElement(EMOJI_TARGET_ALLY));
            this.sendAssistChatMessage(friendly, "target_is_friend", false);
            continue;
          }
          // Teammate asking to attack our ally - conflicting loyalties, decline
          this.emoji(friendly, this.random.randElement(EMOJI_TARGET_ALLY));
          this.sendAssistChatMessage(friendly, "target_is_ally", false);
          continue;
        }

        // Smart check 1: Are we under heavy attack? (Busy)
        // Teammates get a pass on this check more often
        if (
          this.isUnderHeavyAttack() &&
          !(isTeammate && this.random.chance(2))
        ) {
          this.emoji(friendly, this.random.randElement(EMOJI_BUSY));
          this.sendAssistChatMessage(friendly, "busy_under_attack", false);
          continue;
        }

        // Smart check 2: Is target too strong?
        // Teammates get a slightly higher tolerance
        const strengthThreshold = isTeammate
          ? TARGET_TOO_STRONG_RATIO * 1.25
          : TARGET_TOO_STRONG_RATIO;
        if (target.troops() > this.player.troops() * strengthThreshold) {
          this.emoji(friendly, this.random.randElement(EMOJI_TOO_STRONG));
          this.sendAssistChatMessage(friendly, "target_too_strong", false);
          continue;
        }

        // Smart check 3: Do we have enough troops?
        if (!this.hasEnoughTroopsToAssist()) {
          this.emoji(friendly, this.random.randElement(EMOJI_LOW_TROOPS));
          this.sendAssistChatMessage(friendly, "low_troops", false);
          continue;
        }

        // Calculate chance-based decision
        const assistChance = this.getAssistChance(friendly, target);
        const roll = this.random.nextInt(0, 100);

        if (roll > assistChance) {
          // Failed the chance roll - decline to assist
          this.emoji(friendly, this.random.randElement(EMOJI_REJECT_CHANCE));
          this.sendAssistChatMessage(friendly, "declined", false);
          continue;
        }

        // All checks passed and chance succeeded - assist them!
        this.player.updateRelation(friendly, -20);
        this.sendAttack(target);
        this.emoji(friendly, this.random.randElement(EMOJI_ASSIST_ACCEPT));
        this.sendAssistChatMessage(friendly, "accepted", true);
        return;
      }
    }
  }

  attackBestTarget(borderingFriends: Player[], borderingEnemies: Player[]) {
    // Save up troops until we reach the reserve ratio
    if (!this.hasReserveRatioTroops()) return;

    // Maybe save up troops until we reach the trigger ratio
    if (!this.hasTriggerRatioTroops() && !this.random.chance(10)) return;

    // Retaliate against incoming attacks (Most important!)
    const incomingAttackPlayer = this.findIncomingAttackPlayer();
    if (incomingAttackPlayer) {
      this.sendAttack(incomingAttackPlayer, true);
      return;
    }

    // Attack bots
    if (this.attackBots()) return;

    // Maybe betray and attack
    if (this.maybeBetrayAndAttack(borderingFriends)) return;

    // Attack nuked territory
    if (this.isBorderingNukedTerritory()) {
      this.sendAttack(this.game.terraNullius());
      return;
    }

    // Attack the most hated player with hostile relation
    const mostHated = this.player.allRelationsSorted()[0];
    if (
      mostHated !== undefined &&
      mostHated.relation === Relation.Hostile &&
      this.player.isFriendly(mostHated.player) === false
    ) {
      this.sendAttack(mostHated.player);
      return;
    }

    // Attack the weakest player
    if (borderingEnemies.length > 0) {
      this.sendAttack(borderingEnemies[0]);
      return;
    }

    // If we don't have bordering enemies, attack someone on an island next to us
    if (borderingEnemies.length === 0) {
      const nearestIslandEnemy = this.findNearestIslandEnemy();
      if (nearestIslandEnemy) {
        this.sendAttack(nearestIslandEnemy);
        return;
      }
    }
  }

  // Sort neighboring bots by density (troops / tiles) and attempt to attack many of them (Parallel attacks)
  // sendAttack will do nothing if we don't have enough reserve troops left
  attackBots(): boolean {
    const bots = this.player
      .neighbors()
      .filter(
        (n): n is Player =>
          n.isPlayer() &&
          this.player.isFriendly(n) === false &&
          n.type() === PlayerType.Bot,
      );

    if (bots.length === 0) {
      return false;
    }

    this.botAttackTroopsSent = 0;

    const density = (p: Player) => p.troops() / p.numTilesOwned();
    const sortedBots = bots.slice().sort((a, b) => density(a) - density(b));
    const reducedBots = sortedBots.slice(0, this.getBotAttackMaxParallelism());

    for (const bot of reducedBots) {
      this.sendAttack(bot);
    }

    // Only short-circuit the rest of the targeting pipeline if we actually
    // allocated some troops to bot attacks.
    return this.botAttackTroopsSent > 0;
  }

  getBotAttackMaxParallelism(): number {
    const { difficulty } = this.game.config().gameConfig();
    switch (difficulty) {
      case Difficulty.Easy:
        return 1;
      case Difficulty.Medium:
        return 2;
      case Difficulty.Hard:
        return 4;
      default:
        assertNever(difficulty);
    }
  }

  // Betray friends if we have 10 times more troops than them
  // TODO: Implement better and deeper strategies, for example:
  // Check impact on relations with other players
  // Check value of targets territory
  // Check if target is distracted
  // Check the targets territory size
  maybeBetrayAndAttack(borderingFriends: Player[]): boolean {
    if (borderingFriends.length > 0) {
      for (const friend of borderingFriends) {
        if (
          this.player.isAlliedWith(friend) &&
          this.player.troops() >= friend.troops() * 10
        ) {
          this.betray(friend);
          this.sendAttack(friend, true);
          return true;
        }
      }
    }
    return false;
  }

  // TODO: Nuke the crown if it's far enough ahead of everybody else (based on difficulty)
  findBestNukeTarget(borderingEnemies: Player[]): Player | null {
    // Retaliate against incoming attacks (Most important!)
    const incomingAttackPlayer = this.findIncomingAttackPlayer();
    if (incomingAttackPlayer) {
      return incomingAttackPlayer;
    }

    // Find the most hated player with hostile relation
    const mostHated = this.player.allRelationsSorted()[0];
    if (
      mostHated !== undefined &&
      mostHated.relation === Relation.Hostile &&
      this.player.isFriendly(mostHated.player) === false
    ) {
      return mostHated.player;
    }

    // Find the weakest player
    if (borderingEnemies.length > 0) {
      return borderingEnemies[0];
    }

    // If we don't have bordering enemies, find someone on an island next to us
    if (borderingEnemies.length === 0) {
      const nearestIslandEnemy = this.findNearestIslandEnemy();
      if (nearestIslandEnemy) {
        return nearestIslandEnemy;
      }
    }

    return null;
  }

  getPlayerCenter(player: Player) {
    if (player.largestClusterBoundingBox) {
      return boundingBoxCenter(player.largestClusterBoundingBox);
    }
    return calculateBoundingBoxCenter(this.game, player.borderTiles());
  }

  findNearestIslandEnemy(): Player | null {
    const myBorder = this.player.borderTiles();
    if (myBorder.size === 0) return null;

    const filteredPlayers = this.game.players().filter((p) => {
      if (p === this.player) return false;
      if (!p.isAlive()) return false;
      if (p.borderTiles().size === 0) return false;
      if (this.player.isFriendly(p)) return false;
      // Don't spam boats into players more than 2x our troops
      return p.troops() <= this.player.troops() * 2;
    });

    if (filteredPlayers.length > 0) {
      const playerCenter = this.getPlayerCenter(this.player);

      const sortedPlayers = filteredPlayers
        .map((filteredPlayer) => {
          const filteredPlayerCenter = this.getPlayerCenter(filteredPlayer);

          const playerCenterTile = this.game.ref(
            playerCenter.x,
            playerCenter.y,
          );
          const filteredPlayerCenterTile = this.game.ref(
            filteredPlayerCenter.x,
            filteredPlayerCenter.y,
          );

          const distance = this.game.manhattanDist(
            playerCenterTile,
            filteredPlayerCenterTile,
          );
          return { player: filteredPlayer, distance };
        })
        .sort((a, b) => a.distance - b.distance); // Sort by distance (ascending)

      // Select the nearest or second-nearest enemy (So our boat doesn't always run into the same warship, if there is one)
      let selectedEnemy: Player | null;
      if (sortedPlayers.length > 1 && this.random.chance(2)) {
        selectedEnemy = sortedPlayers[1].player;
      } else {
        selectedEnemy = sortedPlayers[0].player;
      }

      if (selectedEnemy !== null) {
        return selectedEnemy;
      }
    }
    return null;
  }

  attackRandomTarget() {
    // Save up troops until we reach the trigger ratio
    if (!this.hasTriggerRatioTroops()) return;

    // Retaliate against incoming attacks
    const incomingAttackPlayer = this.findIncomingAttackPlayer();
    if (incomingAttackPlayer) {
      this.sendAttack(incomingAttackPlayer, true);
      return;
    }

    // Select a traitor as an enemy
    const toAttack = this.getNeighborTraitorToAttack();
    if (toAttack !== null) {
      if (this.random.chance(3)) {
        this.sendAttack(toAttack);
        return;
      }
    }

    // Choose a new enemy randomly
    const { difficulty } = this.game.config().gameConfig();
    const neighbors = this.player.neighbors();
    for (const neighbor of this.random.shuffleArray(neighbors)) {
      if (!neighbor.isPlayer()) continue;
      if (this.player.isFriendly(neighbor)) continue;
      if (
        neighbor.type() === PlayerType.Nation ||
        neighbor.type() === PlayerType.Human
      ) {
        if (this.random.chance(2) || difficulty === Difficulty.Easy) {
          continue;
        }
      }
      this.sendAttack(neighbor);
      return;
    }
  }

  isBorderingNukedTerritory(): boolean {
    for (const tile of this.player.borderTiles()) {
      for (const neighbor of this.game.neighbors(tile)) {
        if (
          this.game.isLand(neighbor) &&
          !this.game.hasOwner(neighbor) &&
          this.game.hasFallout(neighbor)
        ) {
          return true;
        }
      }
    }
    return false;
  }

  forceSendAttack(target: Player | TerraNullius) {
    this.game.addExecution(
      new AttackExecution(
        this.player.troops() / 2,
        this.player,
        target.isPlayer() ? target.id() : this.game.terraNullius().id(),
      ),
    );
  }

  sendAttack(target: Player | TerraNullius, force = false) {
    if (!force && !this.shouldAttack(target)) return;

    if (this.player.sharesBorderWith(target)) {
      this.sendLandAttack(target);
    } else if (target.isPlayer()) {
      this.sendBoatAttack(target);
    }
  }

  sendLandAttack(target: Player | TerraNullius) {
    const maxTroops = this.game.config().maxTroops(this.player);
    const reserveRatio = target.isPlayer()
      ? this.reserveRatio
      : this.expandRatio;
    const targetTroops = maxTroops * reserveRatio;

    let troops;
    if (
      target.isPlayer() &&
      target.type() === PlayerType.Bot &&
      this.player.type() !== PlayerType.Bot
    ) {
      troops = this.calculateBotAttackTroops(
        target,
        this.player.troops() - targetTroops - this.botAttackTroopsSent,
      );
    } else {
      troops = this.player.troops() - targetTroops;
    }

    if (troops < 1) {
      return;
    }

    this.game.addExecution(
      new AttackExecution(
        troops,
        this.player,
        target.isPlayer() ? target.id() : this.game.terraNullius().id(),
      ),
    );

    if (target.isPlayer()) {
      this.maybeSendEmoji(target);
    }
  }

  sendBoatAttack(other: Player) {
    const closest = closestTwoTiles(
      this.game,
      Array.from(this.player.borderTiles()).filter((t) =>
        this.game.isOceanShore(t),
      ),
      Array.from(other.borderTiles()).filter((t) => this.game.isOceanShore(t)),
    );
    if (closest === null) {
      return;
    }

    let troops;
    if (other.type() === PlayerType.Bot) {
      troops = this.calculateBotAttackTroops(other, this.player.troops() / 5);
    } else {
      troops = this.player.troops() / 5;
    }

    if (troops < 1) {
      return;
    }

    this.game.addExecution(
      new TransportShipExecution(
        this.player,
        other.id(),
        closest.y,
        troops,
        null,
      ),
    );

    this.maybeSendEmoji(other);
  }

  calculateBotAttackTroops(target: Player, maxTroops: number): number {
    const { difficulty } = this.game.config().gameConfig();
    if (difficulty === Difficulty.Easy) {
      this.botAttackTroopsSent += maxTroops;
      return maxTroops;
    }
    let troops = target.troops() * 4;

    // Don't send more troops than maxTroops (Keep reserve)
    if (troops > maxTroops) {
      // If we haven't enough troops left to do a big enough bot attack, skip it
      if (maxTroops < target.troops() * 2) {
        troops = 0;
      } else {
        troops = maxTroops;
      }
    }
    this.botAttackTroopsSent += troops;
    return troops;
  }

  maybeSendEmoji(enemy: Player) {
    if (this.player.type() === PlayerType.Bot) return;
    if (enemy.type() !== PlayerType.Human) return;
    const lastSent = this.lastEmojiSent.get(enemy) ?? -300;
    if (this.game.ticks() - lastSent <= 300) return;
    this.lastEmojiSent.set(enemy, this.game.ticks());
    this.game.addExecution(
      new EmojiExecution(
        this.player,
        enemy.id(),
        this.random.randElement(EMOJI_HECKLE),
      ),
    );
  }
}
