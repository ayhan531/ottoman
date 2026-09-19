/**
 * Uygulama kurulumu ve cihaz bildirimleri.
 * - Android ve masaüstünde tarayıcı "beforeinstallprompt" verir; tek dokunuşla kurulur.
 * - iPhone/iPad'de tarayıcı kurulum izni vermez; Paylaş → "Ana Ekrana Ekle" gerekir.
 * - Cihaz bildirimi için Web Push kullanılır; iOS'ta yalnızca ana ekrana eklenmiş
 *   uygulamada çalışır (Apple'ın kuralı).
 */

import { api, readPref } from "./store.js";

let deferred = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => { try { fn(); } catch { /* yoksay */ } });

/** Ana ekrandan/uygulama penceresinden mi açıldı? */
export const isStandalone = () => {
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      window.matchMedia?.("(display-mode: fullscreen)").matches === true ||
      window.matchMedia?.("(display-mode: minimal-ui)").matches === true ||
      window.navigator.standalone === true ||
      new URLSearchParams(location.search).has("uygulama")
    );
  } catch {
    return false;
  }
};

/**
 * iOS'ta hangi tarayıcı? Ana ekrana ekleme ve bildirim yalnızca Safari'den
 * eklenen uygulamada çalışır; Chrome/Firefox kısayolu kendi tarayıcısında açılır.
 */
export const iosBrowser = () => {
  const ua = navigator.userAgent || "";
  if (/CriOS/.test(ua)) return "chrome";
  if (/FxiOS/.test(ua)) return "firefox";
  if (/EdgiOS/.test(ua)) return "edge";
  if (/OPiOS|OPT\//.test(ua)) return "opera";
  return "safari";
};

/** Safari'nin adres çubuğu altta mı? iOS 15+ varsayılanı alt çubuktur. */
export const iosToolbarAtBottom = () => {
  const surum = (navigator.userAgent.match(/OS (\d+)[_.]/) || [])[1];
  return !surum || Number(surum) >= 15;
};

export const isApple = () => {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  return /iPhone|iPad|iPod/.test(ua) || /iPhone|iPad|iPod/.test(platform) || (/Mac/.test(platform) && navigator.maxTouchPoints > 1);
};

/** Tarayıcının kurulum teklifini yakalar; sayfa açılırken bir kez çağrılır. */
export function trackInstall() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

export const canInstall = () => Boolean(deferred);

export const onInstallChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Kurulum penceresini açar. Dönen değer: "accepted" | "dismissed" | "yok". */
export async function promptInstall() {
  if (!deferred) return "yok";
  const event = deferred;
  deferred = null;
  emit();
  try {
    event.prompt();
    const choice = await event.userChoice;
    return choice?.outcome || "dismissed";
  } catch {
    return "dismissed";
  }
}

/* ---------------- servis çalışanı ve cihaz bildirimi ---------------- */

export async function registerWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

const decodeKey = (value) => {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
};

const encodeKey = (buffer) => {
  const bytes = new Uint8Array(buffer || []);
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Bildirim türü tercihleri; sunucu hangi bildirimde push atacağına buna bakar. */
const currentPrefs = () => ({
  price: readPref("notify-price", true) !== false,
  news: readPref("notify-news", true) !== false,
  trade: readPref("notify-trade", true) !== false,
  referral: readPref("notify-referral", false) !== false,
});

/** Bildirim tercihleri kaydedilince sunucudaki kopyayı tazeler. */
export async function syncPushPrefs() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await api("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: encodeKey(sub.getKey("p256dh")),
        auth: encodeKey(sub.getKey("auth")),
        agent: navigator.userAgent.slice(0, 180),
        prefs: currentPrefs(),
      }),
    });
  } catch { /* yoksay */ }
}

export const pushSupported = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Cihaz bildirimi açık mı? */
export async function pushState() {
  if (!pushSupported()) return "desteklenmiyor";
  if (isApple() && !isStandalone()) return "ana-ekran-gerekli";
  if (Notification.permission === "denied") return "engellendi";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub ? "acik" : "kapali";
  } catch {
    return "kapali";
  }
}

/**
 * İzin ister, aboneliği kurar ve sunucuya kaydeder.
 * Dönen değerler: "acik" | "engellendi" | "ana-ekran-gerekli" | "desteklenmiyor" | "hata".
 */
export async function enablePush() {
  if (!pushSupported()) return "desteklenmiyor";
  // Apple, cihaz bildirimine yalnızca ana ekrana eklenmiş uygulamada izin verir.
  if (isApple() && !isStandalone()) return "ana-ekran-gerekli";
  try {
    await registerWorker();
    const reg = await navigator.serviceWorker.ready;
    let permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission !== "granted") return "engellendi";

    const { key } = await api("/api/push/key");
    if (!key) return "hata";
    let sub = await reg.pushManager.getSubscription();
    if (sub && encodeKey(sub.options?.applicationServerKey) !== key) {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(key) });
    }
    await api("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: encodeKey(sub.getKey("p256dh")),
        auth: encodeKey(sub.getKey("auth")),
        agent: navigator.userAgent.slice(0, 180),
        prefs: currentPrefs(),
      }),
    });
    return "acik";
  } catch {
    return "hata";
  }
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api("/api/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch { /* yoksay */ }
  return "kapali";
}

/** Giriş yapıldıktan sonra, izin zaten verilmişse aboneliği sessizce tazeler. */
export async function refreshPush() {
  if (!pushSupported()) return;
  if (isApple() && !isStandalone()) return;
  if (Notification.permission !== "granted") return;
  await enablePush().catch(() => {});
}
