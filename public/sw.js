/**
 * Ottoman servis çalışanı.
 *  - Cihaz bildirimi (push) gösterir.
 *  - Çevrimdışıyken uygulamanın kendisi açılır: kabuk ve son API yanıtları
 *    önbellekten servis edilir, böylece tarayıcının "İnternete bağlı
 *    değilsiniz" sayfası yerine son bilinen veriyle ana sayfa gelir.
 *
 * Tazelik kuralı: sayfa ve API her zaman ÖNCE ağdan denenir; önbellek sadece
 * ağ yoksa devreye girer. Hash'li paketler değişmediği için önce önbellekten
 * verilir.
 */

const SURUM = "ottoman-v2";
const KABUK = `${SURUM}-kabuk`;
const VERI = `${SURUM}-veri`;
const APP_URL = "/?uygulama=1";

const ON_YUKLE = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/apple-touch-icon.png"];

// Çevrimdışıyken önbellekten verilebilecek GET uçları.
const VERI_UCLARI = [
  "/api/me", "/api/market", "/api/portfolio", "/api/orders",
  "/api/news", "/api/market-news", "/api/notifications",
  "/api/system-bank-accounts", "/api/portfolio/history",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const kutu = await caches.open(KABUK);
    await Promise.allSettled(ON_YUKLE.map((yol) => kutu.add(new Request(yol, { cache: "reload" }))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const adlar = await caches.keys();
    await Promise.all(adlar.filter((ad) => !ad.startsWith(SURUM)).map((ad) => caches.delete(ad)));
    await self.clients.claim();
  })());
});

// Çıkışta kullanıcıya ait önbellek temizlenir.
self.addEventListener("message", (event) => {
  if (event.data === "veriyi-temizle") event.waitUntil(caches.delete(VERI));
});

const agdanAl = async (istek, kutuAdi, zamanAsimi = 0) => {
  const yanit = zamanAsimi
    ? await Promise.race([
        fetch(istek),
        new Promise((_, red) => setTimeout(() => red(new Error("zaman aşımı")), zamanAsimi)),
      ])
    : await fetch(istek);
  if (yanit && yanit.ok && kutuAdi) {
    const kopya = yanit.clone();
    caches.open(kutuAdi).then((kutu) => kutu.put(istek, kopya)).catch(() => {});
  }
  return yanit;
};

self.addEventListener("fetch", (event) => {
  const istek = event.request;
  if (istek.method !== "GET") return;

  const url = new URL(istek.url);
  if (url.origin !== self.location.origin) return;

  // 1) Sayfa açılışı: önce ağ, olmazsa önbellekteki uygulama kabuğu.
  if (istek.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await agdanAl(istek, KABUK);
      } catch {
        const kutu = await caches.open(KABUK);
        return (await kutu.match("/"))
          || (await kutu.match(istek))
          || new Response("<!doctype html><meta charset=utf-8><title>Ottoman</title><p>Çevrimdışısınız.", {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
      }
    })());
    return;
  }

  // 2) Hash'li paketler: önce önbellek (içerikleri hiç değişmez).
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith((async () => {
      const kutu = await caches.open(KABUK);
      const hazir = await kutu.match(istek);
      if (hazir) return hazir;
      return agdanAl(istek, KABUK);
    })());
    return;
  }

  // 3) API: önce ağ, olmazsa son başarılı yanıt.
  if (url.pathname.startsWith("/api/")) {
    if (!VERI_UCLARI.some((yol) => url.pathname === yol || url.pathname.startsWith(`${yol}?`))) return;
    event.respondWith((async () => {
      try {
        return await agdanAl(istek, VERI, 8000);
      } catch {
        const kutu = await caches.open(VERI);
        const hazir = await kutu.match(istek, { ignoreSearch: false }) || await kutu.match(istek, { ignoreSearch: true });
        if (hazir) {
          const govde = await hazir.clone().text();
          return new Response(govde, {
            status: 200,
            headers: { "Content-Type": "application/json; charset=utf-8", "X-Ottoman-Cache": "1" },
          });
        }
        return new Response(JSON.stringify({ error: "Çevrimdışısınız", offline: true }), {
          status: 503, headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      }
    })());
    return;
  }

  // 4) Simge, yazı tipi vb.: önce önbellek, arkadan tazele.
  event.respondWith((async () => {
    const kutu = await caches.open(KABUK);
    const hazir = await kutu.match(istek);
    if (hazir) {
      agdanAl(istek, KABUK).catch(() => {});
      return hazir;
    }
    try {
      return await agdanAl(istek, KABUK);
    } catch {
      return new Response("", { status: 504 });
    }
  })());
});

/* ---------------- cihaz bildirimi ---------------- */

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
