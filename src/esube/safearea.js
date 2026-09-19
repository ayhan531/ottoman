/**
 * Üst güvenli alan. Kabuk `position: fixed; inset: 0` olduğu ve sayfa
 * `viewport-fit=cover` ile açıldığı için düzen alanı durum çubuğunun altına
 * kadar uzar; gereken pay tam olarak env(safe-area-inset-top) kadardır.
 * Sabit bir iOS payı EKLENMEZ: çentiksiz cihazlarda ve Android'de env() 0
 * döner, oraya pay eklenirse başlığın üstünde boşluk kalır.
 */

const measureEnv = () => {
  try {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);pointer-events:none;visibility:hidden";
    document.body.appendChild(probe);
    const value = probe.getBoundingClientRect().height;
    probe.remove();
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

/**
 * Ölçüp <html> üzerine --safe-top ve --app-height yazar.
 * 100dvh, iOS Safari araç çubuğu toplanınca gerçek görünür alandan kısa
 * kalıyor; bu yüzden giriş ekranının yüksekliği innerHeight ile ölçülür.
 */
export function trackSafeArea() {
  const apply = () => {
    const root = document.documentElement;
    root.style.setProperty("--safe-top", `${Math.round(measureEnv())}px`);
    const height = Math.round(window.innerHeight || 0);
    if (height > 0) root.style.setProperty("--app-height", `${height}px`);
  };
  apply();
  window.addEventListener("orientationchange", apply);
  window.addEventListener("resize", apply);
  return () => {
    window.removeEventListener("orientationchange", apply);
    window.removeEventListener("resize", apply);
  };
}
