import version from "../../resources/version.txt";
import { EventBus } from "../core/EventBus";
import { GameRecord, GameStartInfo, ID } from "../core/Schemas";
import { GameEnv } from "../core/configuration/Config";
import { getServerConfigFromClient } from "../core/configuration/ConfigLoader";
import { GameType } from "../core/game/Game";
import { UserSettings } from "../core/game/UserSettings";
import { joinLobby } from "./ClientGameRunner";

import "./FlagInput";
import { FlagInput } from "./FlagInput";
import { FlagInputModal } from "./FlagInputModal";
import { GameInfoModal } from "./GameInfoModal";
import { GameStartingModal } from "./GameStartingModal";
import "./GoogleAdElement";
import { GutterAds } from "./GutterAds";
import { HelpModal } from "./HelpModal";
import { HostLobbyModal as HostPrivateLobbyModal } from "./HostLobbyModal";
import { JoinPrivateLobbyModal } from "./JoinPrivateLobbyModal";
import "./LangSelector";
import { LangSelector } from "./LangSelector";
import { LanguageModal } from "./LanguageModal";
import "./NewsModal";
import { SinglePlayerModal } from "./SinglePlayerModal";
import {
  SendKickPlayerIntentEvent,
  SendResetTeamAssignmentsIntentEvent,
  SendSwapTeamIntentEvent,
} from "./Transport";
import { UserSettingModal } from "./UserSettingModal";
import "./UsernameInput";
import { UsernameInput } from "./UsernameInput";
import { incrementGamesPlayed } from "./Utils";
import "./components/baseComponents/Button";
import "./components/baseComponents/Modal";
import "./styles.css";

declare global {
  interface Window {
    turnstile: any;
    enableAds: boolean;
    PageOS: {
      session: {
        newPageView: () => void;
      };
    };
    fusetag: {
      registerZone: (id: string) => void;
      destroyZone: (id: string) => void;
      pageInit: (options?: any) => void;
      que: Array<() => void>;
      destroySticky: () => void;
    };
    ramp: {
      que: Array<() => void>;
      passiveMode: boolean;
      spaAddAds: (ads: Array<{ type: string; selectorId: string }>) => void;
      destroyUnits: (adType: string) => void;
      settings?: {
        slots?: any;
      };
      spaNewPage: (url: string) => void;
    };
  }

  // Extend the global interfaces to include your custom events
  interface DocumentEventMap {
    "join-lobby": CustomEvent<JoinLobbyEvent>;
    "kick-player": CustomEvent;
    "swap-team": CustomEvent;
    "reset-team-assignments": CustomEvent;
  }
}

export interface JoinLobbyEvent {
  clientID: string;
  // Multiplayer games only have gameID, gameConfig is not known until game starts.
  gameID: string;
  // GameConfig only exists when playing a singleplayer game.
  gameStartInfo?: GameStartInfo;
  // GameRecord exists when replaying an archived game.
  gameRecord?: GameRecord;
}

class Client {
  private gameStop: (() => void) | null = null;
  private eventBus: EventBus = new EventBus();

  private usernameInput: UsernameInput | null = null;
  private flagInput: FlagInput | null = null;

  private joinModal: JoinPrivateLobbyModal;
  private userSettings: UserSettings = new UserSettings();

  private gutterAds: GutterAds | null = null;

  private turnstileTokenPromise: Promise<{
    token: string;
    createdAt: number;
  }> | null = null;

  constructor() {}

