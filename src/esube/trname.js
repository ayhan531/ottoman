// Borsa veri kaynağı şirket adlarını Türkçe karakterleri olmadan ("Tupras Turkiye
// Petrol Rafinerileri A.S.") veriyor. Bu dosya adı kurumsal yazıma çevirir:
// sözcük sözlüğü + "A.Ş." gibi unvan kısaltmaları. Yönetici panelinden elle
// girilen adlar zaten doğru yazıldığı için bu işlemden aynen geçer.

const SOZLUK_METNI = `
Yatırım Yatırımları Yatırımcı Şirketi Şirket Şirketler Şirketleri Türkiye Türk Üretim Üretimi Ürünleri Ürün Gıda Ortaklığı Ortaklık
Bilişim İletişim Hizmetleri Hizmet Danışmanlık İnşaat Taahhüt İşletmecilik İşletme İşletmeleri Taşımacılık Ulaştırma Çimento Çelik Kâğıt
Halı Ayakkabı Tarım Hayvancılık Sigorta Sigortası Bankası Katılım Değerler Kıymetler Portföy Yönetimi Yönetim Girişim Sermayesi Sermaye
Dış Pazarlama Şti San Tic Doğu Batı Güney Dünya Altın Gümüş Özel Büyük Küçük Güç Gücü Işık Yüksek Kalıp Gübre Fabrikaları Fabrikası
Yapı Geliştirme Araştırma Yazılım Havacılık Yolları Doğal Dağıtım Mağazacılık Süt Kurutulmuş Kuruyemiş İçecek Bira Tütün Şeker Yağ Yağları
Örme İplik Konfeksiyon Giyim Sağlık İlaç Tanı Eğitim Yayıncılık Basım Kulübü Dernek Varlık Mühendislik Mimarlık Müşavirlik Dayanıklı Tüketim
Malları Parça Parçaları Bakır Taş Kompresör Asansör Türbin Rüzgar Güneş Güvenlik Çözümleri Dönüşüm Gelişim Kalkınma Hazır Çeşme Çorum
İzmir İstanbul Eskişehir Uşak Kütahya Düzce Elazığ Diyarbakır Şanlıurfa Muğla Kahramanmaraş Gümüşhane Balıkesir Çanakkale Tekirdağ Kırklareli
Doğuş Şişe Şişecam Koç Sabancı Ereğli Tüpraş Arçelik Tofaş Birleşik Mağazalar Çarşı Çiftlik Çay Çikolata Çiçek Çevre Çözüm Kuyumculuk
Bilgisayar Bilgi Biyoteknoloji Anonim Elektrik Elektronik Elektrikli Teknoloji Teknolojileri Teknik Sanayi Sanayii Ticaret Enerji Holding Grup Grubu
Gayrimenkul Menkul Finans Faktoring Kiralama Banka Endeksi Senedi Sertifikası Darphane Fonu Medya Spor Futbol Otomotiv Makine Makina
Mensucat Dokuma Deri Mobilya Seramik Boya Lastik Lastikleri Plastik Tekstil Ambalaj Kimya Beton Demir Metal Maden Madencilik Cam Kablo Tel Boru
Kozmetik Cihaz Perakende Toptan Turizm Turistik Tesisler Otelcilik Yenilenebilir Santral Santrali Hidroelektrik Termik Siber Yapay Zeka Veri Sistemleri
Pazar Proje Kooperatif Birlik Birliği Gaz Petrol Rafinerileri Hava Deniz Denizcilik Gemi Yeni Eski Genel Merkez Orta Akdeniz Karadeniz Ege Marmara
Anadolu Avrupa Avrasya Asya Ankara Adana Gaziantep Konya Kayseri Bursa Antalya Denizli Kocaeli Sakarya Samsun Trabzon Bolu Afyon Yunus Su
`;

const kati = (s) =>
  String(s)
    .replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i")
    .replace(/Ş/g, "s").replace(/ş/g, "s").replace(/Ğ/g, "g").replace(/ğ/g, "g")
    .replace(/Ü/g, "u").replace(/ü/g, "u").replace(/Ö/g, "o").replace(/ö/g, "o")
    .replace(/Ç/g, "c").replace(/ç/g, "c").replace(/Â/g, "a").replace(/â/g, "a")
    .toLowerCase();

const SOZLUK = new Map();
SOZLUK_METNI.split(/\s+/).filter(Boolean).forEach((kelime) => SOZLUK.set(kati(kelime), kelime));
// Tek başına anlam kazanan, ASCII karşılığı farklı sözcükler.
SOZLUK.set("is", "İş");
SOZLUK.set("bim", "BİM");
SOZLUK.set("ve", "ve");

// Büyük harfle kalması gereken kısaltmalar.
const KISALTMA = new Set(["BIST", "KAP", "USD", "EUR", "TL", "ETF", "TRY", "XU", "II", "III", "IV", "ICU", "ARD", "ATP", "A1"]);

const trBuyuk = (s) => s.charAt(0).toLocaleUpperCase("tr") + s.slice(1);
const trKucuk = (s) => s.toLocaleLowerCase("tr");

/** "A.S." / "AS" / "A. S." / "T.A.S." → "A.Ş." / "T.A.Ş." */
const unvanKisaltmasi = (metin) =>
  metin
    .replace(/\bT\.\s?A\.\s?S\.?(?=\s|$|\))/gi, "T.A.Ş.")
    .replace(/\bA\.\s?S\.?(?=\s|$|\))/gi, "A.Ş.")
    .replace(/\bA\.\s?O\.?(?=\s|$|\))/gi, "A.O.")
    .replace(/\bAS$/i, "A.Ş.")
    .replace(/\bAS(?=\s*\))/i, "A.Ş.");

const kelimeDuzelt = (kelime) => {
  const m = kelime.match(/^([("'‘]*)(.*?)([)"',.;:’]*)$/);
  const [, on, govde, son] = m;
  if (!govde || /\d/.test(govde)) return kelime;
  if (/^[A-ZÇĞİÖŞÜ]\.?$/.test(govde) || govde.includes(".")) return kelime;      // "A.", "T.A.Ş."
  if (KISALTMA.has(govde)) return kelime;
  const hazir = SOZLUK.get(kati(govde));
  if (hazir) return on + hazir + son;
  const tamBuyuk = govde === govde.toLocaleUpperCase("tr") && govde.length > 3;
  if (tamBuyuk) return on + trBuyuk(trKucuk(govde)) + son;                          // bilinmeyen BÜYÜK sözcük → Başlık
  return kelime;
};

/** Veri kaynağından gelen şirket adını Türkçe karakterli, kurumsal yazıma çevirir. */
export function trSirketAdi(ad) {
  const ham = String(ad ?? "").trim();
  if (!ham) return ham;
  if (/futures|index|\(\w{3}\s+\d{4}\)/i.test(ham)) return ham;                    // vadeli/endeks adları değişmez
  const sonuc = unvanKisaltmasi(ham).split(/\s+/).map(kelimeDuzelt).join(" ");
  return sonuc ? trBuyuk(sonuc) : sonuc;
}
