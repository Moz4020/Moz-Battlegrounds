import { LitElement, html } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import randomMap from "../../resources/images/RandomMap.webp";
import { translateText } from "../client/Utils";
import {
  Difficulty,
  Duos,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  HumansVsNations,
  Quads,
  Trios,
  UnitType,
  mapCategories,
} from "../core/game/Game";
import { UserSettings } from "../core/game/UserSettings";
import { TeamCountConfig } from "../core/Schemas";
import { generateID } from "../core/Util";
import "./components/baseComponents/Button";
import "./components/baseComponents/Modal";
import "./components/Difficulties";
import "./components/Maps";
import { fetchCosmetics } from "./Cosmetics";
import { FlagInput } from "./FlagInput";
import { JoinLobbyEvent } from "./Main";
import { UsernameInput } from "./UsernameInput";
import { renderUnitTypeOptions } from "./utilities/RenderUnitTypeOptions";

@customElement("single-player-modal")
export class SinglePlayerModal extends LitElement {
  @query("o-modal") private modalEl!: HTMLElement & {
    open: () => void;
    close: () => void;
  };
  @state() private selectedMap: GameMapType = GameMapType.World;
  @state() private selectedDifficulty: Difficulty = Difficulty.Medium;
  @state() private disableNations: boolean = false;
  @state() private bots: number = 400;
  @state() private infiniteGold: boolean = false;
  @state() private infiniteTroops: boolean = false;
  @state() private compactMap: boolean = false;
  @state() private maxTimer: boolean = false;
  @state() private maxTimerValue: number | undefined = undefined;
  @state() private instantBuild: boolean = false;
  @state() private randomSpawn: boolean = false;
  @state() private freeNukes: boolean = false;
  @state() private permanentAllies: boolean = false;
  @state() private useRandomMap: boolean = false;
  @state() private gameMode: GameMode = GameMode.FFA;
  @state() private teamCount: TeamCountConfig = 2;

  @state() private disabledUnits: UnitType[] = [];

