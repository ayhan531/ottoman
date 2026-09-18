/**
 * Üst güvenli alan. iOS Safari araç çubuğunu toplayınca sayfa durum çubuğunun
 * altına girer ama env(safe-area-inset-top) 0 döner; o durumda başlık saatin
 * üstüne biner. Önce env() ölçülür, gelmezse iOS'ta durum çubuğu payı verilir.
 * Android tarayıcılar sayfayı zaten kendi çubuğunun altında açtığı için 0 kalır.
 */

const IOS_STATUS_BAR = 48;

const measureEnv = () => {
  try {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);pointer-events:none;visibility:hidden";
    document.body.appendChild(probe);
    const value = probe.getBoundingClientRect().height;
    probe.remove();
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

const isApplePhone = () => {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const iPhone = /iPhone|iPod/.test(ua) || /iPhone|iPod/.test(platform);
  // iPad, masaüstü kimliğiyle gelir; dokunmatik nokta sayısı ayırt eder.
  const iPad = /iPad/.test(ua) || (/Mac/.test(platform) && navigator.maxTouchPoints > 1);
  return iPhone || iPad;
};

/** Ölçüp <html> üzerine --safe-top yazar; ekran döndükçe tazelenir. */
export function trackSafeArea() {
  const apply = () => {
    const fromEnv = measureEnv();
    const top = fromEnv > 0 ? fromEnv : (isApplePhone() ? IOS_STATUS_BAR : 0);
    document.documentElement.style.setProperty("--safe-top", `${Math.round(top)}px`);
  };
  apply();
  window.addEventListener("orientationchange", apply);
  window.addEventListener("resize", apply);
  return () => {
    window.removeEventListener("orientationchange", apply);
    window.removeEventListener("resize", apply);
  };
}
