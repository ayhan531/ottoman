/**
 * T.C. kimlik numarası doğrulaması — Nüfus ve Vatandaşlık İşleri'nin
 * kullandığı resmî algoritma. Sunucu da aynı kontrolü yapıyor; burada
 * amaç kullanıcının formu göndermeden hatayı görmesi.
 *
 * Kurallar:
 *  1. 11 hane, hepsi rakam, ilk hane 0 olamaz.
 *  2. 10. hane = ((1,3,5,7,9. hanelerin toplamı × 7) − (2,4,6,8. hanelerin toplamı)) mod 10
 *  3. 11. hane = ilk 10 hanenin toplamı mod 10
 *  4. İlk 10 hanesi aynı rakamdan oluşan numaralar (11111111110 gibi)
 *     algoritmaya uysa da gerçek kimlik numarası değildir, kabul edilmez.
 */
export function gecerliTc(deger) {
  const tc = String(deger || "").replace(/\D/g, "");
  if (!/^[1-9]\d{10}$/.test(tc)) return false;
  if (new Set(tc.slice(0, 10)).size === 1) return false;   // 11111111110 gibi kalıplar
  const h = [...tc].map(Number);
  const tek = h[0] + h[2] + h[4] + h[6] + h[8];
  const cift = h[1] + h[3] + h[5] + h[7];
  const onuncu = ((tek * 7) - cift) % 10;
  const onbirinci = h.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
  return h[9] === onuncu && h[10] === onbirinci;
}

/** Kullanıcıya gösterilecek hata metni; sorun yoksa boş döner. */
export function tcHatasi(deger) {
  const tc = String(deger || "").replace(/\D/g, "");
  if (!tc) return "";
  if (tc.length < 11) return `${11 - tc.length} hane eksik`;
  if (tc[0] === "0") return "T.C. kimlik numarası 0 ile başlamaz";
  if (!gecerliTc(tc)) return "Bu numara geçerli bir T.C. kimlik numarası değil";
  return "";
}
