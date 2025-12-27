import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import {
  ColoredTeams,
  Duos,
  GameMode,
  HumansVsNations,
  PlayerInfo,
  PlayerType,
  Quads,
  Team,
  Trios,
} from "../../core/game/Game";
import { assignTeamsLobbyPreview } from "../../core/game/TeamAssignment";
import {
  ClientInfo,
  ManualTeamAssignments,
  TeamCountConfig,
} from "../../core/Schemas";
import { translateText } from "../Utils";

export interface TeamPreviewData {
  team: Team;
  players: ClientInfo[];
}

// Vibrant team colors matching CSS variables
const TEAM_COLORS: Record<string, string> = {
  [ColoredTeams.Red]: "#ef4444",
  [ColoredTeams.Blue]: "#3b82f6",
  [ColoredTeams.Yellow]: "#eab308",
  [ColoredTeams.Green]: "#22c55e",
  [ColoredTeams.Purple]: "#a855f7",
  [ColoredTeams.Orange]: "#f97316",
  [ColoredTeams.Teal]: "#14b8a6",
  [ColoredTeams.Humans]: "#60a5fa",
  [ColoredTeams.Nations]: "#f59e0b",
};

@customElement("lobby-team-view")
export class LobbyTeamView extends LitElement {
  @property({ type: String }) gameMode: GameMode = GameMode.FFA;
  @property({ type: Array }) clients: ClientInfo[] = [];
  @state() private teamPreview: TeamPreviewData[] = [];
  @state() private teamMaxSize: number = 0;
  @property({ type: String }) lobbyCreatorClientID: string = "";
  @property({ attribute: "team-count" }) teamCount: TeamCountConfig = 2;
  @property({ type: Function }) onKickPlayer?: (clientID: string) => void;
  @property({ type: Number }) nationCount: number = 0;
  @property({ type: Boolean }) isHost: boolean = false;
  @property({ type: Function }) onSwapTeam?: (
    clientID: string,
    team: string,
  ) => void;
  @property({ type: Function }) onResetTeamAssignments?: () => void;
  @property({ type: Object }) manualAssignments: ManualTeamAssignments = {};

  @state() private draggedClientID: string | null = null;
  @state() private dragOverTeam: string | null = null;

  willUpdate(changedProperties: Map<string, any>) {
    if (
      changedProperties.has("gameMode") ||
      changedProperties.has("clients") ||
      changedProperties.has("teamCount") ||
      changedProperties.has("nationCount") ||
      changedProperties.has("manualAssignments")
    ) {
      const teamsList = this.getTeamList();
      this.computeTeamPreview(teamsList);
    }
  }

  render() {
    return html`<div class="team-view">
      ${this.gameMode === GameMode.Team
        ? this.renderTeamMode()
        : this.renderFreeForAll()}
    </div>`;
  }

  createRenderRoot() {
    return this;
  }

  private renderTeamMode() {
    const hasManualAssignments = Object.keys(this.manualAssignments).length > 0;

    return html`
      <div class="team-view__header">
        ${this.isHost
          ? html`<div class="team-view__hint">
              ${translateText("host_modal.drag_hint")}
            </div>`
          : html`<div></div>`}
        ${this.isHost && hasManualAssignments
          ? html`<button
              class="team-view__reset-btn"
              @click=${() => this.onResetTeamAssignments?.()}
            >
              ${translateText("host_modal.reset_teams")}
            </button>`
          : ""}
      </div>

      <div class="team-view__grid">
        ${repeat(
          this.teamPreview,
          (p) => p.team,
          (preview) => this.renderTeamCard(preview),
        )}
      </div>
    `;
  }

  private renderFreeForAll() {
    return html`<div class="players-list">
      ${repeat(
        this.clients,
        (c) => c.clientID ?? c.username,
        (client) =>
          html`<span class="player-tag">
            ${client.username}
            ${client.clientID === this.lobbyCreatorClientID
              ? html`<span class="host-badge"
                  >(${translateText("host_modal.host_badge")})</span
                >`
              : html`<button
                  class="remove-player-btn"
                  @click=${() => this.onKickPlayer?.(client.clientID)}
                >
                  ×
                </button>`}
          </span>`,
      )}
    </div>`;
  }

