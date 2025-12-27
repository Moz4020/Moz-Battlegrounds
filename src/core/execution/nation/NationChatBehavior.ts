import {
  Difficulty,
  Game,
  Player,
  PlayerID,
  PlayerType,
  Relation,
  Tick,
} from "../../game/Game";
import { PseudoRandom } from "../../PseudoRandom";
import { assertNever, flattenedEmojiTable, toInt } from "../../Util";
import { AttackExecution } from "../AttackExecution";
import { DonateGoldExecution } from "../DonateGoldExecution";
import { DonateTroopsExecution } from "../DonateTroopExecution";
import { EmojiExecution } from "../EmojiExecution";

const emojiId = (e: (typeof flattenedEmojiTable)[number]) =>
  flattenedEmojiTable.indexOf(e);

// Emoji responses for different situations (only use emojis from flattenedEmojiTable)
const EMOJI_ACCEPT = (["👍", "🤝", "💪", "❤️"] as const).map(emojiId);
const EMOJI_REJECT_HOSTILE = (["👎", "🖕", "😡", "💀"] as const).map(emojiId);
const EMOJI_REJECT_NEUTRAL = (["🥱", "😞", "🤦‍♂️"] as const).map(emojiId);
const EMOJI_REJECT_BUSY = (["⏳", "🛡️", "⚠️"] as const).map(emojiId);
const EMOJI_ATTACK_ACCEPT = (["🎯", "💥", "🔥", "☢️"] as const).map(emojiId);

// Cooldown between processing chat requests from the same player (in ticks)
const CHAT_COOLDOWN_TICKS = 100; // ~10 seconds

// Types of chat requests the AI can respond to
export enum ChatRequestType {
  Troops = "troops",
  Gold = "gold",
  Attack = "attack",
  Unknown = "unknown",
}

export class NationChatBehavior {
  private readonly lastChatProcessed = new Map<PlayerID, Tick>();

  constructor(
    private random: PseudoRandom,
    private game: Game,
    private player: Player,
  ) {}

  /**
   * Process an incoming quick chat message from a player
   * Returns true if the request was processed (accepted or rejected)
   */
  processChat(
    sender: Player,
    quickChatKey: string,
    targetPlayerID?: PlayerID,
  ): boolean {
    // Only respond to humans
    if (sender.type() !== PlayerType.Human) return false;

    // Check cooldown
    if (this.isOnCooldown(sender)) {
      return false;
    }

    // Parse the chat request type
    const requestType = this.parseRequestType(quickChatKey);
    if (requestType === ChatRequestType.Unknown) {
      return false;
    }

    // Record this chat processing
    this.lastChatProcessed.set(sender.id(), this.game.ticks());

    // Handle based on request type
    switch (requestType) {
      case ChatRequestType.Troops:
        return this.handleTroopRequest(sender);
      case ChatRequestType.Gold:
        return this.handleGoldRequest(sender);
      case ChatRequestType.Attack:
        return this.handleAttackRequest(sender, targetPlayerID);
      default:
        return false;
    }
  }

  private isOnCooldown(sender: Player): boolean {
    const lastProcessed = this.lastChatProcessed.get(sender.id());
    if (lastProcessed === undefined) return false;
    return this.game.ticks() - lastProcessed < CHAT_COOLDOWN_TICKS;
  }

  private parseRequestType(quickChatKey: string): ChatRequestType {
    // QuickChat keys are like "help.troops", "help.gold", "attack.attack"
    if (quickChatKey.includes("troops")) return ChatRequestType.Troops;
    if (quickChatKey.includes("gold")) return ChatRequestType.Gold;
    if (quickChatKey.includes("attack.attack")) return ChatRequestType.Attack;
    return ChatRequestType.Unknown;
  }

