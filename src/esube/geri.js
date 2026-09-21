/**
 * Tarayıcının/telefonun geri tuşu.
 *
 * Uygulama tek sayfa olduğu için geri tuşu doğrudan siteden çıkıyordu
 * (kullanıcı Google'a düşüyordu). Burada, uygulama içinde gidilecek bir
 * yer varken geçmişe bir "koruma adımı" konuyor; geri basılınca o adım
 * tüketilip uygulama içinde bir adım geri gidiliyor. Gidilecek yer
 * kalmadığında koruma adımı geri alınıyor, böylece ana sayfadayken geri
 * tuşu normal şekilde siteden çıkarıyor.
 */

import { useEffect, useRef } from "react";

export function useGeriTusu(aktif, geriGit) {
  const korumali = useRef(false);
  const yoksay = useRef(false);
  const geriRef = useRef(geriGit);
  geriRef.current = geriGit;

  useEffect(() => {
    if (typeof window === "undefined" || !window.history) return;
    if (aktif && !korumali.current) {
      korumali.current = true;
      try { window.history.pushState({ ottomanGeri: Date.now() }, ""); } catch { /* yoksay */ }
    } else if (!aktif && korumali.current) {
      // Kullanıcı kapatma düğmesiyle kapattı: kendi adımımızı sessizce geri alalım.
      korumali.current = false;
      yoksay.current = true;
      try { window.history.back(); } catch { yoksay.current = false; }
    }
  }, [aktif]);

  useEffect(() => {
    const onPop = () => {
      if (yoksay.current) { yoksay.current = false; return; }
      if (!korumali.current) return;          // bizim koyduğumuz adım değil
      korumali.current = false;
      geriRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
}
