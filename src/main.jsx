import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import "./extra.css";
import "./esube/theme.css";
import CorporateLanding from "./CorporateLanding";
import Esube from "./esube/App.jsx";
import { AuthScreen } from "./legacy.jsx";
import AdminConsole from "./AdminConsole.jsx";
import { api } from "./esube/store.js";
import { hasPendingTc } from "./esube/accounts.js";
import { trackSafeArea } from "./esube/safearea.js";
import { trackInstall, registerWorker, isStandalone, refreshPush, clearOfflineData } from "./esube/pwa.js";

const normalize = (data) => data?.user || (data?.id ? data : null);

function Root() {
  const [me, setMe] = useState(null);
  const [ready, setReady] = useState(false);
  // Ana ekrandaki kısayoldan açıldıysa tanıtım sayfası atlanır, doğrudan e-şube açılır.
  const [authOpen, setAuthOpen] = useState(() => isStandalone());
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminData, setAdminData] = useState(null);

  const loadMe = useCallback(async () => {
    try { setMe(normalize(await api("/api/me"))); } catch { setMe(null); } finally { setReady(true); }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  // Giriş yapıldıysa ve bildirim izni zaten verilmişse aboneliği tazele.
  useEffect(() => { if (me) refreshPush(); }, [me]);

  // E-şube açıkken gövde kaydırmasını kapat; kurumsal sayfada serbest bırak.
  useEffect(() => {
    document.body.classList.toggle("esube-open", Boolean(me) && !showAdmin);
    return () => document.body.classList.remove("esube-open");
  }, [me, showAdmin]);

  const loadAdmin = useCallback(async () => {
    if (!me || me.role !== "admin") return;
    const [summary, users, orders, moneyData, reports, systemSettings, market, news] = await Promise.all([
      api("/api/admin/summary").catch(() => ({})),
      api("/api/admin/users").catch(() => ({})),
      api("/api/admin/orders").catch(() => ({})),
      api("/api/admin/money").catch(() => ({})),
      api("/api/admin/reports").catch(() => ({})),
      api("/api/admin/system-settings").catch(() => ({})),
      api("/api/market").catch(() => ({})),
      api("/api/news").catch(() => ({})),
    ]);
    setAdminData({
      ...(summary || {}),
      users: users.users || [],
      orders: orders.orders || [],
      money_requests: moneyData.money_requests || [],
      reports,
      market_meta: { ...(market.meta || {}), symbol_count: (market.quotes || []).length },
      news_meta: { ...(news.meta || {}), count: (news.items || []).length },
      system_settings: systemSettings.settings || {},
    });
  }, [me]);

  useEffect(() => { if (showAdmin) loadAdmin(); }, [showAdmin, loadAdmin]);

  const logout = async () => {
    await api("/api/logout", { method: "POST", body: "{}" }).catch(() => {});
    clearOfflineData();
    setMe(null);
    setAdminData(null);
    setShowAdmin(false);
    // Hesap değiştirilirken giriş ekranı açık kalsın; normal çıkışta ana sayfaya dönülür.
    setAuthOpen(hasPendingTc());
  };

  if (!ready) return null;
  if (!me && !authOpen) return <CorporateLanding openAuth={() => setAuthOpen(true)} />;
  if (!me) return <AuthScreen onAuthed={(data) => setMe(normalize(data))} back={() => setAuthOpen(false)} />;
  if (me.role === "admin" && showAdmin) {
    return <AdminConsole data={adminData || {}} refresh={loadAdmin} logout={logout} onClose={() => setShowAdmin(false)} />;
  }
  return <Esube me={me} onLogout={logout} onAdmin={() => setShowAdmin(true)} refreshMe={loadMe} />;
}

trackSafeArea();
trackInstall();
registerWorker();

createRoot(document.getElementById("app")).render(<Root />);
