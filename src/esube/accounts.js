/**
 * Kayıtlı hesaplar. Yalnızca kimlik numarası ve görünen ad saklanır; şifre
 * hiçbir zaman cihazda tutulmaz. Hesap değiştirmek, oturumu kapatıp giriş
 * ekranını o kimlik numarasıyla açmak demektir.
 */

const KEY = "ottoman.accounts";
const PENDING = "ottoman.pending-tc";

const read = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((item) => item && item.tc) : [];
  } catch {
    return [];
  }
};

const write = (list) => {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 8))); } catch { /* özel pencere */ }
};

export const savedAccounts = read;

/** Girişten sonra hesabı listeye ekler ya da adını tazeler. */
export const rememberAccount = (user) => {
  const tc = String(user?.tc || user?.account_no || "").trim();
  if (!tc) return;
  const entry = {
    tc,
    name: user?.full_name || tc,
    accountNo: user?.account_no || "",
    role: user?.role || "user",
    at: Date.now(),
  };
  const rest = read().filter((item) => item.tc !== entry.tc);
  write([entry, ...rest]);
};

export const forgetAccount = (tc) => write(read().filter((item) => item.tc !== tc));

const SWITCHING = "ottoman.switching";

/** Giriş ekranının kimlik alanını dolduracak numara; okununca temizlenir. */
export const takePendingTc = () => {
  try {
    const value = sessionStorage.getItem(PENDING) || "";
    sessionStorage.removeItem(PENDING);
    sessionStorage.removeItem(SWITCHING);
    return value;
  } catch {
    return "";
  }
};

/** Hesap değiştir ya da yeni hesap ekle: tc boşsa giriş ekranı boş açılır. */
export const setPendingTc = (tc) => {
  try {
    sessionStorage.setItem(SWITCHING, "1");
    if (tc) sessionStorage.setItem(PENDING, String(tc));
    else sessionStorage.removeItem(PENDING);
  } catch { /* özel pencere */ }
};

/** Çıkıştan sonra giriş ekranı açık kalsın mı? */
export const hasPendingTc = () => {
  try { return sessionStorage.getItem(SWITCHING) === "1"; } catch { return false; }
};
