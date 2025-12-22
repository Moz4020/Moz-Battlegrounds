import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { translateText } from "../../Utils";

export type AlertType = "error" | "warning" | "info" | "success";

/**
 * A reusable alert modal component that replaces browser alert() dialogs.
 * Usage:
 *   const modal = document.querySelector('alert-modal') as AlertModal;
 *   await modal.show('Something went wrong!', 'error');
 */
@customElement("alert-modal")
export class AlertModal extends LitElement {
  @state() private isOpen = false;
  @state() private message = "";
  @state() private alertType: AlertType = "error";
  @state() private buttonText = "OK";

  private resolvePromise: (() => void) | null = null;

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
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .icon-container {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 900;
    }

    .icon-container.error {
      background: rgba(239, 68, 68, 0.2);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.2);
    }

    .icon-container.warning {
      background: rgba(245, 158, 11, 0.2);
      color: #fcd34d;
      border: 1px solid rgba(245, 158, 11, 0.2);
    }

    .icon-container.info {
      background: rgba(59, 130, 246, 0.2);
      color: #93c5fd;
      border: 1px solid rgba(59, 130, 246, 0.2);
    }

    .icon-container.success {
      background: rgba(34, 197, 94, 0.2);
      color: #86efac;
      border: 1px solid rgba(34, 197, 94, 0.2);
    }

    .modal-body {
      color: #fff;
      font-size: 1.1rem;
      font-weight: 500;
      line-height: 1.5;
      padding: 4px 0;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
    }

    .btn {
      padding: 12px 32px;
      border: none;
      border-radius: 12px;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .btn-primary {
      background: #3b82f6;
      color: #fff;
      box-shadow: 0 8px 20px -6px rgba(59, 130, 246, 0.5);
    }

    .btn-primary:hover {
      background: #60a5fa;
      box-shadow: 0 12px 24px -6px rgba(59, 130, 246, 0.6);
      transform: translateY(-2px);
    }

    .btn-primary:active {
      transform: translateY(0);
    }
  `;

  private getTitle(): string {
    switch (this.alertType) {
      case "error":
        return translateText("error") ?? "Error";
      case "warning":
        return translateText("warning") ?? "Warning";
      case "info":
        return translateText("info") ?? "Info";
      case "success":
        return translateText("success") ?? "Success";
    }
  }

  private getIcon(): string {
    switch (this.alertType) {
      case "error":
        return "✕";
      case "warning":
        return "!";
      case "info":
        return "i";
      case "success":
        return "✓";
    }
  }

  public show(
    message: string,
    type: AlertType = "error",
    buttonText?: string,
  ): Promise<void> {
    this.message = message;
    this.alertType = type;
    this.buttonText = buttonText ?? "OK";
    this.isOpen = true;

    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  private handleDismiss() {
    this.isOpen = false;
    this.resolvePromise?.();
    this.resolvePromise = null;
  }

  private handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      this.handleDismiss();
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.isOpen) return;
    if (e.key === "Escape" || e.key === "Enter") {
      this.handleDismiss();
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
            <h3 class="modal-title">
              <span class="icon-container ${this.alertType}">${this.getIcon()}</span>
              ${this.getTitle()}
            </h3>
          </div>
          <div class="modal-body">${this.message}</div>
          <div class="modal-footer">
            <button class="btn btn-primary" @click=${this.handleDismiss}>
              ${this.buttonText}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Helper function to show an alert modal.
 */
export function showAlert(
  message: string,
  type: AlertType = "error",
): Promise<void> {
  const modal = document.querySelector("alert-modal") as AlertModal;
  if (modal) {
    return modal.show(message, type);
  }
  alert(message);
  return Promise.resolve();
}

/**
 * Helper function to show a confirm modal.
 */
export async function showConfirm(
  message: string,
  confirmText?: string,
  cancelText?: string,
): Promise<boolean> {
  const modal = document.querySelector("confirm-modal") as any;
  if (modal) {
    return modal.show(message, confirmText, cancelText);
  }
  return confirm(message);
}