  private userSettings: UserSettings = new UserSettings();

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this.handleKeyDown);
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this.handleKeyDown);
    super.disconnectedCallback();
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Escape") {
      e.preventDefault();
      this.close();
    }
  };

  private renderToggle(id: string, checked: boolean, label: string, onChange: (e: Event) => void) {
    return html`
      <label class="option-toggle ${checked ? "selected" : ""}" for="${id}">
        <span class="option-toggle__label">${label}</span>
        <input type="checkbox" id="${id}" @change=${onChange} .checked=${checked} style="display:none" />
        <div class="option-toggle__switch"></div>
      </label>
    `;
  }

  render() {
    return html`
      <o-modal modal-title=${translateText("single_modal.title")}>
        <div class="options-layout">
          <!-- Map Selection -->
          <div class="options-section">
            <div class="option-title">${translateText("map.map")}</div>
            <div class="option-cards flex-col">
              ${Object.entries(mapCategories).map(
      ([categoryKey, maps]) => html`
                  <div class="w-full mb-4">
                    <h3 class="text-lg font-semibold mb-2 text-center text-gray-300">
                      ${translateText(`map_categories.${categoryKey}`)}
                    </h3>
                    <div class="flex flex-row flex-wrap justify-center gap-4">
                      ${maps.map((mapValue) => {
        const mapKey = Object.keys(GameMapType).find(
          (key) => GameMapType[key as keyof typeof GameMapType] === mapValue,
        );
        return html`
                          <div @click=${() => this.handleMapSelection(mapValue)}>
                            <map-display
                              .mapKey=${mapKey}
                              .selected=${!this.useRandomMap && this.selectedMap === mapValue}
                              .translation=${translateText(`map.${mapKey?.toLowerCase()}`)}
                            ></map-display>
                          </div>
                        `;
      })}
                    </div>
                  </div>
                `,
    )}
              <div class="option-card random-map ${this.useRandomMap ? "selected" : ""}" @click=${this.handleRandomMapToggle}>
                <div class="option-image">
                  <img src=${randomMap} alt="Random Map" style="width:100%; aspect-ratio: 4/2; object-fit:cover; border-radius:8px;" />
                </div>
                <div class="option-card-title">${translateText("map.random")}</div>
              </div>
            </div>
          </div>

          <!-- Difficulty Selection -->
          <div class="options-section">
            <div class="option-title">${translateText("difficulty.difficulty")}</div>
            <div class="option-cards">
              ${Object.entries(Difficulty)
        .filter(([key]) => isNaN(Number(key)))
        .map(
          ([key, value]) => html`
                    <div class="option-card ${this.selectedDifficulty === value ? "selected" : ""}" @click=${() => this.handleDifficultySelection(value)}>
                      <difficulty-display .difficultyKey=${key}></difficulty-display>
                      <p class="option-card-title">${translateText(`difficulty.${key}`)}</p>
                    </div>
                  `,
        )}
            </div>
          </div>

          <!-- Game Mode Selection -->
          <div class="options-section">
            <div class="option-title">${translateText("host_modal.mode")}</div>
            <div class="option-cards">
              <div class="option-card ${this.gameMode === GameMode.FFA ? "selected" : ""}" @click=${() => this.handleGameModeSelection(GameMode.FFA)}>
                <div class="option-card-title">${translateText("game_mode.ffa")}</div>
              </div>
              <div class="option-card ${this.gameMode === GameMode.Team ? "selected" : ""}" @click=${() => this.handleGameModeSelection(GameMode.Team)}>
                <div class="option-card-title">${translateText("game_mode.teams")}</div>
              </div>
            </div>
          </div>

          ${this.gameMode === GameMode.FFA
        ? ""
        : html`
                <div class="options-section">
                  <div class="option-title">${translateText("host_modal.team_count")}</div>
                  
                <div class="team-selector">
                    <!-- Fixed Team Count -->
                    <div class="team-selector__group">
                      <div class="team-selector__group-label">Fixed Teams</div>
                      <div class="team-selector__row">
                        ${[2, 3, 4, 5, 6, 7].map(
          (num) => html`
                            <button 
                              class="team-chip ${this.teamCount === num ? "selected" : ""}" 
                              @click=${() => this.handleTeamCountSelection(num)}
                            >
                              ${num}
                            </button>
                          `,
        )}
                      </div>
                    </div>

                    <div class="team-selector__divider"></div>

                    <!-- Per-Player Modes -->
                    <div class="team-selector__group">
                      <div class="team-selector__group-label">Per Player</div>
                      <div class="team-selector__row">
                        <button 
                          class="team-chip team-chip--mode ${this.teamCount === Duos ? "selected" : ""}" 
                          @click=${() => this.handleTeamCountSelection(Duos)}
                        >
                          <span class="team-chip__num">2s</span>
                          <span class="team-chip__label">Duos</span>
                        </button>
                        <button 
                          class="team-chip team-chip--mode ${this.teamCount === Trios ? "selected" : ""}" 
                          @click=${() => this.handleTeamCountSelection(Trios)}
                        >
                          <span class="team-chip__num">3s</span>
                          <span class="team-chip__label">Trios</span>
                        </button>
                        <button 
                          class="team-chip team-chip--mode ${this.teamCount === Quads ? "selected" : ""}" 
                          @click=${() => this.handleTeamCountSelection(Quads)}
                        >
                          <span class="team-chip__num">4s</span>
                          <span class="team-chip__label">Quads</span>
                        </button>
                      </div>
                    </div>

                    <div class="team-selector__divider"></div>

                    <!-- Special Mode -->
                    <button 
                      class="team-special ${this.teamCount === HumansVsNations ? "selected" : ""}" 
                      @click=${() => this.handleTeamCountSelection(HumansVsNations)}
                    >
                      <span class="team-special__icon">🛡️</span>
                      <div class="team-special__text">
                        <span class="team-special__title">Humans vs AI</span>
                        <span class="team-special__subtitle">All players team up</span>
                      </div>
                    </button>
                  </div>
                </div>
              `}

          <!-- Game Options -->
          <div class="options-section">
            <div class="option-title">${translateText("single_modal.options_title")}</div>
            
            <div class="option-slider-row">
              <label for="bots-count">
                <span>${translateText("single_modal.bots")}</span>
                <span class="option-slider-value">${this.bots === 0 ? translateText("single_modal.bots_disabled") : this.bots}</span>
              </label>
              <input 
                type="range" 
                id="bots-count" 
                class="custom-slider"
                min="0" 
                max="400" 
                step="1" 
                @input=${this.handleBotsChange} 
                @change=${this.handleBotsChange} 
                .value="${String(this.bots)}" 
                style="--progress: ${(this.bots / 400) * 100}%"
              />
            </div>

            <div class="options-toggle-grid">
              ${!(this.gameMode === GameMode.Team && this.teamCount === HumansVsNations)
        ? this.renderToggle("singleplayer-modal-disable-nations", this.disableNations, translateText("single_modal.disable_nations"), this.handleDisableNationsChange)
        : ""}
              ${this.renderToggle("singleplayer-modal-instant-build", this.instantBuild, translateText("single_modal.instant_build"), this.handleInstantBuildChange)}
              ${this.renderToggle("singleplayer-modal-random-spawn", this.randomSpawn, translateText("single_modal.random_spawn"), this.handleRandomSpawnChange)}
              ${this.renderToggle("singleplayer-modal-infinite-gold", this.infiniteGold, translateText("single_modal.infinite_gold"), this.handleInfiniteGoldChange)}
              ${this.renderToggle("singleplayer-modal-infinite-troops", this.infiniteTroops, translateText("single_modal.infinite_troops"), this.handleInfiniteTroopsChange)}
              ${this.renderToggle("singleplayer-modal-free-nukes", this.freeNukes, translateText("single_modal.free_nukes"), this.handleFreeNukesChange)}
              ${this.renderToggle("singleplayer-modal-permanent-allies", this.permanentAllies, translateText("single_modal.permanent_allies"), this.handlePermanentAlliesChange)}
              ${this.renderToggle("singleplayer-modal-compact-map", this.compactMap, translateText("single_modal.compact_map"), this.handleCompactMapChange)}
              
              <label class="option-toggle ${this.maxTimer ? "selected" : ""}" for="max-timer">
                <span class="option-toggle__label">${translateText("single_modal.max_timer")}</span>
                <input type="checkbox" id="max-timer" @change=${(e: Event) => {
        const checked = (e.target as HTMLInputElement).checked;
        if (!checked) this.maxTimerValue = undefined;
        this.maxTimer = checked;
      }} .checked=${this.maxTimer} style="display:none" />
                <div class="flex items-center gap-2">
                  ${this.maxTimer ? html`
                    <input type="number" id="end-timer-value" min="0" max="120" .value=${String(this.maxTimerValue ?? "")} 
                      style="width: 45px; background: rgba(0,0,0,0.6); color: white; text-align: right; border-radius: 4px; font-size: 12px; padding: 2px 4px; border: 1px solid rgba(255,255,255,0.2);"
                      @input=${this.handleMaxTimerValueChanges} @keydown=${this.handleMaxTimerValueKeyDown} />
                  ` : ""}
                  <div class="option-toggle__switch"></div>
                </div>
              </label>
            </div>
          </div>

          <!-- Unit Toggles Section -->
          <div class="options-section options-section--units">
            <div class="option-title">${translateText("single_modal.enables_title")}</div>
            <div class="unit-toggles-grid">
              ${renderUnitTypeOptions({
        disabledUnits: this.disabledUnits,
        toggleUnit: this.toggleUnit.bind(this),
      })}
            </div>
          </div>
        </div>

        <o-button
          title=${translateText("single_modal.start")}
          @click=${this.startGame}
          blockDesktop
        ></o-button>
      </o-modal>
    `;
  }

  createRenderRoot() {
    return this;
  }

  public open() {
    this.modalEl?.open();
    this.useRandomMap = false;
  }

  public close() {
    this.modalEl?.close();
  }

  private handleRandomMapToggle() {
    this.useRandomMap = true;
  }

  private handleMapSelection(value: GameMapType) {
    this.selectedMap = value;
    this.useRandomMap = false;
  }

  private handleDifficultySelection(value: Difficulty) {
    this.selectedDifficulty = value;
  }

  private handleBotsChange(e: Event) {
    const value = parseInt((e.target as HTMLInputElement).value);
    if (isNaN(value) || value < 0 || value > 400) {
      return;
    }
    this.bots = value;
  }

  private handleInstantBuildChange(e: Event) {
    this.instantBuild = Boolean((e.target as HTMLInputElement).checked);
  }

  private handleRandomSpawnChange(e: Event) {
    this.randomSpawn = Boolean((e.target as HTMLInputElement).checked);
  }

  private handleInfiniteGoldChange(e: Event) {
    this.infiniteGold = Boolean((e.target as HTMLInputElement).checked);
  }

  private handleInfiniteTroopsChange(e: Event) {
    this.infiniteTroops = Boolean((e.target as HTMLInputElement).checked);
  }

  private handleFreeNukesChange(e: Event) {
    this.freeNukes = Boolean((e.target as HTMLInputElement).checked);
  }

  private handlePermanentAlliesChange(e: Event) {
    this.permanentAllies = Boolean((e.target as HTMLInputElement).checked);
  }

  private handleCompactMapChange(e: Event) {
    this.compactMap = Boolean((e.target as HTMLInputElement).checked);
  }

  private handleMaxTimerValueKeyDown(e: KeyboardEvent) {
    if (["-", "+", "e"].includes(e.key)) {
      e.preventDefault();
    }
  }

  private handleMaxTimerValueChanges(e: Event) {
    (e.target as HTMLInputElement).value = (
      e.target as HTMLInputElement
    ).value.replace(/[e+-]/gi, "");
    const value = parseInt((e.target as HTMLInputElement).value);

    if (isNaN(value) || value < 0 || value > 120) {
      return;
    }
    this.maxTimerValue = value;
  }

  private handleDisableNationsChange(e: Event) {
    this.disableNations = Boolean((e.target as HTMLInputElement).checked);
  }

  private handleGameModeSelection(value: GameMode) {
    this.gameMode = value;
  }

  private handleTeamCountSelection(value: TeamCountConfig) {
    this.teamCount = value;
  }

  private getRandomMap(): GameMapType {
    const maps = Object.values(GameMapType);
    const randIdx = Math.floor(Math.random() * maps.length);
    return maps[randIdx] as GameMapType;
  }

  private toggleUnit(unit: UnitType, checked: boolean): void {
    console.log(`Toggling unit type: ${unit} to ${checked}`);
    this.disabledUnits = checked
      ? [...this.disabledUnits, unit]
      : this.disabledUnits.filter((u) => u !== unit);
  }

  private async startGame() {
    // If random map is selected, choose a random map now
    if (this.useRandomMap) {
      this.selectedMap = this.getRandomMap();
    }

    console.log(
      `Starting single player game with map: ${GameMapType[this.selectedMap as keyof typeof GameMapType]}${this.useRandomMap ? " (Randomly selected)" : ""}`,
    );
    const clientID = generateID();
    const gameID = generateID();

    const usernameInput = document.querySelector(
      "username-input",
    ) as UsernameInput;
    if (!usernameInput) {
      console.warn("Username input element not found");
    }

    const flagInput = document.querySelector("flag-input") as FlagInput;
    if (!flagInput) {
      console.warn("Flag input element not found");
    }
    const cosmetics = await fetchCosmetics();
    let selectedPattern = this.userSettings.getSelectedPatternName(cosmetics);
    selectedPattern ??= cosmetics
      ? (this.userSettings.getDevOnlyPattern() ?? null)
      : null;

    const selectedColor = this.userSettings.getSelectedColor();

    this.dispatchEvent(
      new CustomEvent("join-lobby", {
        detail: {
          clientID: clientID,
          gameID: gameID,
          gameStartInfo: {
            gameID: gameID,
            players: [
              {
                clientID,
                username: usernameInput.getCurrentUsername(),
                cosmetics: {
                  flag:
                    flagInput.getCurrentFlag() === "xx"
                      ? ""
                      : flagInput.getCurrentFlag(),
                  pattern: selectedPattern ?? undefined,
                  color: selectedColor ? { color: selectedColor } : undefined,
                },
              },
            ],
            config: {
              gameMap: this.selectedMap,
              gameMapSize: this.compactMap
                ? GameMapSize.Compact
                : GameMapSize.Normal,
              gameType: GameType.Singleplayer,
              gameMode: this.gameMode,
              playerTeams: this.teamCount,
              difficulty: this.selectedDifficulty,
              maxTimerValue: this.maxTimer ? this.maxTimerValue : undefined,
              bots: this.bots,
              infiniteGold: this.infiniteGold,
              donateGold: true,
              donateTroops: true,
              infiniteTroops: this.infiniteTroops,
              instantBuild: this.instantBuild,
              randomSpawn: this.randomSpawn,
              freeNukes: this.freeNukes,
              permanentAllies: this.permanentAllies,
              disabledUnits: this.disabledUnits
                .map((u) => Object.values(UnitType).find((ut) => ut === u))
                .filter((ut): ut is UnitType => ut !== undefined),
              ...(this.gameMode === GameMode.Team &&
                this.teamCount === HumansVsNations
                ? {
                  disableNations: false,
                }
                : {
                  disableNations: this.disableNations,
                }),
            },
            lobbyCreatedAt: Date.now(), // ms; server should be authoritative in MP
          },
        } satisfies JoinLobbyEvent,
        bubbles: true,
        composed: true,
      }),
    );
    this.close();
  }
}