  /**
   * Handle a request for troops donation
   */
  private handleTroopRequest(sender: Player): boolean {
    const acceptChance = this.getAcceptChance(sender, false);

    if (!this.random.chance(Math.round(100 / acceptChance))) {
      // Accepted!
      const troops = this.calculateTroopDonation(sender);
      if (troops > 0 && this.player.canDonateTroops(sender)) {
        this.game.addExecution(
          new DonateTroopsExecution(this.player, sender.id(), troops),
        );
        this.sendEmoji(sender, this.random.randElement(EMOJI_ACCEPT));
        return true;
      }
    }

    // Rejected
    this.sendRejectEmoji(sender);
    return true;
  }

  /**
   * Handle a request for gold donation
   */
  private handleGoldRequest(sender: Player): boolean {
    const acceptChance = this.getAcceptChance(sender, false);

    if (!this.random.chance(Math.round(100 / acceptChance))) {
      // Accepted!
      const gold = this.calculateGoldDonation(sender);
      if (gold > 0n && this.player.canDonateGold(sender)) {
        this.game.addExecution(
          new DonateGoldExecution(this.player, sender.id(), Number(gold)),
        );
        this.sendEmoji(sender, this.random.randElement(EMOJI_ACCEPT));
        return true;
      }
    }

    // Rejected
    this.sendRejectEmoji(sender);
    return true;
  }

  /**
   * Handle a request to attack a target player
   */
  private handleAttackRequest(
    sender: Player,
    targetPlayerID?: PlayerID,
  ): boolean {
    if (!targetPlayerID || !this.game.hasPlayer(targetPlayerID)) {
      this.sendRejectEmoji(sender);
      return true;
    }

    const target = this.game.player(targetPlayerID);

    // Don't attack ourselves
    if (target.id() === this.player.id()) {
      this.sendEmoji(sender, emojiId("🤦‍♂️"));
      return true;
    }

    // Don't attack our allies
    if (this.player.isAlliedWith(target)) {
      this.sendEmoji(sender, emojiId("🕊️"));
      return true;
    }

    // Don't attack if we're friendly with the target (unless we're allied with sender)
    if (this.player.isFriendly(target) && !this.player.isAlliedWith(sender)) {
      this.sendEmoji(sender, this.random.randElement(EMOJI_REJECT_NEUTRAL));
      return true;
    }

    const acceptChance = this.getAcceptChance(sender, true);

    if (!this.random.chance(Math.round(100 / acceptChance))) {
      // Accepted! Attack the target
      if (this.player.sharesBorderWith(target)) {
        const troops = Math.floor(this.player.troops() * 0.3);
        if (troops > 0) {
          this.game.addExecution(
            new AttackExecution(troops, this.player, target.id()),
          );
          // Add target to our attack priority (decrease relation)
          this.player.updateRelation(target, -30);
          this.sendEmoji(sender, this.random.randElement(EMOJI_ATTACK_ACCEPT));
          return true;
        }
      }
    }

    // Rejected
    this.sendRejectEmoji(sender);
    return true;
  }

