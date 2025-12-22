import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { translateText } from "../../Utils";

/**
 * A reusable confirm modal component that replaces browser confirm() dialogs.
 * Usage:
 *   const modal = document.querySelector('confirm-modal') as ConfirmModal;
 *   const confirmed = await modal.show('Are you sure?', 'Confirm', 'Cancel');
 */
@customElement("confirm-modal")
export class ConfirmModal extends LitElement {
  @state() private isOpen = false;
  @state() private message = "";
  @state() private confirmText = "Confirm";
  @state() private cancelText = "Cancel";

  private resolvePromise: ((value: boolean) => void) | null = null;

  static styles = css`
    .modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background-color: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .modal-container {
      background: linear-gradient(145deg, rgba(28, 28, 35, 0.9) 0%, rgba(18, 18, 22, 0.95) 100%);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      box-shadow: 
        0 30px 60px -12px rgba(0, 0, 0, 0.6),
        0 18px 36px -18px rgba(0, 0, 0, 0.5),
        inset 0 1px 1px rgba(255, 255, 255, 0.05);
      width: 90%;
      max-width: 400px;
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .modal-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .modal-title {
      margin: 0;
      font-size: 0.75rem;
      font-weight: 800;
      color: rgba(255, 255, 255, 0.4);
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .modal-body {
      color: #fff;
      font-size: 1.15rem;
      font-weight: 500;
      line-height: 1.4;
      padding: 8px 0;
    }

    .modal-footer {
      display: flex;
      gap: 12px;
      margin-top: 8px;
    }

    .btn {
      flex: 1;
      padding: 14px;
      border: none;
      border-radius: 14px;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .btn-cancel {
      background: rgba(255, 255, 255, 0.05);
      color: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .btn-cancel:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      border-color: rgba(255, 255, 255, 0.2);
    }

    .btn-confirm {
      background: #ef4444;
      color: #fff;
      box-shadow: 0 8px 20px -6px rgba(239, 68, 68, 0.5);
    }

    .btn-confirm:hover {
      background: #f87171;
      box-shadow: 0 12px 24px -6px rgba(239, 68, 68, 0.6);
      transform: translateY(-2px);
    }

    .btn-confirm:active {
      transform: translateY(0);
    }
  `;

  public show(
    message: string,
    confirmText?: string,
    cancelText?: string,
  ): Promise<boolean> {
    this.message = message;
    this.confirmText = confirmText ?? translateText("confirm") ?? "Confirm";
    this.cancelText = cancelText ?? translateText("cancel") ?? "Cancel";
    this.isOpen = true;

    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  private handleConfirm() {
    this.isOpen = false;
    this.resolvePromise?.(true);
    this.resolvePromise = null;
  }

  private handleCancel() {
    this.isOpen = false;
    this.resolvePromise?.(false);
    this.resolvePromise = null;
  }

  private handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      this.handleCancel();
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.isOpen) return;
    if (e.key === "Escape") {
      this.handleCancel();
    } else if (e.key === "Enter") {
      this.handleConfirm();
    }
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this.handleKeyDown);
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this.handleKeyDown);
    super.disconnectedCallback();
  }

  render() {
    if (!this.isOpen) return html``;

    return html`
      <div class="modal-overlay" @click=${this.handleOverlayClick}>
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="modal-title">${translateText("confirm") ?? "Confirm"}</h3>
          </div>
          <div class="modal-body">${this.message}</div>
          <div class="modal-footer">
            <button class="btn btn-cancel" @click=${this.handleCancel}>
              ${this.cancelText}
            </button>
            <button class="btn btn-confirm" @click=${this.handleConfirm}>
              ${this.confirmText}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
