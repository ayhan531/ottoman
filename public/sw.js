/**
 * Ottoman servis çalışanı.
 * Tek işi cihaz bildirimi: gelen push'ta son bildirimi sunucudan okur ve gösterir.
 * Sayfa/dosya önbelleğe ALINMAZ - istekler doğrudan ağa gider, böylece kullanıcı
 * her zaman güncel sürümü görür.
 */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Önbellek yok; kurulabilirlik için ağa doğrudan aktarım.
self.addEventListener("fetch", (event) => {
  return;
});

const APP_URL = "/?uygulama=1";

const sonBildirim = async () => {
  try {
    const res = await fetch("/api/notifications", { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const items = Array.isArray(data) ? data : data.items || data.notifications || [];
    return items[0] || null;
  } catch {
    return null;
  }
};

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let baslik = "Ottoman Yatırım";
    let govde = "Yeni bir bildiriminiz var.";
    let etiket = "ottoman";

    try {
      const payload = event.data ? event.data.json() : null;
      if (payload && payload.title) {
        baslik = payload.title;
        govde = payload.body || govde;
        etiket = payload.tag || etiket;
      } else {
        const item = await sonBildirim();
        if (item) {
          baslik = item.title || baslik;
          govde = item.body || govde;
          etiket = `ottoman-${item.id || ""}`;
        }
      }
    } catch { /* varsayılan metinle göster */ }

    await self.registration.showNotification(baslik, {
      body: govde,
      tag: etiket,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: APP_URL },
      renotify: false,
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const hedef = event.notification.data?.url || APP_URL;
  event.waitUntil((async () => {
    const pencereler = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const pencere of pencereler) {
      if (pencere.url.includes(self.location.origin)) {
        await pencere.focus();
        if ("navigate" in pencere) await pencere.navigate(hedef).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(hedef);
  })());
});