  private handleDragStart(e: DragEvent, clientID: string) {
    if (!this.isHost) return;
    this.draggedClientID = clientID;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", clientID);
    }
  }

  private handleDragEnd() {
    this.draggedClientID = null;
    this.dragOverTeam = null;
  }

  private handleDragOver(e: DragEvent, team: string) {
    if (!this.isHost || !this.draggedClientID) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    this.dragOverTeam = team;
  }

  private handleDragLeave() {
    this.dragOverTeam = null;
  }

  private handleDrop(e: DragEvent, team: string) {
    if (!this.isHost || !this.draggedClientID) return;
    e.preventDefault();

    if (team === ColoredTeams.Nations) {
      this.draggedClientID = null;
      this.dragOverTeam = null;
      return;
    }

    const currentTeamPlayers = this.teamPreview.find(
      (t) => t.team === team,
    )?.players;
    if (currentTeamPlayers && currentTeamPlayers.length >= this.teamMaxSize) {
      this.draggedClientID = null;
      this.dragOverTeam = null;
      return;
    }

    // Also pin existing players on the target team to prevent them from being redistributed
    if (currentTeamPlayers) {
      for (const player of currentTeamPlayers) {
        if (!(player.clientID in this.manualAssignments)) {
          this.onSwapTeam?.(player.clientID, team);
        }
      }
    }

    this.onSwapTeam?.(this.draggedClientID, team);
    this.draggedClientID = null;
    this.dragOverTeam = null;
  }

  private handleTouchStart(e: TouchEvent, clientID: string) {
    if (!this.isHost) return;
    this.draggedClientID = clientID;
    const target = e.target as HTMLElement;
    target.classList.add("player-chip--dragging");
  }

  private handleTouchMove(e: TouchEvent) {
    if (!this.isHost || !this.draggedClientID) return;
    e.preventDefault();

    const touch = e.touches[0];
    const elementUnderTouch = document.elementFromPoint(
      touch.clientX,
      touch.clientY,
    );

    const teamCard = elementUnderTouch?.closest("[data-team]") as HTMLElement;
    if (teamCard) {
      this.dragOverTeam = teamCard.dataset.team ?? null;
    } else {
      this.dragOverTeam = null;
    }
  }

  private handleTouchEnd(e: TouchEvent) {
    if (!this.isHost || !this.draggedClientID) return;

    const touch = e.changedTouches[0];
    const elementUnderTouch = document.elementFromPoint(
      touch.clientX,
      touch.clientY,
    );

    const teamCard = elementUnderTouch?.closest("[data-team]") as HTMLElement;
    if (teamCard && teamCard.dataset.team) {
      const team = teamCard.dataset.team;

      if (team !== ColoredTeams.Nations) {
        const currentTeamPlayers = this.teamPreview.find(
          (t) => t.team === team,
        )?.players;
        if (
          !currentTeamPlayers ||
          currentTeamPlayers.length < this.teamMaxSize
        ) {
          // Also pin existing players on the target team to prevent them from being redistributed
          if (currentTeamPlayers) {
            for (const player of currentTeamPlayers) {
              if (!(player.clientID in this.manualAssignments)) {
                this.onSwapTeam?.(player.clientID, team);
              }
            }
          }
          this.onSwapTeam?.(this.draggedClientID, team);
        }
      }
    }

    const target = e.target as HTMLElement;
    target.classList.remove("player-chip--dragging");
    this.draggedClientID = null;
    this.dragOverTeam = null;
  }

  private renderTeamCard(preview: TeamPreviewData) {
    const isNationsTeam = preview.team === ColoredTeams.Nations;
    const playerCount = isNationsTeam
      ? this.nationCount
      : preview.players.length;
    const maxSize = isNationsTeam ? this.nationCount : this.teamMaxSize;
    const isFull = !isNationsTeam && preview.players.length >= this.teamMaxSize;
    const isEmpty = preview.players.length === 0 && !isNationsTeam;

    const isDropTarget = this.dragOverTeam === preview.team;
    const canDrop = !isNationsTeam && !isFull;

    const teamColor = this.getTeamColor(preview.team);

    const cardClasses = [
      "team-card",
      isDropTarget && canDrop ? "team-card--drag-target" : "",
      isFull ? "team-card--full" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return html`
      <div
        class=${cardClasses}
        data-team=${preview.team}
        @dragover=${(e: DragEvent) => this.handleDragOver(e, preview.team)}
        @dragleave=${() => this.handleDragLeave()}
        @drop=${(e: DragEvent) => this.handleDrop(e, preview.team)}
      >
        <div class="team-card__header">
          <span
            class="team-card__color-dot"
            style="background: ${teamColor}; color: ${teamColor};"
          ></span>
          <span class="team-card__name">${preview.team}</span>
          <span class="team-card__count">${playerCount}/${maxSize}</span>
        </div>

        <div class="team-card__body">
          ${isEmpty
            ? html`<div
                style="font-size: 10px; color: rgba(255,255,255,0.2); text-align: center; margin: auto;"
              >
                Empty
              </div>`
            : isNationsTeam
              ? html`<div
                  style="font-size: 10px; color: rgba(255,255,255,0.3); text-align: center; margin: auto;"
                >
                  AI Nations
                </div>`
              : repeat(
                  preview.players,
                  (p) => p.clientID ?? p.username,
                  (p) => this.renderPlayerChip(p, teamColor),
                )}
        </div>
      </div>
    `;
  }

  private renderPlayerChip(player: ClientInfo, teamColor: string) {
    const isManuallyAssigned = player.clientID in this.manualAssignments;
    const isDragging = this.draggedClientID === player.clientID;
    const isHost = player.clientID === this.lobbyCreatorClientID;

    const chipClasses = [
      "player-chip",
      isDragging ? "player-chip--dragging" : "",
      isManuallyAssigned ? "player-chip--manual" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return html`
      <div
        class=${chipClasses}
        draggable=${this.isHost ? "true" : "false"}
        @dragstart=${(e: DragEvent) => this.handleDragStart(e, player.clientID)}
        @dragend=${() => this.handleDragEnd()}
        @touchstart=${(e: TouchEvent) =>
          this.handleTouchStart(e, player.clientID)}
        @touchmove=${(e: TouchEvent) => this.handleTouchMove(e)}
        @touchend=${(e: TouchEvent) => this.handleTouchEnd(e)}
      >
        <span class="player-chip__name">${player.username}</span>
        ${isManuallyAssigned
          ? html`<span style="font-size: 9px; opacity: 0.6;">📌</span>`
          : ""}
        ${isHost
          ? html`<span class="player-chip__badge"
              >${translateText("host_modal.host_badge")}</span
            >`
          : this.isHost
            ? html`<button
                class="player-chip__kick"
                @click=${(e: Event) => {
                  e.stopPropagation();
                  this.onKickPlayer?.(player.clientID);
                }}
              >
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 8 8"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1 1L7 7M7 1L1 7"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
              </button>`
            : ""}
      </div>
    `;
  }

  private getTeamColor(team: Team): string {
    if (team in TEAM_COLORS) {
      return TEAM_COLORS[team];
    }
    const hash = team.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 55%)`;
  }

  private getTeamList(): Team[] {
    if (this.gameMode !== GameMode.Team) return [];
    const playerCount = this.clients.length + this.nationCount;
    const config = this.teamCount;

    if (config === HumansVsNations) {
      return [ColoredTeams.Humans, ColoredTeams.Nations];
    }

    let numTeams: number;
    if (typeof config === "number") {
      numTeams = Math.max(2, config);
    } else {
      const divisor =
        config === Duos ? 2 : config === Trios ? 3 : config === Quads ? 4 : 2;
      numTeams = Math.max(2, Math.ceil(playerCount / divisor));
    }

    if (numTeams < 8) {
      const ordered: Team[] = [
        ColoredTeams.Red,
        ColoredTeams.Blue,
        ColoredTeams.Yellow,
        ColoredTeams.Green,
        ColoredTeams.Purple,
        ColoredTeams.Orange,
        ColoredTeams.Teal,
      ];
      return ordered.slice(0, numTeams);
    }

    return Array.from({ length: numTeams }, (_, i) => `Team ${i + 1}`);
  }

  private computeTeamPreview(teams: Team[] = []) {
    if (this.gameMode !== GameMode.Team) {
      this.teamPreview = [];
      this.teamMaxSize = 0;
      return;
    }

    if (this.teamCount === HumansVsNations) {
      this.teamMaxSize = this.clients.length;
      this.teamPreview = [
        { team: ColoredTeams.Humans, players: [...this.clients] },
        { team: ColoredTeams.Nations, players: [] },
      ];
      return;
    }

    const players = this.clients.map(
      (c) =>
        new PlayerInfo(c.username, PlayerType.Human, c.clientID, c.clientID),
    );
    const assignment = assignTeamsLobbyPreview(
      players,
      teams,
      this.nationCount,
      this.manualAssignments,
    );
    const buckets = new Map<Team, ClientInfo[]>();
    for (const t of teams) buckets.set(t, []);

    for (const [p, team] of assignment.entries()) {
      if (team === "kicked") continue;
      const bucket = buckets.get(team);
      if (!bucket) continue;
      const client = this.clients.find((c) => c.clientID === p.clientID);
      if (client) bucket.push(client);
    }

    if (this.teamCount === Duos) {
      this.teamMaxSize = 2;
    } else if (this.teamCount === Trios) {
      this.teamMaxSize = 3;
    } else if (this.teamCount === Quads) {
      this.teamMaxSize = 4;
    } else {
      this.teamMaxSize = Math.max(
        1,
        Math.ceil((this.clients.length + this.nationCount) / teams.length),
      );
    }
    this.teamPreview = teams.map((t) => ({
      team: t,
      players: buckets.get(t) ?? [],
    }));
  }
}
