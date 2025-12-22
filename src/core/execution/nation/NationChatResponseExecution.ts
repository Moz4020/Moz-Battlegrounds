import {
  Execution,
  Game,
  Player,
  PlayerID,
  PlayerType,
  Tick,
} from "../../game/Game";
import { PseudoRandom } from "../../PseudoRandom";
import { NationChatBehavior } from "./NationChatBehavior";

/**
 * Execution that handles delayed AI response to quick chat messages.
 * This adds a realistic delay before the Nation AI processes and responds to chat.
 */
export class NationChatResponseExecution implements Execution {
  private mg: Game;
  private active = true;
  private respondTick: Tick;
  private random: PseudoRandom;
  private chatBehavior: NationChatBehavior | null = null;

  // Response delay in ticks (10-30 ticks = 1-3 seconds)
  private static readonly MIN_DELAY = 10;
  private static readonly MAX_DELAY = 30;

  constructor(
    private nationPlayer: Player,
    private senderID: PlayerID,
    private quickChatKey: string,
    private targetPlayerID?: PlayerID,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.random = new PseudoRandom(ticks + this.nationPlayer.smallID());

    // Calculate when to respond (with some randomized delay)
    const delay = this.random.nextInt(
      NationChatResponseExecution.MIN_DELAY,
      NationChatResponseExecution.MAX_DELAY,
    );
    this.respondTick = ticks + delay;

    // Initialize the chat behavior
    this.chatBehavior = new NationChatBehavior(
      this.random,
      this.mg,
      this.nationPlayer,
    );

    // Validate sender exists and is human
    if (!mg.hasPlayer(this.senderID)) {
      console.warn(
        `NationChatResponseExecution: sender ${this.senderID} not found`,
      );
      this.active = false;
      return;
    }

    const sender = mg.player(this.senderID);
    if (sender.type() !== PlayerType.Human) {
      this.active = false;
      return;
    }

    // Validate the nation is still alive
    if (!this.nationPlayer.isAlive()) {
      this.active = false;
      return;
    }
  }

  tick(ticks: number): void {
    // Wait until it's time to respond
    if (ticks < this.respondTick) {
      return;
    }

    // Validate players are still valid
    if (!this.mg.hasPlayer(this.senderID) || !this.nationPlayer.isAlive()) {
      this.active = false;
      return;
    }

    const sender = this.mg.player(this.senderID);

    // Process the chat request
    if (this.chatBehavior) {
      this.chatBehavior.processChat(
        sender,
        this.quickChatKey,
        this.targetPlayerID,
      );
    }

    this.active = false;
  }

  owner(): Player {
    return this.nationPlayer;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
