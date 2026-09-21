/**
 * Browser Desktop Notifications Helper
 * Provides native OS notifications (Windows / macOS / Android) when tab is active, minimized, or in background.
 */

export function isDesktopNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getDesktopNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isDesktopNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestDesktopNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isDesktopNotificationSupported()) return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn("[DesktopNotification] Permission request failed:", err);
    return "denied";
  }
}

export interface DesktopNotificationOptions {
  title: string;
  body: string;
  tag?: string;
  icon?: string;
  badge?: string;
  onClick?: () => void;
}

export function playNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // AudioContext autoplay policy or not supported
  }
}

export function showDesktopNotification(options: DesktopNotificationOptions): Notification | null {
  if (!isDesktopNotificationSupported()) return null;
  if (Notification.permission !== "granted") return null;

  try {
    playNotificationSound();
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || "/ilsi-logo.png",
      badge: options.badge || "/favicon.png",
      tag: options.tag,
    });

    notification.onclick = (e) => {
      e.preventDefault();
      window.focus();
      if (options.onClick) {
        options.onClick();
      }
      notification.close();
    };

    return notification;
  } catch (err) {
    console.warn("[DesktopNotification] Could not display notification:", err);
    return null;
  }
}