  async initialize(): Promise<void> {
    // Prefetch turnstile token so it is available when
    // the user joins a lobby.
    this.turnstileTokenPromise = getTurnstileToken();

    const gameVersion = document.getElementById(
      "game-version",
    ) as HTMLDivElement;
    if (!gameVersion) {
      console.warn("Game version element not found");
    }
    gameVersion.innerText = version;

    const langSelector = document.querySelector(
      "lang-selector",
    ) as LangSelector;
    const languageModal = document.querySelector(
      "language-modal",
    ) as LanguageModal;
    if (!langSelector) {
      console.warn("Lang selector element not found");
    }
    if (!languageModal) {
      console.warn("Language modal element not found");
    }

    this.flagInput = document.querySelector("flag-input") as FlagInput;
    if (!this.flagInput) {
      console.warn("Flag input element not found");
    }

    this.usernameInput = document.querySelector(
      "username-input",
    ) as UsernameInput;
    if (!this.usernameInput) {
      console.warn("Username input element not found");
    }

    window.addEventListener("beforeunload", () => {
      console.log("Browser is closing");
      if (this.gameStop !== null) {
        this.gameStop();
      }
    });

    const gutterAds = document.querySelector("gutter-ads");
    if (gutterAds instanceof GutterAds) {
      this.gutterAds = gutterAds;
    }

    document.addEventListener("join-lobby", this.handleJoinLobby.bind(this));
    document.addEventListener("leave-lobby", this.handleLeaveLobby.bind(this));
    document.addEventListener("kick-player", this.handleKickPlayer.bind(this));
    document.addEventListener("swap-team", this.handleSwapTeam.bind(this));
    document.addEventListener(
      "reset-team-assignments",
      this.handleResetTeamAssignments.bind(this),
    );

    const spModal = document.querySelector(
      "single-player-modal",
    ) as SinglePlayerModal;
    if (!spModal || !(spModal instanceof SinglePlayerModal)) {
      console.warn("Singleplayer modal element not found");
    }

    const singlePlayer = document.getElementById("single-player");
    if (singlePlayer === null) throw new Error("Missing single-player");
    singlePlayer.addEventListener("click", () => {
      if (this.usernameInput?.isValid()) {
        spModal.open();
      }
    });

    const hlpModal = document.querySelector("help-modal") as HelpModal;
    if (!hlpModal || !(hlpModal instanceof HelpModal)) {
      console.warn("Help modal element not found");
    }
    const giModal = document.querySelector("game-info-modal") as GameInfoModal;
    if (!giModal || !(giModal instanceof GameInfoModal)) {
      console.warn("Game info modal element not found");
    }
    const helpButton = document.getElementById("help-button");
    if (helpButton === null) throw new Error("Missing help-button");
    helpButton.addEventListener("click", () => {
      hlpModal.open();
    });

    const flagInputModal = document.querySelector(
      "flag-input-modal",
    ) as FlagInputModal;
    if (!flagInputModal || !(flagInputModal instanceof FlagInputModal)) {
      console.warn("Flag input modal element not found");
    }

    const flgInput = document.getElementById("flag-input_");
    if (flgInput === null) throw new Error("Missing flag-input_");
    flgInput.addEventListener("click", () => {
      flagInputModal.open();
    });

    const settingsModal = document.querySelector(
      "user-setting",
    ) as UserSettingModal;
    if (!settingsModal || !(settingsModal instanceof UserSettingModal)) {
      console.warn("User settings modal element not found");
    }
    document
      .getElementById("settings-button")
      ?.addEventListener("click", () => {
        settingsModal.open();
      });

    const hostModal = document.querySelector(
      "host-lobby-modal",
    ) as HostPrivateLobbyModal;
    if (!hostModal || !(hostModal instanceof HostPrivateLobbyModal)) {
      console.warn("Host private lobby modal element not found");
    }
    const hostLobbyButton = document.getElementById("host-lobby-button");
    if (hostLobbyButton === null) throw new Error("Missing host-lobby-button");
    hostLobbyButton.addEventListener("click", () => {
      if (this.usernameInput?.isValid()) {
        hostModal.open();
      }
    });

    this.joinModal = document.querySelector(
      "join-private-lobby-modal",
    ) as JoinPrivateLobbyModal;
    if (!this.joinModal || !(this.joinModal instanceof JoinPrivateLobbyModal)) {
      console.warn("Join private lobby modal element not found");
    }
    const joinPrivateLobbyButton = document.getElementById(
      "join-private-lobby-button",
    );
    if (joinPrivateLobbyButton === null)
      throw new Error("Missing join-private-lobby-button");
    joinPrivateLobbyButton.addEventListener("click", () => {
      if (this.usernameInput?.isValid()) {
        this.joinModal.open();
      }
    });

    if (this.userSettings.darkMode()) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Attempt to join lobby
    this.handleHash();

    const onHashUpdate = () => {
      // Reset the UI to its initial state
      this.joinModal.close();
      if (this.gameStop !== null) {
        this.handleLeaveLobby();
      }

      // Attempt to join lobby
      this.handleHash();
    };

    // Handle browser navigation & manual hash edits
    window.addEventListener("popstate", onHashUpdate);
    window.addEventListener("hashchange", onHashUpdate);

    function updateSliderProgress(slider: HTMLInputElement) {
      const percent =
        ((Number(slider.value) - Number(slider.min)) /
          (Number(slider.max) - Number(slider.min))) *
        100;
      slider.style.setProperty("--progress", `${percent}%`);
    }

    document
      .querySelectorAll<HTMLInputElement>(
        "#bots-count, #private-lobby-bots-count",
      )
      .forEach((slider) => {
        updateSliderProgress(slider);
        slider.addEventListener("input", () => updateSliderProgress(slider));
      });

    this.initializeFuseTag();
  }

