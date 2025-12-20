import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { translateText } from "../../Utils";

@customElement("o-modal")
export class OModal extends LitElement {
  @state() public isModalOpen = false;
  @property({ type: String, attribute: "modal-title" }) modalTitle = "";
  @property({ type: String }) translationKey = "";
  @property({ type: Boolean }) alwaysMaximized = false;

  static styles = css`
    .c-modal {
      position: fixed;
      padding: 1rem;
      z-index: 9999;
      left: 0;
      bottom: 0;
      right: 0;
      top: 0;
      background-color: rgba(0, 0, 0, 0.5);
      overflow-y: auto;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .c-modal__wrapper {
      border-radius: 12px;
      min-width: 340px;
      max-width: 900px;
      background: rgba(15, 15, 20, 0.4);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }

    .c-modal__wrapper.always-maximized {
      width: 100%;
      min-width: 340px;
      max-width: 900px;
      min-height: 320px;
      /* Fallback for older browsers */
      height: 60vh;
      /* Use dvh if supported for dynamic viewport handling */
      height: 60dvh;
    }

    .c-modal__header {
      position: relative;
      border-radius: 12px 12px 0 0;
      font-size: 16px;
      font-weight: 600;
      background: rgba(0, 0, 0, 0.4);
      text-align: center;
      color: #fff;
      padding: 1rem 2.4rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .c-modal__close {
      cursor: pointer;
      position: absolute;
      right: 1rem;
      top: 1rem;
    }

    .c-modal__content {
      background: #23232382;
      position: relative;
      color: #fff;
      padding: 1.4rem;
      max-height: 60dvh;
      overflow-y: auto;
      backdrop-filter: blur(8px);
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
    }

    .c-modal__content::-webkit-scrollbar {
      width: 8px;
    }

    .c-modal__content::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 4px;
    }

    .c-modal__content::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.25);
      border-radius: 4px;
    }

    .c-modal__content::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.4);
    }
  `;

  public open() {
    this.isModalOpen = true;
  }
  public close() {
    this.isModalOpen = false;
    this.dispatchEvent(
      new CustomEvent("modal-close", { bubbles: true, composed: true }),
    );
  }

  render() {
    return html`
      ${this.isModalOpen
        ? html`
            <aside class="c-modal" @click=${this.close}>
              <div
                @click=${(e: Event) => e.stopPropagation()}
                class="c-modal__wrapper ${this.alwaysMaximized
            ? "always-maximized"
            : ""}"
              >
                <header class="c-modal__header">
                  ${`${this.translationKey}` === ""
            ? `${this.modalTitle}`
            : `${translateText(this.translationKey)}`}
                  <div class="c-modal__close" @click=${this.close}>✕</div>
                </header>
                <section class="c-modal__content">
                  <slot></slot>
                </section>
              </div>
            </aside>
          `
        : html``}
    `;
  }
}