  /**
   * Get acceptance chance based on relationship and request type
   * Returns a percentage (0-100)
   */
  private getAcceptChance(sender: Player, isAttackRequest: boolean): number {
    const isTeammate = this.player.isOnSameTeam(sender);
    const isAllied = this.player.isAlliedWith(sender);
    const relation = this.player.relation(sender);
    const { difficulty } = this.game.config().gameConfig();

    // Difficulty modifier (Easy = more generous)
    let difficultyMod = 1.0;
    switch (difficulty) {
      case Difficulty.Easy:
        difficultyMod = 1.5;
        break;
      case Difficulty.Medium:
        difficultyMod = 1.0;
        break;
      case Difficulty.Hard:
        difficultyMod = 0.7;
        break;
      default:
        assertNever(difficulty);
    }

    let baseChance: number;

    if (isTeammate) {
      // Teammates get highest priority: 90-99% for resources, 85-95% for attacks
      baseChance = isAttackRequest
        ? this.random.nextInt(85, 95)
        : this.random.nextInt(90, 99);
    } else if (isAllied) {
      // Allied: 80-95% for resources, 70-85% for attacks
      baseChance = isAttackRequest
        ? this.random.nextInt(70, 85)
        : this.random.nextInt(80, 95);
    } else {
      switch (relation) {
        case Relation.Friendly:
          // Friendly: 40-60% for resources, 30-50% for attacks
          baseChance = isAttackRequest
            ? this.random.nextInt(30, 50)
            : this.random.nextInt(40, 60);
          break;
        case Relation.Neutral:
          // Neutral: 5-15% for resources, 5-10% for attacks
          baseChance = isAttackRequest
            ? this.random.nextInt(5, 10)
            : this.random.nextInt(5, 15);
          break;
        case Relation.Distrustful:
          // Distrustful: 1-5% for resources, 0-2% for attacks
          baseChance = isAttackRequest
            ? this.random.nextInt(0, 2)
            : this.random.nextInt(1, 5);
          break;
        case Relation.Hostile:
          // Hostile: 0% for everything
          baseChance = 0;
          break;
        default:
          baseChance = 0;
      }
    }

    // Check if we're under attack - less likely to help (but teammates still get priority)
    if (this.player.incomingAttacks().length > 0) {
      baseChance *= isTeammate ? 0.8 : 0.5; // Teammates only lose 20%, others lose 50%
    }

    return Math.min(100, Math.max(0, baseChance * difficultyMod));
  }

  /**
   * Calculate how many troops to donate based on relationship
   */
  private calculateTroopDonation(sender: Player): number {
    const isTeammate = this.player.isOnSameTeam(sender);
    const isAllied = this.player.isAlliedWith(sender);
    const relation = this.player.relation(sender);

    // Never give more than 25% of troops (but teammates can get up to 30%)
    const maxDonation = this.player.troops() * (isTeammate ? 0.3 : 0.25);

    let donationPercent: number;

    if (isTeammate) {
      donationPercent = 0.2; // 20% for teammates (highest)
    } else if (isAllied) {
      donationPercent = 0.15; // 15% for allies
    } else if (relation === Relation.Friendly) {
      donationPercent = 0.08; // 8% for friendly
    } else {
      donationPercent = 0.03; // 3% for neutral
    }

    const donation = Math.floor(this.player.troops() * donationPercent);
    return Math.min(donation, maxDonation);
  }

  /**
   * Calculate how much gold to donate based on relationship
   */
  private calculateGoldDonation(sender: Player): bigint {
    const isTeammate = this.player.isOnSameTeam(sender);
    const isAllied = this.player.isAlliedWith(sender);
    const relation = this.player.relation(sender);

    // Never give more than 25% of gold (but teammates can get up to 30%)
    const maxDonation = this.player.gold() / (isTeammate ? 3n : 4n);

    let donationPercent: number;

    if (isTeammate) {
      donationPercent = 0.2; // 20% for teammates (highest)
    } else if (isAllied) {
      donationPercent = 0.15; // 15% for allies
    } else if (relation === Relation.Friendly) {
      donationPercent = 0.08; // 8% for friendly
    } else {
      donationPercent = 0.03; // 3% for neutral
    }

    const donation = toInt(Number(this.player.gold()) * donationPercent);
    return donation < maxDonation ? donation : maxDonation;
  }

  /**
   * Send a rejection emoji based on relationship
   */
  private sendRejectEmoji(sender: Player): void {
    const relation = this.player.relation(sender);

    // If under attack, show busy emoji
    if (this.player.incomingAttacks().length > 0) {
      this.sendEmoji(sender, this.random.randElement(EMOJI_REJECT_BUSY));
      return;
    }

    if (relation === Relation.Hostile) {
      this.sendEmoji(sender, this.random.randElement(EMOJI_REJECT_HOSTILE));
    } else {
      this.sendEmoji(sender, this.random.randElement(EMOJI_REJECT_NEUTRAL));
    }
  }

  /**
   * Send an emoji to a player
   */
  private sendEmoji(player: Player, emoji: number): void {
    if (player.type() !== PlayerType.Human) return;
    this.game.addExecution(new EmojiExecution(this.player, player.id(), emoji));
  }
}