  private handleHash() {
    const strip = () =>
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );

    const alertAndStrip = (message: string) => {
      alert(message);
      strip();
    };

    const hash = window.location.hash;

    // Decode the hash first to handle encoded characters
    const decodedHash = decodeURIComponent(hash);

    if (decodedHash.startsWith("#join=")) {
      const lobbyId = decodedHash.substring(6); // Remove "#join="
      if (lobbyId && ID.safeParse(lobbyId).success) {
        this.joinModal.open(lobbyId);
        console.log(`joining lobby ${lobbyId}`);
      }
    }
    if (decodedHash.startsWith("#refresh")) {
      window.location.href = "/";
    }
  }

  private async handleJoinLobby(event: CustomEvent<JoinLobbyEvent>) {
    const lobby = event.detail;
    console.log(`joining lobby ${lobby.gameID}`);
    if (this.gameStop !== null) {
      console.log("joining lobby, stopping existing game");
      this.gameStop();
    }
    const config = await getServerConfigFromClient();

    this.gameStop = joinLobby(
      this.eventBus,
      {
        gameID: lobby.gameID,
        serverConfig: config,
        cosmetics: {
          color: this.userSettings.getSelectedColor() ?? undefined,
          flag:
            this.flagInput === null || this.flagInput.getCurrentFlag() === "xx"
              ? ""
              : this.flagInput.getCurrentFlag(),
        },
        turnstileToken: await this.getTurnstileToken(lobby),
        playerName: this.usernameInput?.getCurrentUsername() ?? "",
        clientID: lobby.clientID,
        gameStartInfo: lobby.gameStartInfo ?? lobby.gameRecord?.info,
        gameRecord: lobby.gameRecord,
      },
      () => {
        console.log("Closing modals");
        document.getElementById("settings-button")?.classList.add("hidden");
        if (this.usernameInput) {
          // fix edge case where username-validation-error is re-rendered and hidden tag removed
          this.usernameInput.validationError = "";
        }
        document
          .getElementById("username-validation-error")
          ?.classList.add("hidden");
        [
          "single-player-modal",
          "host-lobby-modal",
          "join-private-lobby-modal",
          "game-starting-modal",
          "game-top-bar",
          "help-modal",
          "user-setting",
          "language-modal",
          "news-modal",
          "flag-input-modal",
        ].forEach((tag) => {
          const modal = document.querySelector(tag) as HTMLElement & {
            close?: () => void;
            isModalOpen?: boolean;
          };
          if (modal?.close) {
            modal.close();
          } else if (modal && "isModalOpen" in modal) {
            modal.isModalOpen = false;
          }
        });
        document.querySelectorAll(".ad").forEach((ad) => {
          (ad as HTMLElement).style.display = "none";
        });
        document.documentElement.classList.add("in-game");

        // show when the game loads
        const startingModal = document.querySelector(
          "game-starting-modal",
        ) as GameStartingModal;
        if (startingModal && startingModal instanceof GameStartingModal) {
          startingModal.show();
        }
        this.gutterAds?.hide();
      },
      () => {
        this.joinModal.close();
        incrementGamesPlayed();

        document.querySelectorAll(".ad").forEach((ad) => {
          (ad as HTMLElement).style.display = "none";
        });

        // Ensure there's a homepage entry in history before adding the lobby entry
        if (window.location.hash === "" || window.location.hash === "#") {
          history.replaceState(null, "", window.location.origin + "#refresh");
        }
        history.pushState(null, "", `#join=${lobby.gameID}`);
      },
    );
  }

  private async handleLeaveLobby(/* event: CustomEvent */) {
    if (this.gameStop === null) {
      return;
    }
    console.log("leaving lobby, cancelling game");
    this.gameStop();
    this.gameStop = null;
    this.gutterAds?.hide();
    document.documentElement.classList.remove("in-game");
  }

  private handleKickPlayer(event: CustomEvent) {
    const { target } = event.detail;

    // Forward to eventBus if available
    if (this.eventBus) {
      this.eventBus.emit(new SendKickPlayerIntentEvent(target));
    }
  }

  private handleSwapTeam(event: CustomEvent) {
    const { targetPlayer, targetTeam } = event.detail;

    // Forward to eventBus if available
    if (this.eventBus) {
      this.eventBus.emit(
        new SendSwapTeamIntentEvent(targetPlayer, targetTeam),
      );
    }
  }

  private handleResetTeamAssignments() {
    // Forward to eventBus if available
    if (this.eventBus) {
      this.eventBus.emit(new SendResetTeamAssignmentsIntentEvent());
    }
  }

  private initializeFuseTag() {
    const tryInitFuseTag = (): boolean => {
      if (window.fusetag && typeof window.fusetag.pageInit === "function") {
        console.log("initializing fuse tag");
        window.fusetag.que.push(() => {
          window.fusetag.pageInit({
            blockingFuseIds: ["lhs_sticky_vrec", "rhs_sticky_vrec"],
          });
        });
        return true;
      } else {
        return false;
      }
    };

    const interval = setInterval(() => {
      if (tryInitFuseTag()) {
        clearInterval(interval);
      }
    }, 100);
  }

  private async getTurnstileToken(
    lobby: JoinLobbyEvent,
  ): Promise<string | null> {
    const config = await getServerConfigFromClient();
    if (
      config.env() === GameEnv.Dev ||
      lobby.gameStartInfo?.config.gameType === GameType.Singleplayer
    ) {
      return null;
    }

    if (this.turnstileTokenPromise === null) {
      console.log("No prefetched turnstile token, getting new token");
      return (await getTurnstileToken())?.token ?? null;
    }

    const token = await this.turnstileTokenPromise;
    // Clear promise so a new token is fetched next time
    this.turnstileTokenPromise = null;
    if (!token) {
      console.log("No turnstile token");
      return null;
    }

    const tokenTTL = 3 * 60 * 1000;
    if (Date.now() < token.createdAt + tokenTTL) {
      console.log("Prefetched turnstile token is valid");
      return token.token;
    } else {
      console.log("Turnstile token expired, getting new token");
      return (await getTurnstileToken())?.token ?? null;
    }
  }
}

// Initialize the client when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new Client().initialize();
});
async function getTurnstileToken(): Promise<{
  token: string;
  createdAt: number;
}> {
  // Wait for Turnstile script to load (handles slow connections)
  let attempts = 0;
  while (typeof window.turnstile === "undefined" && attempts < 100) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    attempts++;
  }

  if (typeof window.turnstile === "undefined") {
    throw new Error("Failed to load Turnstile script");
  }

  const config = await getServerConfigFromClient();
  const widgetId = window.turnstile.render("#turnstile-container", {
    sitekey: config.turnstileSiteKey(),
    size: "normal",
    appearance: "interaction-only",
    theme: "light",
  });

  return new Promise((resolve, reject) => {
    window.turnstile.execute(widgetId, {
      callback: (token: string) => {
        window.turnstile.remove(widgetId);
        console.log(`Turnstile token received: ${token}`);
        resolve({ token, createdAt: Date.now() });
      },
      "error-callback": (errorCode: string) => {
        window.turnstile.remove(widgetId);
        console.error(`Turnstile error: ${errorCode}`);
        alert(`Turnstile error: ${errorCode}. Please refresh and try again.`);
        reject(new Error(`Turnstile failed: ${errorCode}`));
      },
    });
  });
}
