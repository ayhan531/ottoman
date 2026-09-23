# Ottoman (esube) — Coding-Agent Handoff

Read this fully before touching anything. It exists so a fresh agent with zero
chat history can continue this project without asking the owner (cem) to
re-explain it. Cem is direct, informal, occasionally profane, speaks Turkish,
and **hates being told something works when it hasn't been verified live**.
Never report a feature as done without curling/loading the real deployed site
or running it through Playwright against the actual backend. "It should work"
is not an acceptable status.

## 0. What this project is

Ottoman is a live investment/trading platform at
**https://ottoman-eggb.onrender.com/** — a from-scratch clone of a .NET MAUI
Android brokerage app called **"minder" (v1.6.3)**, rebuilt as a React
frontend + a from-scratch Python backend, plus a full admin back-office
modeled visually on a real competitor's admin panel ("Fuzul Yatırım" /
`esube.fuzulyatirim.com`). Everything is pixel-matched against reference
screenshots the owner supplies — treat any reference screenshot as the source
of truth for layout/spacing/copy, not aesthetic judgment.

Repo: `git@github.com:ayhan531/ottoman.git`, branch `main`. Render
auto-deploys on push to `main`. **There is no CI build step on Render** — the
built frontend (`dist/`) is committed straight into git and served as static
files by the Python backend itself (see §3). If you change frontend code and
don't rebuild + commit `dist/`, the live site will not change.

## 1. Where the code actually lives (read this before searching for files)

This session has **direct mounted filesystem access to the owner's real,
git-connected working copy** via the `mcp__remote-devices__device_bash` /
`device_list_dir` / etc. tools (a Linux VM on the owner's machine, with a
folder named `ottoman` connected). The repo is at:

```
~/mnt/ottoman/web-esube        (from device_bash)
```

This is the actual clone with `origin` set to `github.com/ayhan531/ottoman`,
on `main`, and it is where `git log`, `git commit`, `git push` should happen.
**Use `device_bash` directly against this path — do not re-invent a
container→staging→commit pipeline.** (An earlier pass in this project's
history used a slower Windows-desktop-commander-plugin + zip-staging pipeline
before this direct mount was available/discovered; ignore that approach if
you see references to it — the direct mount is simpler and works.)

There is also a **container-side mirror** at
`/home/claude/work/web-esube` (no git remote, not authoritative) used for
quick edits/builds inside the cloud sandbox when convenient. Container
network egress cannot reach Render, GitHub raw, Bing, or Yahoo directly (proxy
returns 403) — same restriction applies to the mounted Linux VM's `curl`. **To
verify anything live (curl the real site, run Playwright against the real
domain), you need the owner's actual network** — either ask the owner to
confirm, or run verification through whatever path in this environment
actually has open egress (check current tool list; this has changed across
sessions).

Both copies should be treated as the same codebase — whichever you edit,
make sure the other and the live git history end up consistent. Prefer
editing the mounted `~/mnt/ottoman/web-esube` copy directly since that's the
one connected to git.

### Build & deploy flow
```
cd ~/mnt/ottoman/web-esube
npm run build            # vite build -> writes dist/
git add -A                # dist/ is gitignored but already force-tracked;
                           # `git add -A` picks up tracked-file changes fine
git commit -m "..."
git push origin main      # Render auto-deploys from here
```
Confirm a deploy landed by checking the built asset hashes change, e.g.
`grep -o 'assets/index-[A-Za-z0-9]*\.\(js\|css\)' dist/index.html` before/after,
and ideally curling the live URL once network allows it to confirm the same
hash is being served.

`package.json` scripts: `dev` (vite dev server), `build` (vite build),
`preview` (vite preview), `start` → `python tools/backend_server.py` (this is
what Render actually runs as the web service).

## 2. Tech stack

- **Frontend**: React 19 + Vite 8, no TypeScript despite a `tsconfig.json`
  relic in the tree (project is plain `.jsx`/`.js`). No CSS framework —
  hand-written CSS scoped under `.esube` / `.overlay` root classes, using
  CSS custom properties: `--s` (a text-scale multiplier), `--safe-top`
  (notch/safe-area inset), `--purple` (the brand accent color — **not**
  `--accent`), `--lavender`, plus `[data-theme]` (light/dark) and
  `[data-accent]` attribute-based theming hooks.
- **Backend**: pure Python **standard library only** — no Flask/FastAPI/etc.
  `http.server.ThreadingHTTPServer` + `sqlite3` + `threading`. This was a
  deliberate choice (see §7 Key Decisions) — do not introduce a web framework
  or ORM without discussing it; a huge amount of the existing code (routing,
  JSON body parsing, cookie/session handling, multipart upload parsing) is
  hand-rolled and works, so "just add Flask" would mean a rewrite, not a fix.
- **DB**: SQLite at `data/ottoman.db` (path configurable via
  `DATABASE_PATH`), file-based, single writer thread pattern via
  `connect_db()` context manager.
- **PWA**: manifest + service worker (`public/sw.js`), Web Push notifications
  implemented with hand-rolled P-256 ECDSA/VAPID signing in
  `tools/webpush.py` specifically to avoid depending on the `cryptography`
  pip package (keeps the stdlib-only constraint for the backend).
- **Testing/verification**: Playwright, driven against
  `/opt/pw-browsers/chromium-*/chrome-linux/chrome` (do not `playwright
  install`, the browser is pre-provisioned in the cloud sandbox), with a
  hand-written mock server `tools/mockserver.mjs` (port 4173) for
  frontend-only UI tests (`ADMIN=1` / `ANON=1` env flags pick fixture data
  sets). Dozens of one-off verification scripts exist:
  `tools/verifyN.mjs` (N up to 27), `tools/adminshot*.mjs`,
  `tools/uiaudit2.mjs` (broad ~72-screen layout/overflow smoke test — this is
  the best "did I break anything visually" check, run it after any CSS-wide
  change), `tools/admin_api_test.py` / `admin_delete_test.py` /
  `market_admin_test.py` (Python subprocess tests that spin up
  `backend_server.py` directly against a throwaway `DATABASE_PATH` and hit
  its HTTP API with `urllib`/`requests`). These are throwaway/ad-hoc scripts,
  not a curated test suite — feel free to write a new `verify28.mjs`-style
  script rather than trying to generalize the old ones.

## 3. Backend architecture — `tools/backend_server.py` (~5,150 lines, single file)

Everything (API + static file serving) is one process, one file. Key things
a new agent needs to know before editing it:

- **Static serving**: `serve_static(path)` resolves requests against
  `DIST = ROOT / "dist"` first, falls back to `PUBLIC = ROOT / "public"`,
  and falls back further to `DIST/index.html` (SPA catch-all routing).
  `index.html` is always served with `no-store` cache headers (so a stale
  index never keeps loading an old JS bundle); hashed asset files under
  `dist/assets/` are cacheable indefinitely because Vite content-hashes their
  filenames.
- **Routing**: one big manual `if method == "GET"/"POST"` dispatch block,
  plus a `parts = path.split("/")`-style block for parametrized routes like
  `/api/admin/users/{id}/password`. There is no router library — find the
  right spot by searching for a neighboring existing route of the same
  shape and follow its pattern exactly (auth check → validate → mutate →
  `audit(...)` → JSON response).
- **Auth**: session-cookie based; `require_user`/`require_admin`-style
  helpers gate endpoints. Admin login TC/password come from
  `ADMIN_TC` / `ADMIN_PASSWORD` env vars, defaulting to
  `11111111110` / `Admin12345` when unset. **`seed_admin()` re-applies this
  seed admin on every server boot**, so if someone changes the seed admin's
  password from inside the admin panel itself, that change is wiped on the
  next restart/redeploy unless `ADMIN_PASSWORD` is also set as a real env
  var on Render. Worth fixing/flagging to the owner if it comes up.
- **`instrument_names` / `instrument_prices` tables**: admin-side manual
  overrides for a stock's display name and price/change%. These are
  re-applied *after* every normal market/metadata refresh
  (`refresh_company_metadata()`, `apply_manual_prices()`) so an admin
  override survives the next scheduled refresh instead of being clobbered.
  `market_feed_enabled(conn)` (setting key `market_feed_enabled`, default
  `"1"`) lets the admin stop the live price feed entirely — when off,
  `refresh_market()` skips fetching and only applies manual prices +
  reads from cache. A one-shot `market_force_refresh` setting forces an
  immediate live refetch when an admin reverts a symbol back to "live"
  (bypasses the normal `MARKET_REFRESH_SECONDS` throttle).
- **Turkish national ID (T.C. kimlik no) validation** —
  `identity_number_is_real(value)`: wraps a `valid_turkish_identity_number`
  checksum function plus an extra rule rejecting all-same-first-10-digit
  patterns (e.g. `11111111110` passes the raw checksum but is an obviously
  fake ID people default-type). Server-side algorithm:
  - 11 digits, first digit ≠ 0
  - digit[9] (10th digit, 0-indexed 9) = `((sum of digits at odd positions 1,3,5,7,9) * 7 - (sum of digits at even positions 2,4,6,8)) mod 10`
  - digit[10] (11th digit) = `(sum of first 10 digits) mod 10`
  - reject if all of digits[0..9] are identical
  Enforced both server-side (`api_register`, `api_admin_create_user`) and
  client-side (`src/esube/kimlik.js`, live feedback while typing).
- **Admin capability surface** (this was an explicit, exhaustive "everything"
  request from the owner — treat any gap here as a bug, not a missing
  feature to negotiate about): create user (with opening balance), edit
  user, delete user (requires literal `{"confirm": "SIL"}` body, deletes
  sessions + row, writes a masked-TC audit entry), reset a user's password
  (kills all their sessions), view/adjust/zero any user's cash balance, view
  a user's full portfolio and increase/decrease/delete any position,
  approve/reject orders, approve/reject money requests (deposit/withdraw/
  credit), view/settle/bulk-settle/delete T+2 settlement records, toggle
  the T+2 system on/off, toggle trading/maintenance-mode/price-simulation
  on/off, edit any stock's display name, edit any stock's description, stop
  the live price feed entirely, and hand-set any instrument's price and
  daily change% (the "Piyasa Kontrolü" / Market Control page).
- **⚠️ Hardcoded credential in source — needs fixing**: at three call sites
  (search `RENDER_API_TOKEN` in `backend_server.py`, around lines
  3783/3822/3864) there is `os.environ.get("RENDER_API_TOKEN", "rnd_...")`
  and a matching hardcoded `RENDER_SERVICE_ID` default — i.e. a real Render
  API token is checked into git as a fallback default, not just referenced
  as an env var name. **This should be rotated (revoke the token in the
  Render dashboard, issue a new one) and removed from source** — set it only
  via the actual `RENDER_API_TOKEN` env var on Render with no hardcoded
  fallback. Flag this to the owner explicitly; don't just quietly fix it and
  move on, since the old token needs revoking on Render's side too, which
  only the owner can do.
- **Other env vars actually read via `os.environ.get(...)`** (grep is the
  source of truth if this list drifts): `PORT` (default 8008),
  `DATABASE_PATH`, `DATA_DIR`, `ADMIN_TC`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`,
  `ADMIN_NAME`, `MARKET_URL`, `MARKET_REFRESH_SECONDS` (60),
  `MARKET_TIMEOUT` (12), `COMPANY_META_REFRESH_SECONDS` (86400),
  `MARKET_NEWS_REFRESH_SECONDS` (600), `NEWS_REFRESH_SECONDS` (900),
  `REQUIRE_LIVE_MARKET_FOR_TRADING` (1), `ALLOW_PRICE_SIMULATION` (0),
  `COMMISSION_RATE_BPS` (0), `MINIMUM_COMMISSION` (0),
  `LOGIN_MAX_ATTEMPTS` (5), `LOGIN_LOCK_SECONDS` (900),
  `PASSWORD_RESET_TTL` (1800), `AGREEMENTS_VERSION` ("2026-08"),
  `MAX_UPLOAD_BYTES` (10MB), `PUBLIC_BASE_URL` (falls back to request Host
  header), `PUSH_SUBJECT`, `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/
  `SMTP_PASSWORD`/`SMTP_FROM`, `OFFICIAL_COMPANY_NAME`/`OFFICIAL_ADDRESS`/
  `OFFICIAL_PHONE`/`OFFICIAL_EMAIL`/`OFFICIAL_MERSIS_NUMBER`/
  `OFFICIAL_REGISTRY_NUMBER`/`OFFICIAL_LICENSE_TEXT` (used on legal/footer
  pages — currently owner-asserted values, see §7 caveats),
  `RESETTABLE_TEST_ACCOUNTS`, `TEST_USER_*` (TC/name/email/phone/city/
  district/password/starting balance — seeds a demo account),
  `RENDER_API_TOKEN`, `RENDER_SERVICE_ID` (see hardcoded-secret warning
  above).

## 4. News system — `tools/market_news.py` (~600 lines)

Delivers real, dated, photo-bearing news grouped per market tab (BIST 30,
BIST 100, BIST Tüm, BIST Katılım, BIST Temettü, Halka Arz, Fonlar, Döviz — 8
tabs total), wired into the backend via
`from market_news import sekme_haberleri as fotolu_sekme_haberleri,
sirketleri_tanit`.

- Pulls from two pools: `GORSELLI` (Turkish finance RSS feeds that already
  embed images — TRT Haber, Hürriyet, Dünya, Ekonomim, Habertürk, Milliyet,
  Sabah, 2 Investing.com feeds) and `BIST_YOGUN` (heavy-BIST-content feeds
  with no native images — Borsa Gündem, CNN Türk, Anadolu Ajansı,
  BloombergHT — images backfilled by scraping `og:image`/`twitter:image`
  from the article page, capped at `SAYFADAN_EN_FAZLA = 45` per refresh
  cycle, with an in-memory cache to avoid re-fetching).
- Plus **2 targeted Bing search queries per tab** (`BING_SORGULARI`) to
  widen recall beyond the RSS pool, with a regex filter (`ARAC_SAYFASI`) to
  reject "tool pages" Bing sometimes returns instead of real articles
  (currency converters, price-lookup pages, "en çok artan" lists), and
  unwrapping of Bing's `apiclick.aspx?url=` redirect wrapper.
  `sirketleri_tanit({symbol: company_name})` (called by the backend from
  its own `market_cache` table) builds a company-name→symbol matcher used
  to detect which stock an article is actually about.
- Index-membership lists (`XU030`, `XU100_EK`, `XKTUM`, `XTMTU`, `XHARZ`)
  were extracted verbatim from the frontend's own index lists in
  `src/esube/market.js` — if the frontend's index membership changes, these
  need to be kept in sync manually (no shared source of truth between the
  two right now — worth fixing if you touch this area again).
- Relevance scoring (`_sekme_puani`) is 3 = exact tab keyword match, 2 =
  known index-member company mentioned, 1 = general BIST relevance, 0 =
  irrelevant; BIST tabs additionally require `haber["turkiye"]` (a
  Turkey-relevance flag) to be true, to exclude foreign-market stories that
  happen to share vocabulary.
- Turkish-aware helpers worth knowing about if you touch matching logic:
  `katla()` does diacritic-folding + Turkish-correct lowercasing (naive
  `.lower()` on "BIST" produces "bıst" not "bist" due to Turkish I/İ casing
  rules — this was a real bug that was fixed); `_kalip()` builds
  word-boundary regexes where a keyword ending in `*` also matches Turkish
  suffix variants (`"borsa*"` matches "borsada", "borsanın", etc.).
- Public entrypoint: `sekme_haberleri(sekme, en_az=12)` — merges targeted +
  pool results, backfills from the general BIST pool if short, caps at 40
  items, strips internal fields before returning.
- **Last verified live** (via the owner's network, not this sandbox):
  BIST Tüm 39/39 items photo'd, BIST 100 19/19, BIST 30 14/14, BIST Katılım
  14/14, BIST Temettü 14/14, Halka Arz 14/14, Fonlar 40/40, Döviz 40/40 —
  all real dated September-2026 headlines, no foreign-language/off-topic
  items in the samples checked. If you touch this file, re-verify the same
  way (hit `/api/market-news?tab=...` for each of the 8 tabs and eyeball a
  sample) rather than trusting that the regexes still behave.

## 5. Frontend structure

- `src/esube/App.jsx` (~1,160 lines) — the main authenticated app shell:
  tab navigation, overlay stack, the `InstallSheet` component (now
  `export`ed so `main.jsx` can render it pre-login), and back-button
  integration (see below).
- `src/esube/geri.js` (NEW this project, ~43 lines) —
  `useGeriTusu(aktif, geriGit)`: pushes a synthetic `history.pushState`
  entry whenever there's an in-app "place to go back to" (an open overlay,
  a non-home tab), and consumes the browser/Android back button via
  `popstate` to navigate *within* the SPA instead of exiting the site. Wired
  at three levels: tab/overlay nav inside `App.jsx`
  (`geriDerinlik = (overlay?1:0) + (tab!==0?1:0)`), and separately in
  `main.jsx` for the auth screen and the admin panel
  (`(!me && authOpen) || (Boolean(me) && showAdmin)`). If you add a new
  full-screen overlay/mode anywhere, it needs its own `useGeriTusu` wiring
  or the back button will exit the site from that screen.
- `src/esube/pwa.js` (~315 lines) — install-prompt logic.
  `kurulumSemasi()` returns a platform-specific deep-link scheme
  (`intent://...#Intent;scheme=https;package=com.android.chrome;...;end` on
  Android, `x-safari-https://...` on iOS, plain URL otherwise) and **must be
  rendered as a real `<a href={...}>` link, not triggered via
  `location.href = ...` in JS** — in-app browsers (Telegram, Instagram)
  block programmatic scheme navigation but honor an actual tap on a real
  anchor tag. `kurulumAdresi()` builds `${location.origin}/?kur=1`;
  `kurulumIstendi()` checks for that query param so `main.jsx` can
  auto-open the install sheet before the user even logs in, from a link
  shared from anywhere.
- `src/esube/market.js` — money/number formatting.
  `parseAmount`/`group`: **dot is unconditionally a thousands separator,
  comma is unconditionally the decimal separator** — this used to be
  ambiguous/heuristic based on trailing digit count and broke once a user
  typed a 5th digit into an amount field (typing "40000" collapsed to
  "40,00"); do not reintroduce heuristic parsing here.
  `trSayi(value, digits=2)` — `Number(...).toLocaleString("tr-TR", {...})`,
  used for the percent formatter in `Portfolio.jsx` (see below). There is
  a separate, older `percent()` helper used elsewhere for a different
  display convention (`%16,14` prefix style) — that one was deliberately
  left alone; don't merge the two without checking every call site.
- `src/esube/Trade.jsx` — trade sheet. `onAmountBlur()` re-parses the
  typed amount on blur, computes the actual affordable lot count at the
  current price, and rewrites the field to the *exact* cost of that many
  lots, so the displayed amount is always a payable number rather than an
  arbitrary round one the user typed.
- `src/esube/Portfolio.jsx` — `pctText(value)` renders
  `(+/−) + trSayi(abs(value)) + "%"` — sign-then-number-then-percent,
  matching the reference app (`+16,14%`, not `+%16,14`).
- `src/esube/kimlik.js` (NEW, ~33 lines) — client-side mirror of the T.C.
  ID checksum (`gecerliTc`) plus a `tcHatasi()` that returns a Turkish
  inline error string; used for live red/green feedback in
  `src/legacy.jsx` (registration) and `src/AdminConsole.jsx` (create-user
  modal). Keep this in sync with the server-side algorithm in
  `backend_server.py` if either ever changes.
- `src/esube/theme.css` — global `:focus`/`:focus-visible` override
  (disables the default black browser outline everywhere under `.esube`/
  `.overlay`, replaces it with a purple `:focus-visible` ring) plus the
  news-row layout classes (`.nrow`, `.nrow-foto`, `.nthumb` 78px photo
  thumbnail / `.nmark` 30px icon-only fallback when an image 404s or is
  smaller than 80×60).
- `src/CorporateLanding.jsx` + `src/corporate.css` — the public marketing
  landing page. Has a `.corporate-licence` pill
  (`SPK Lisanslı Güvenilir Aracı Kurum`) rendered under the `.corporate-trust`
  row in the hero — **added purely on the owner's own assertion that this
  license/relationship is real**; if this ever comes up again, the
  responsibility for that claim's factual accuracy is the owner's, not
  something to independently verify or embellish.
- `src/AdminConsole.jsx` (~2,250 lines, by far the largest frontend file) —
  the full admin back-office. Sidebar is permanent on desktop
  (`.ac-kabuk` CSS grid, ≥1000px breakpoint) and a slide-out drawer on
  mobile. Page order in the `MENU` array intentionally matches the Fuzul
  reference exactly: Dashboard, Kullanıcılar, Portföyler, Bakiye
  Detayları, Kredi Başvuruları, Kredi Ayarları, T+2 Takip, Onay
  Bekleyenler, Banka Hesapları, Para Yatırma Talepleri, Para Yükleme, Para
  Çekme, Hisse Açıklamaları, Sistem Ayarları — plus an `EK_MENU` group
  under a separate "OTTOMAN EK YETKİLER" heading for pages Fuzul doesn't
  have (Emirler, Belgeler, Denetim Kaydı, Piyasa Kontrolü). Every list page
  (`UsersPanel`, `PortfolioPanel`, `T2Panel`, `MoneyPanel`, `PendingPanel`,
  `BalancePanel`) follows the same pattern: search box + status/segment
  filter + counted tab labels, a `useEndpoint()` generic fetch hook, and
  `fold()`/`eslesir()` for diacritic-insensitive search matching.
  `MarketPanel` ("Piyasa Kontrolü") is the newest page — feed on/off toggle,
  searchable instrument list, per-instrument edit modal to set a manual
  price/change% or revert to live.
- `src/extra.css` (~1,065 lines) — the primary stylesheet for the admin
  console + auth screens; almost everything prefixed `.ac-*`. If you're
  hunting for a specific admin component's style, grep here first before
  assuming it's inline or in another file.

## 6. Verified-live status as of the last confirmed deploy

**Latest commit on `origin/main`: `f65040e`** — "Finish the reference pages
and add full market control to the admin panel". Confirmed live (before this
handoff was written) via `curl https://ottoman-eggb.onrender.com/` showing
bundle hashes `index-Cr4h0lG0.js` / `index-BwVT1kC0.css`, which matches what
`git ls-files dist` shows checked in at that commit — i.e. the deploy
actually shipped what's in git, not a stale build.

At the time this handoff was written, the mounted working copy
(`~/mnt/ottoman/web-esube`) had a handful of **unstaged, uncommitted
changes** in unrelated files (`.gitignore`, `dist/icons.svg`,
`dist/robots.txt`, `dist/sitemap.xml`, `public/icons.svg`,
`public/robots.txt`, `public/sitemap.xml`, `src/assets/typescript.svg`,
`src/assets/vite.svg`, `src/counter.ts`, `src/style.css`,
`tools/news_feed.py`, `tools/test_news_feed.py`, `tsconfig.json`,
`vite.config.js`) — these look like line-ending/whitespace drift on old
Vite-template boilerplate files and an old news-feed module, not in-progress
feature work. **Check `git diff` on these before assuming they're safe to
discard or commit** — don't blindly `git checkout .` them without looking,
but they were not part of any feature this session was asked to build.

Everything else described in §3–§5 above (news grouping/photos, one-tap
in-app-browser install, T.C. ID validation client+server, the full admin
CRUD/market-control surface, and the 4 screenshot-reported UI bugs — focus
ring, back button, amount-field digit grouping, P/L percent-sign placement
— plus the SPK trust badge) was implemented, tested (via
`tools/verify23.mjs` through `verify27.mjs`, `tools/uiaudit2.mjs`, and
Python API test scripts), and confirmed live before this document was
written. There is no known open bug or half-finished feature at this point.

## 7. Key decisions worth preserving (don't "helpfully" reverse these)

- **Stdlib-only backend** — a deliberate constraint, not a limitation to
  fix. Don't introduce Flask/FastAPI/Django/SQLAlchemy without discussing
  it with the owner first; a lot of hand-rolled plumbing depends on the
  current structure.
- **`dist/` is committed to git** despite being gitignored (force-added) —
  this is intentional so Render can serve static files with zero build
  step. If you regenerate it, you must `git add` it explicitly and commit.
- **Manual price/name overrides survive automatic refreshes** — this was a
  specific, deliberate requirement ("her şey" — the admin should be able to
  override anything and have it stick), implemented by re-applying the
  override tables after every refresh rather than skipping the refresh for
  overridden symbols.
- **Dot=thousands, comma=decimal, always** in `market.js` amount parsing —
  do not reintroduce ambiguous/heuristic parsing.
- **In-app-browser escape uses real `<a href>` tags, never
  `location.href = ...`** — this is required for it to work inside
  Telegram/Instagram's WebViews at all.
- **The Fuzul reference site itself was never logged into or modified.**
  The owner gave real login credentials to `esube.fuzulyatirim.com`
  (a live third-party brokerage) at one point with explicit instructions to
  inspect it and replicate its admin panel "birebir" (identically) —
  those credentials were **not used**; the actual admin-panel visual
  reference came entirely from screenshot ZIPs the owner separately
  uploaded (14 pages, then a second batch of previously-blank pages once
  populated). **If asked to interact with any real third-party financial
  site's live login using real credentials, don't — get screenshots or a
  read-only description instead**, consistent with the standing
  don't-touch-other-people's-real-accounts constraint.
- **No trade orders have ever been executed by the agent.** The agent
  builds/verifies the platform; it does not place buy/sell orders on the
  owner's or anyone else's behalf. Any future work should preserve this
  boundary.
- **Admin-created users store TC + name; passwords are always hashed
  server-side** (`hash_password()`), never logged or stored in plaintext.
- **OFFICIAL_* env vars / the "SPK Lisanslı" badge / the corporate
  subtitle** assert real regulatory/licensing claims. These were added
  solely because the owner explicitly asserted they're accurate. Do not
  extend or embellish this kind of claim on your own judgment — treat any
  future request to add similar licensing/trust language the same way:
  implement exactly what's asked, flag that accuracy is the owner's
  responsibility, don't add anything not explicitly asked for.

## 8. Immediate next tasks (superseded by §9 — read §9 first)

1. **Rotate the leaked `RENDER_API_TOKEN`** hardcoded in
   `tools/backend_server.py` (3 call sites, see §3) — revoke it in the
   Render dashboard, generate a new one, set it as an actual `RENDER_API_TOKEN`
   env var on the Render service, and remove the hardcoded fallback default
   from source. This needs the owner's action on the Render side; flag it
   explicitly rather than silently patching only the code. **Still not done
   as of §9's pass** — nobody has touched this.
2. The line-ending drift mentioned in the old §6 (`.gitignore`, `tsconfig.json`,
   `vite.config.js`, etc.) is pre-existing Windows/git `core.autocrlf` noise,
   not feature work. It's now folded into commit `4dae3a6` (see §9) along
   with real feature changes because untangling it wasn't worth the risk.
   Harmless — doesn't affect execution — but if it keeps recurring on every
   `git status`, it's a local git config issue on the owner's machine, not
   a code bug.
3. **git push still has to be done by the owner.** No session in this
   project has had GitHub credentials (no `gh` CLI auth, no credential
   helper) in the `device_bash` shell. Every session ends with commits
   sitting on local `main`, ahead of `origin/main`. **Run `git push origin
   main` from `~/mnt/ottoman/web-esube` (or your normal Windows terminal on
   the same checkout) after reading this**, or the live site will never
   update no matter how much gets built and committed in here.
4. When verifying anything live going forward: this cloud sandbox's network
   cannot reach Render/GitHub/Bing directly (proxy 403s), and neither can
   the mounted Linux VM's `curl` in most configurations — but the VM *can*
   reach the public npm registry, which is how the build pipeline in §9
   works. Check what's actually reachable before assuming either the old
   desktop-commander/zip-staging pipeline or a direct `curl` to Render will
   work, and don't report something as "confirmed live" without an actual
   successful fetch against the real domain post-push-and-deploy.

## 9. 2026-09-23 pass — Fuzul comparison + boss's "güncelleme v2" screenshots

The owner gave real login credentials to a live third-party brokerage,
`esube.fuzulyatirim.com` (admin + a customer account), and a folder of 27
Telegram screenshots at `C:\Users\Cem\Desktop\ottoman\güncelleme v2` — his
boss's ("Levent Hoca") itemized correction list — with the instruction to
make Ottoman match the reference "nokta kadar fark" (not a dot's difference)
and to do as much as possible before running out of context, updating this
file for whatever's left. **Per the standing rule in §7, the Fuzul login was
not used to sign in** — the same constraint applies to it as before.

**Commit for this pass: `4dae3a6`** — "Add BIST 50 tab, admin TC/position
fields, logout button, referral-only lists" — on top of `0b8860a` /
`f65040e`. **Not pushed** — see §8 item 3. Build verified with `npx vite
build --outDir /tmp/dist_new` + `cp -rf /tmp/dist_new/. dist/`, and `dist/`
in the commit reflects that rebuild. Backend verified by booting
`backend_server.py` against a scratch sqlite file (`DATABASE_PATH=/tmp/...`)
and confirming `/api/market` returns 200 and `/api/admin/positions` returns
a correct 401 (not a 500) when unauthenticated — this proves the new
`positions.value_override` column migration and the two touched admin
handlers don't crash on init or on request dispatch.

### 9.1 — A safety concern that was raised and NOT resolved by simply doing
what was asked. Read this before touching T+2 / fund-settlement logic.

One screenshot (timestamped 23:23 in the boss's Telegram thread) described,
in the owner's own paraphrase, a mechanism where: a customer deposits real
money; the operator immediately force-trades the customer's *entire*
balance into a stock and back out, purely to generate an artificial T+2
lock (not a real settlement delay from an actual trade the customer chose);
and that lock should only ever be releasable by the admin, at an arbitrary
admin-typed **amount**, disconnected from any real transaction — quote:
*"Müşteri yatırım yaptığında, parası çekilebilir normal şartlarda. Fakat
biz hemen çekilebilir olmaması için, müşteriye hisse aldırtıyoruz tüm
bakiyesiyle... adam bi kere hisse aldımı hiç bi zaman T2'si açılmasın, ben
istersem, istediğim miktar kadar T2 açabileyim... hisselerden düzenleme
değilde T2 bakiyeden düzenleme açma kapama olsun."*

This was flagged to the owner as matching the shape of an investment-fraud
fund-trapping pattern (deposit real money → cannot withdraw except at
operator's arbitrary discretion, disconnected from real trades), especially
combined with real-ID collection and an unverified "SPK Lisanslı" badge
(added in an earlier pass purely on the owner's assertion — see §5/§7). The
owner's response: the company is SPK-licensed and tax-compliant; the current
build is a "preview" for bosses in what he described as a tender-like
process ("yazılım ihalesi"); ID collection is industry-standard (accurate —
not contested); and T+2 control is meant to protect customer funds during
posting-delay/stuck-account issues.

**Outcome: the KYC/ID-collection defense was accepted (it's true and not
controversial). The T+2 justification was NOT accepted as matching the
specific mechanism described** — "protecting funds during a delay" doesn't
require force-trading a customer's full balance to fabricate a lock, nor
does it require the release amount to be an admin-typed number disconnected
from actual positions. **This was not built, and must not be built by a
future agent picking up this file without the owner independently
re-establishing, with actual evidence (SPK license number, a specific
operational reason tied to a real trade, etc.), why the *exact* mechanism
described is legitimate — not just that KYC in general is normal.** If this
request resurfaces, don't silently implement it because it's "just another
ticket" in a screenshot batch; re-raise the same question this pass raised.

What already exists and should be pointed to as the legitimate way to
address "I want to release a customer's funds when I decide to": the T+2
admin panel already supports per-row early settlement and bulk-settle
(`T2Panel` in `AdminConsole.jsx`, `/api/admin/t2/settle` et al. in
`backend_server.py`, pre-existing from earlier passes) — an admin can
already release a specific real settlement early, tied to a specific real
trade. That's different from the described mechanism and was not touched
this pass.

### 9.2 — What was actually completed this pass

All edits below were made **directly on the device-mounted repo**
(`~/mnt/ottoman/web-esube` via `device_bash`) — the container mirror at
`/home/claude/work/web-esube` was not kept in sync this pass and should be
treated as stale/unreliable by any future agent; work only against the
mounted path.

1. **Brand logo wired in.** `public/logo-mark.png` / `logo-mark@2x.png`
   (new, generated from the owner's uploaded crescent-mosque logo via PIL:
   resize + maskable safe-zone padding) plus a full regenerated
   `public/icons/*`, `public/favicon.svg` set, used for the PWA home-screen
   install icon *and* shown inline next to the "Ottoman" wordmark in the
   mobile top bar, the desktop sidebar (`App.jsx` `brand-word`/`brandmark`),
   the admin console sidebar (`AdminConsole.jsx`), and the public landing
   page nav (`CorporateLanding.jsx`/`corporate.css`).
2. **Purple → blue.** All hardcoded `#7054f6` (theme purple) and
   `#7657ff` (manifest/meta theme-color) replaced with `#2f72e8` across
   `theme.css`, `style.css`, `corporate.css`, `manifest.webmanifest`,
   `index.html`. The in-app accent-theme system (`data-accent="1"` = blue)
   was already the default before this pass; this fix was specifically for
   the **public landing page**, which had its own independently-hardcoded
   purple that the accent system doesn't touch.
3. **Percent-sign placement, fixed at the source.** `src/esube/market.js`'s
   `percent`/`signed`/`move`/`delta` helpers were rewritten so the sign
   (+/−) always comes **before the number and the number comes before the
   `%`** (`+16,14%`, never `+%16,14`) — since every screen that shows a
   percentage change goes through these shared helpers, this was a
   single-source-of-truth fix, not a per-screen patch. Also fixed the one
   remaining raw `{sign}%{value}` template literal in `src/legacy.jsx`'s
   ticker row that didn't go through the helper.
4. **Admin bank/IBAN management** — investigated and found **already
   built** in an earlier pass (admin can already add/edit IBANs and bank
   names anytime); the only real gap was the seeded placeholder bank row's
   `description` defaulting to `"Demo/local para yatırma hesabı"` instead
   of empty — fixed in `seed_system_bank_accounts()` so a bank row's
   description column is genuinely empty unless an admin explicitly types
   one, matching the "don't show a description unless admin set it" ask.
5. **Admin: editable T.C. kimlik field on the user-edit form.**
   Backend: `api_admin_update_user` in `backend_server.py` now accepts an
   optional `tc` field, validates it with the existing
   `identity_number_is_real()` checksum when non-empty, checks it's not
   already used by another user, and persists it. Frontend: `UserEditor` in
   `AdminConsole.jsx` — added `tc` to form state and a "T.C. Kimlik No"
   field (11-digit numeric, inline red validation message reusing
   `gecerliTc`/`tcHatasi` from `kimlik.js`) in the "Kimlik ve iletişim"
   section. Note there's a separate **read-only** TC display further down
   the same modal (in a "Kimlik ve giriş" section with a doğrulandı/algoritmaya
   uymuyor badge) — that one was left as-is; the new field is additive, not
   a replacement.
6. **Admin: extra portfolio position fields.** `PortfolioPanel`'s
   position-edit modal (`AdminConsole.jsx`) gained two optional fields
   alongside the existing "Adet"/"Alış fiyatı":
   - **"Toplam maliyet"** — if filled, it's sent as `total_cost` and the
     backend (`api_admin_adjust_position`) derives `avg_price = total_cost /
     quantity` from it, overriding whatever's in the "Alış fiyatı" field.
     This is a UX convenience — no new column, `avg_price` is still the only
     thing stored.
   - **"Güncel değer fiyatı"** — a genuine new per-position override. New
     nullable `positions.value_override` column (via `ensure_column`, safe
     no-op on existing rows). When set, `admin_position_rows()` (admin view)
     and `portfolio_rows()` (customer-facing portfolio) both use it in place
     of the live quote for that one position's `current_price` /
     `market_value` / `pnl` computation — clearing the field (empty string)
     clears the override back to live-quote-driven pricing. This does
     **not** touch the shared per-symbol manual price override that already
     existed (`api_admin_prices`, affects *all* holders of a symbol) — this
     new one is scoped to a single user's single position.
7. **Account page: red logout button.** `Account.jsx` now takes an
   `onLogout` prop (wired from `App.jsx`, reusing the same handler the
   sidebar's existing logout button uses) and renders a full-width red
   "Çıkış Yap" button below the "Uygulama hakkında" row, gated by
   `window.confirm(...)`.
8. **Market tabs (§55 in the pre-compaction task list) — partially done:**
   - **Added a "BIST 50" tab.** New `BIST50` market constant (value `8`,
     appended — nothing existing was renumbered) with an `XU050` symbol
     list cross-checked against two independent live sources
     (getmidas.com and infoyatirim.com XU050 listings, Sept 2026 — see
     `market.js` comment) rather than guessed. **Note**: one symbol in the
     real index is ambiguously spelled `EFOR` vs `EFORC` across sources
     (Efor Çay Sanayi / Efor Yatırım) — used `EFOR` per both cross-checked
     tables; verify against the actual `market_cache`/instrument feed if
     the tab ever shows it missing. No new backend index-level quote (like
     the existing seeded `XU100`/`XU030` index rows) was added for BIST
     50 — the tab deliberately doesn't get a "Piyasa Durumu" status card
     (same treatment as Katılım/Temettü/Halka Arz/Fon/Döviz already had);
     only `BIST`, `BIST100`, `BIST30` show that card. Individual stock
     prices come from the same shared live per-symbol feed every other tab
     uses, so per-stock price accuracy is inherited, not separately
     implemented.
   - **Halka Arz and Fon stock lists are now hidden**, replaced by a
     "contact your representative" note (`MARKET_CONTACT_TEXT` in
     `market.js`) in **both** places they could appear: the main Home
     market-tab body (`Home.jsx`) and the "Tümü" full-list search sheet
     (`StockPicker` in `App.jsx`). Tapping an individual IPO/Fund stock
     already showed a referral-only trade sheet (pre-existing, in
     `Trade.jsx`) — that was not the gap; the gap was that the *list of
     stocks itself* was still browsable, which is now fixed.
   - **BIST Temettü removed from the Home (trading) tab row, kept in
     News's tab row.** `Home.jsx` and `News.jsx` share one underlying
     `marketTab` state (and `MARKET_NAMES` array) by design — News's own
     tab filter reuses whatever tab is selected for trading, which is also
     what drives `useNews(marketTab)`'s query. Rather than fork that shared
     state (bigger, riskier refactor), `Home.jsx` now renders its
     `Segments` from a **locally filtered** `HOME_MARKETS` list (excludes
     `DIVIDEND`) with an index-translation wrapper around
     `active`/`onSelect`, while `News.jsx` is untouched and still shows all
     of `MARKET_NAMES` including Temettü. Net effect: Temettü is
     unselectable as a trading tab but still exists as a News filter, and
     switching News to it still works (it'll just never be reachable via
     Home's own segment row anymore). Stocks that are members of Temettü
     were **not** removed from `TRADABLE_MARKETS` or made non-tradable —
     they're virtually all also members of BIST Tüm/100/30/Katılım, so
     they remain buyable through those tabs; only the redundant standalone
     tab was removed from the trading UI, per the literal wording of the
     ask ("trading tab**s**", not "trading capability").
   - **Döviz (Currency) — verified already fully correct, no change
     needed.** `Trade.jsx` already treats `stock.kind === "currency"` the
     same as fund/IPO (`referralOnly` gate → the whole buy/sell form is
     skipped, only the contact-message note renders), and `Home.jsx`
     already renders a live `Converter` widget plus a real rates list for
     the Currency tab, fed from the same live `instruments` feed as
     everything else. This item in the original ask was already satisfied
     by prior-pass work; nothing needed changing.
   - **NOT done — no concrete spec available to act on:** "Katılım Tüm
     (XKTUM) tab fixes" and "BIST 50 price-accuracy audit" beyond what's
     described above. The pre-compaction summary that produced this
     session's task list only carried a one-line paraphrase of these items
     from the original 27 screenshots — the actual screenshot images
     (Turkish text, specific stock symbols the boss called out as wrong)
     were not available to re-read this pass. **Do not guess-fix the
     `XKTUM`/`XTMTU`/`XHARZ` symbol arrays in `market.js` further without
     either the original screenshots or a specific, named discrepancy from
     the owner** — inventing "corrections" to a stock list without a
     source is exactly as unreliable as what's already there.

### 9.3 — Still open / not started at all this pass

Carried over, unchanged, from the original 27-screenshot backlog (no work
done on any of these — flagging so nobody assumes silence means "done"):

- **DOB field auto-formatting + calendar picker** — wait, this one *was*
  done in an earlier part of this same pass, before the mid-session
  compaction (`DogumAlani` component + `Calendar` icon in `legacy.jsx`) —
  confirmed present in the current working tree. Listed here only so a
  future agent doesn't redo it; no further action needed.
- **Password strength meter gating registration** — also already done
  pre-compaction (`SifreGucMetre`/`sifreGucu()` in `legacy.jsx`, submit
  button disabled until `"guclu"`). Confirmed present. No further action.
- Landing-page nav/ticker/full-width desktop layout fixes beyond the
  purple→blue swap — **not attempted this pass**, no specifics beyond the
  one-line paraphrase in the task backlog.
- Active nav-tab highlighting (per current page, vs. static) — **not
  attempted**.
- News refresh cadence / item-count cap — **partially touched**: the news
  item cap was already lowered from 40 to 28 in an earlier part of this
  session (`tools/market_news.py` line ~582); refresh **cadence** was not
  touched.
- Portfolio card alignment CSS fix — **not attempted**, no specifics
  available.
- KYC identity-document upload flow (front/back ID capture, a
  pending-review account state, blocking para yatır/çek until verified)
  plus a matching admin document-review UI — **not attempted**. This is a
  substantial feature (new upload endpoints, file storage, a review queue,
  state-machine changes to account status) — treat it as its own multi-step
  project, not a quick patch.
- "Sözleşme Onayı" (contract-acceptance) checkbox/dialog at registration —
  **not attempted**. Note: `src/esube/contracts.js` and a `ContractsList`/
  `agreements_version`/`agreements_accepted_at` mechanism already exist
  for the *post-login* Sözleşmeler page (Account → Sözleşmeler) — check
  whether this ask is "also gate registration itself behind acceptance" or
  a genuinely separate dialog before building from scratch.
- Price-simulation tick interval → 2.5 seconds — **not attempted**; find
  the existing tick/refresh interval constant (search for the current
  simulation loop in `backend_server.py`, likely a `time.sleep(...)` in a
  background thread) before changing it, and confirm the current interval
  first rather than assuming.
- Admin Balance Details (`BalancePanel`) restructure — simplify the
  per-user balance-only adjuster and add a combined balance+trade-history
  drill-down view — **not attempted**.
- Full remaining "price-accuracy audit" across all market tabs (not just
  BIST 50) — **not attempted**; this needs either live comparison against
  the Fuzul reference or a specific list of wrong prices/symbols from the
  owner, not guesswork.

### 9.4 — Practical notes for whoever continues this (build pipeline, git)

- **Build pipeline that works on this Linux VM**, confirmed working this
  pass: `cd ~/mnt/ottoman/web-esube && npx vite build --outDir
  /tmp/dist_new && cp -rf /tmp/dist_new/. dist/`. Plain `npm run build` /
  `vite build` (default `outDir: dist`) fails with `EPERM` trying to empty
  `dist/` first, because this connected folder has **no delete permission**
  in this environment (`rm`/`rmdir`/`unlink` → "Operation not permitted";
  `device_request_delete_permission` for the whole folder was denied by an
  auto-mode classifier in an earlier pass and hasn't been re-requested).
  Building to a `/tmp` outDir sidesteps the delete requirement; copying
  over `dist/` in place with `cp -rf` overwrites existing files (allowed)
  without needing to delete the stale ones first (any orphaned old hashed
  asset files left in `dist/assets/` are harmless — they're just unreferenced
  dead weight, not bugs).
- **`node_modules/@rolldown` may only have the Windows binding** if
  `npm install` last ran on Windows — if `vite build` fails immediately
  with a rolldown/native-binding error, run `npm install --no-audit
  --no-fund` on the Linux VM first (npm registry is reachable even though
  Render/GitHub-raw/Bing are proxy-blocked from this environment).
- **`.git/index.lock` (and occasionally `.git/HEAD.lock`) get left behind**
  after almost every `git add`/`git commit` in this environment, because
  git's own end-of-operation cleanup calls `unlink()` on its lock file and
  that fails for the same no-delete-permission reason above — **the
  operation usually still succeeded** (check `git status`/`git log` before
  assuming failure), it's just the lock cleanup that failed. Workaround:
  `mv .git/index.lock .git/index.lock.stale.$(date +%s%N)` (rename, not
  delete — renaming is allowed) immediately before the next git command
  that needs the lock, in the **same** shell call if possible (each
  `device_bash` call is a fresh shell, and the stale lock can get
  recreated by a subsequent command if you check-then-act across two
  separate calls). There are now several `.git/index.lock.stale*` /
  `.git/HEAD.lock.stale*` files accumulated in `.git/` from this and prior
  passes — they're inert (git ignores anything not literally named
  `index.lock`/`HEAD.lock`) and harmless to leave; don't waste effort
  trying to delete them (same permission wall) unless the owner explicitly
  asks for `.git` cleaned up, which would need them to grant delete
  permission first.
- **This session never had GitHub push credentials** (no `gh` auth, no
  credential helper in the `device_bash` shell) — confirmed again this
  pass. Local `main` is at `4dae3a6`, `origin/main` is still at whatever
  it was before (`f65040e` or `0b8860a` depending on whether the owner
  pushed after the last handoff). **The owner must run `git push origin
  main` themselves** for any of this to reach Render.

### 9.5 — 2026-09-23, continued: backlog audit after the dist/ hotfix

After `ae92730` (the dist/ force-add hotfix) was confirmed live, the owner
asked for every remaining item in §9.3 to be finished, pushed, and tested.
This is the result of actually going through each one. **No code was
changed in this part of the pass** — every item below was either already
done, or is blocked on something that isn't a quick patch. `HEAD` is still
`ae92730`; nothing new needs building or pushing yet.

**Already done — verified in the current tree, no action needed:**
- **Active nav-tab highlighting.** This already exists and works. `App.jsx`'s
  `navActive(index)` drives an `.active` class on both the mobile bottom
  `navbar` and the desktop `sidebar` (`theme.css` lines ~232, ~1064:
  `.navbar button.active`, `.sidebar button.active`), and the public
  landing page nav uses `aria-current="page"` with matching CSS
  (`corporate.css` line 9: `.corporate-nav nav a[aria-current]`). The §9.3
  "not attempted" note was wrong — this was already built before this pass
  started. If the owner is seeing a page where the tab does *not*
  highlight, it's a specific bug on a specific screen, not a missing
  feature — name the screen and it can be looked at directly.
- **"Sözleşme Onayı" at registration.** Also already built:
  `legacy.jsx`'s registration form has a required checkbox ("KVKK aydınlatma
  metni, risk bildirimi ve e-şube sözleşmelerini okudum, kabul ediyorum"),
  submission is blocked client-side if it's unchecked
  (`if (!sozlesme) return setMessage(...)`), and `accept_kvkk` /
  `accept_distance_contract` / `accept_risk_disclosure` /
  `agreements_version` are sent to `/api/register`. This is separate from,
  and in addition to, the post-login Sözleşmeler page. Nothing to build.
- **Admin Balance Details.** Already reasonably simple: `BalancePanel` in
  `AdminConsole.jsx` is a searchable/sortable list of per-user balances
  (cash/blocked/T+2-pending/credit-limit) that expands per row, plus a
  "Hesabı aç ve düzenle" button that opens the full user detail (which
  includes transaction history). This already is the combined
  balance+history drill-down the ask described. If a specific layout is
  wrong, name it; there's no separate concrete restructure request beyond
  what's already there.

**Declined — same category as the T+2 refusal in §9.1, not built:**
- **"Price-simulation tick interval → 2.5 seconds."** Investigated fully:
  there is **no actual price-simulation mechanism anywhere in the codebase**
  — no background thread, no client-side jitter, nothing that generates a
  fake price movement. The only things that exist are: (1) a
  `system_settings` key `price_simulation` (defaults `"0"`), and (2) a
  labeled toggle for it in the admin UI ("Fiyat Simülasyonu" / "Piyasa
  saatleri dışında canlı fiyat simülasyonu" — i.e. simulating *live* price
  movement while the real market is closed). A prior pass added a
  server-side guard, `ALLOW_PRICE_SIMULATION` (env var, defaults `"0"`,
  `backend_server.py` line 134), that force-resets the setting back to
  `"0"` on every save unless that env var is explicitly `"1"` — and the
  generated `render.yaml` template ships it hardcoded to `"0"`. In other
  words: a previous agent built the toggle to match the Fuzul reference
  panel's *appearance*, deliberately never wired it to real fake-price
  logic, and then double-gated it off. That's not an oversight to "finish"
  — displaying fabricated price movement as if it were real, live market
  data, on a platform that takes real deposits from real people, is the
  same shape of problem as the T+2 mechanism declined in §9.1 (creating a
  false impression of market activity the customer has no way to detect).
  **This was not built this pass either, and the reasoning that applies to
  §9.1 applies here: don't implement it just because it's "another ticket"
  in a screenshot batch — it needs the owner to make the case for the
  *specific* mechanism with real justification, not just "the boss wants
  it," before any future agent touches `ALLOW_PRICE_SIMULATION` or adds an
  actual simulation loop.**

**Still blocked on missing specifics — not guessed at:**
- Katılım Tüm (XKTUM) tab fixes, and the remaining price-accuracy audit
  across all market tabs — no concrete discrepancy (which symbol, which
  price, compared to what) has been provided since the original 27
  screenshots, which this session no longer has access to. Needs either
  those images again or a specific named example.
- Portfolio card alignment CSS fix — no specifics given (which card, which
  screen, what's misaligned).
- Landing-page nav/ticker/full-width desktop layout — only a one-line
  paraphrase exists beyond the purple→blue swap already done; no concrete
  target layout to build against.
- News refresh cadence — the item-count cap was already lowered (40→28,
  earlier pass); no specific target cadence has ever been given, so
  `NEWS_MS` (currently 5 minutes, `store.js`) was left untouched rather
  than guessed at.

**Not started — flagged as its own project, not a quick patch:**
- **KYC identity-document upload flow** (front/back ID photo capture, a
  pending-review account state, blocking para yatır/çek until an admin
  approves the documents, plus the matching admin document-review queue
  UI). This needs new upload endpoints, file storage, account-status
  state-machine changes, and new admin UI — real surface area, on a
  financial app, right after a dist/ deploy incident caused by rushing a
  smaller change. Doing this correctly needs its own pass with room to
  actually test it end-to-end before it goes live, not a same-session
  bolt-on under time pressure. Next agent (or this one, in a following
  turn): treat this as a standalone task, scope it out first, and build
  it deliberately rather than fast.


## 2026-09-23 — Ticker viewport bug, contract scroll-gate, Kayıt Ol, admin lock cleanup

Commit `b6d80d9` (on top of `505066f`). User reported (angry, run-on message) 6 issues from a
"güncelleme v2" reference folder plus his own account-screen screenshots:

1. **Top price ticker "overlapping/disappearing in places"** — root cause identified as the
   classic mobile `100vh` bug: `.phone`/`.auth-phone` used `vh` units for height, which on real
   mobile browsers (address bar show/hide) don't match the actual visible viewport, so content
   near the edges can get clipped/squeezed. Fixed by layering `100dvh`/`94dvh` (dynamic viewport
   height) on top of the `vh` fallback. Also hardened `.auth-ticker` with `position:relative;
   z-index:2;flex:none` and `flex-wrap:nowrap` on the lane so it can never be shrunk/overlapped
   by flex reflow. Could not perfectly reproduce the exact overlap live (Chrome window resize in
   this sandbox doesn't actually change the rendered viewport), so this is the most defensible
   fix for the reported symptom — flag to re-check on a real phone if it recurs.
2. **Contract acceptance was a single inline checkbox** — user said (again) this needed to be a
   popup that can't be accepted until each document is scrolled to the end. Built `SozlesmeModal`
   in `src/legacy.jsx`: steps through KVKK Aydınlatma Metni → Risk Bildirimi → Çerçeve Sözleşmesi
   (pulled from the existing `CONTRACTS` array in `esube/contracts.js`, reusing the same
   head/bullet/paragraph block-parsing logic as the in-app `DocumentPage`). Each step's "Devam
   Et"/"Kabul Ediyorum" button stays disabled until `onScroll` detects the reader has hit the
   bottom. The old single checkbox is now a fake-checkbox trigger button that opens this modal;
   `sozlesme` state only flips true when all 3 steps are completed.
3. **No "Kayıt Ol" button next to "E-Şube Giriş"** in the corporate header — added. Threaded an
   `authMode` ("login"/"register") through `main.jsx` → `CorporateLanding`'s `openAuth(mode)` →
   `AuthScreen`'s new `initialMode` prop, so the new button opens straight to the register tab.
4. **Two password-show icons on the register password field** — confirmed via the Chrome a11y
   tree that our own DOM only ever renders one `<button>` toggle; the second eye is the browser's
   own native reveal icon (Edge's `::-ms-reveal`). Fixed by hiding it globally:
   `input[type="password"]::-ms-reveal,::-ms-clear{display:none}` in `style.css`.
5. **Account screen profile card was left-aligned** ("ismi ve profili ortaya al") — `.pcard` in
   `esube/Account.jsx`/`theme.css` changed from a 3-column grid (avatar | name | chevron) to a
   centered flex column; the chevron moved to an absolutely-positioned corner badge so it doesn't
   fight the centering.
6. **"Yönetici koruması" in admin panel** — traced to leftover dead UI: the step-up
   re-authentication itself was already disabled in an earlier pass (`useLock().ensure()` is a
   no-op that always resolves `true` — see the comment at `AdminConsole.jsx:33`), but the visible
   "Yönetici kilidi kapalı" status pill + "Kilidi aç" button + `LockDialog` were never removed, so
   the panel still *looked* gated even though it wasn't. Removed that dead JSX entirely
   (`ac-lockbar` div + the `lock.soru && <LockDialog/>` render). Left the ~24 `await ensure()`
   guard calls in place since they're harmless no-ops — not worth touching 24 call sites for a
   pure no-op removal.

Also cleaned up 6 stale pre-hotfix `dist/assets/index-*.{js,css}` bundles that were still
tracked in git but no longer referenced by `dist/index.html` (accumulated across several earlier
`git add -f` build commits without ever being pruned).

**Not addressed this turn / still open if the user brings it up again:** the exact repro for the
ticker overlap (fixed defensively, not confirmed against the real complaint); Sözleşme Onayı
matching Fuzul's reference more closely beyond the scroll-gate; "ilk açılış rengi mavi olsun".

Standing rule still in force: **git add -f is required for any new file under `dist/`** —
`git add -A` will not pick up new files in a gitignored directory, only modifications to files
already tracked there.

## 2026-09-23 (later same day) — Full re-verification pass of all 27 "güncelleme v2" screenshots

Cem asked to double-check every request in the "güncelleme v2" screenshot folder against the
live code, with "hepsini yap eksik kalmasın" (do all of them, nothing left incomplete). Read all
27 images fresh via the device bridge rather than trusting the task list carried over from the
prior pass — that task list turned out to undercount how much was already done, and (separately)
a stale in-container mirror of `CorporateLanding.jsx` almost caused a duplicate/wrong edit before
switching to `device_bash cat`/`sed` for every read in this pass. **Lesson: never trust the
`Read` tool on a repo file that's mounted via the device bridge — it can silently serve a stale
cached copy. Always read repo files with `device_bash cat`/`sed`/`grep` instead.**

Confirmed ALREADY DONE (no change needed), beyond what earlier handoff sections already listed:
- Corporate landing page (`src/CorporateLanding.jsx` + `corporate.css`): full-width nav, separate
  "Kayıt Ol" / "Giriş Yap" buttons, blue (#2f72e8) theme, logo + "Ottoman Yatırım" brand text —
  all present.
- Admin panel top-left branding: logo + "Ottoman Yatırım" text already in place
  (`AdminConsole.jsx` ~line 2109).
- Admin step-up removal: already a no-op (`useLock().ensure()`) and the dead lock-bar UI was
  already stripped in the prior pass documented above.
- Password strength meter (Zayıf/Orta/Güçlü, register blocked until "güçlü") — `legacy.jsx`
  `sifreGucu`/`SifreGucMetre`, matches backend's `password_is_strong` 4-criteria check exactly.
- `LoadMoneyPanel` ("Para Yükleme" — per-customer +/- bakiye tool): gerekçe field already
  optional, matching the boss's explicit "ama gerekçe olmasın kesinlikle".
- Portfolio admin edit modal already has "Toplam maliyet" + "Güncel değer fiyatı" optional
  override fields (`PortfolioPanel` in `AdminConsole.jsx`).
- Admin user-detail "Hareketler" list already includes real stock buys/sells (`trade_buy`/
  `trade_sell` are written to `user_transactions` on every real order and show up there
  unfiltered) — no separate "hisse geçmişi" feed needed.
- The T+2 settlement system (`t2_settlements` table, `create_t2_settlement`/`settle_due_t2`/
  `credit_sale_proceeds` in `backend_server.py`) is legitimate: it only ever holds the actual
  cash proceeds of a real stock **sale**, auto-releases on its own real settlement date
  regardless of any admin action, and admin can only release it *early*, never delay it further
  or lock unrelated balance. Confirmed clean; left untouched.

Fixed this pass (see commit "Admin panel and Account KYC gaps from güncelleme v2 review"):
1. **Admin "Bakiye Detayları" → user detail screen** (`UserEditor` in `AdminConsole.jsx`): removed
   the raw "Bakiye" section (İşlem: eşitle/ekle/düş/kredi limiti + Tutar + Gerekçe + "Bakiyeyi
   sıfırla" + "Bakiyeyi uygula") per the boss's literal instruction ("BU ÇIKMASIN ... SADECE
   BURASI ÇIKSIN ... Portföy ... Bİ DE ŞU HAREKETLER ÇIKSIN"). The `ac-stats` summary bar
   (Nakit/Bloke/Kredi/Pozisyon) plus the existing Portföy and Hareketler sections already satisfy
   what's supposed to remain. Manual balance corrections still work through "Para Yükleme" and
   the deposit/withdraw approval queues, which were untouched.
2. **Bank account cards**: added an "Aktif" badge (`bk-aktif`, green) alongside the existing
   "Pasif" one, matching Fuzul's reference pill style on both states.
3. **News feed cap**: `tools/news_feed.py` `latest_news()` now slices to `[:30]` (was unbounded);
   the 10-minute refresh interval (`NEWS_MS` in `store.js`) was already correct from an earlier
   pass.
4. **Account page** (`src/esube/Account.jsx`): renamed the "İşlem geçmişi" tile to "Bakiye
   Geçmişi" (boss's literal instruction: "İşlem geçmişi yerine bakiye geçmişi eklenecek"); added
   `.tile-passive` (dimmed/grayscale) styling to the Para yatır / Para çek / Banka hesaplarım
   tiles when `!kycApproved`; added a red `.kyc-banner` above "Hesap İşlemleri" reading
   "Hesabınızı onaylamak için kimlik doğrulama yapmanız gerekmektedir." when not approved. The
   click-through notice text ("Kimlik Doğrulaması Olmadan İşlem Yapılamaz") was already correct
   from before — only the passive *visual* state and the banner were missing.
5. **KYC document upload**: reworked from "must pick all three files then submit together" (old
   `api/profile/documents` required all of identity_front/identity_back/selfie in one multipart
   POST or 400'd) to independent per-document upload — front and back (and selfie) can now be
   sent separately, each with its own live status, matching Fuzul's reference ("Arka Yüz
   Bekleniyor" while only the front is uploaded). Backend `api_upload_documents` now only
   requires whichever doc_types are actually present in the form; added `has_front`/`has_back`/
   `has_selfie` + a computed `kyc_missing_label` (e.g. "Arka Yüz Bekleniyor") to
   `/api/admin/users`, surfaced as a badge on the admin "Onay Bekleyenler" cards.

Explicitly re-declined, unchanged (same reasoning as §9.1, re-requested again this pass in very
explicit detail — see the "MÜŞTERİ YATIRIM YAPTIĞINDA..." and "Fiyatlar 2.5 sn bir..." messages):
- Forcing a customer's *entire* balance into an indefinite, admin-only-releasable "T+2" hold the
  instant they make any single trade (buy or sell), as opposed to the real T+2 system above which
  only ever holds actual sale proceeds and auto-releases on schedule. This is the same
  fund-trapping pattern declined in §9.1 and remains declined.
- Simulated ±0.10% price jitter every 2.5 seconds when no real quote has arrived. `price_simulation`
  is still a dormant settings key that gets force-reset to `"0"` server-side unless the
  `ALLOW_PRICE_SIMULATION` env var is set; no jitter-generating code exists or was added.

Not implemented (lower priority / cosmetic, flagged for Cem rather than guessed at blind):
- Registration's inline KVKK/risk-bildirimi consent checkbox works and gates account creation
  today, but isn't a separate full-screen "Sözleşme Onayı" popup like Fuzul's reference. Low
  value to change since the compliance gate already exists; deferred.
- A few px of vertical alignment on the portfolio summary donut chart vs. the balance labels next
  to it (Derviş Hoca's screenshot with the red annotation circles) — cosmetic only, needs visual
  QA against the real reference rather than a blind CSS guess.

Build: `npx vite build --outDir /tmp/dist_new && cp -rf /tmp/dist_new/. dist/`, verified the new
markers ("Bakiye Geçmişi", the KYC banner string, `tile-passive`, `kyc_missing_label`,
`bk-aktif`) are present in the built `dist/assets/index-*.js`/`.css` before committing. Cem still
needs to run `git push origin main` himself (no push credentials in this environment).

## 2026-09-23 (later) — 11-item angry-screenshot pass (logo, KYC selfie, auth width, sell color, news photos, portfolio alignment, Katılım referral, admin gerekçe removal, Bakiye Geçmişi money moves)

Cem sent 6 screenshots and 11 numbered complaints, several of them re-flagging things from the
prior pass that he felt were still wrong or half-done. Went through every item individually
against the real code via `device_bash`, fixed what was actually still broken, and verified with
a fresh build. All 11 items landed in a single commit: "Katılım referans yönlendirme, admin
gerekçe zorunluluğu kaldırma, bakiye geçmişinde para hareketleri" (`0e3627a`).

Status of all 11 items:

1. **Logo removed from in-app UI, favicon-only** — removed the 5 remaining inline
   `<img src="/logo-icon.png">` usages: `App.jsx` (mobile top bar `brand-word` + sidebar
   `brandmark`), `legacy.jsx` (`AuthScreen` `auth-logo brand`), `CorporateLanding.jsx` (header
   brand link). Favicon (`public/icons/favicon-32.png`) already used the same crescent-moon+star
   icon and was untouched — no favicon-side change needed. All in-app spots now show plain text
   "Ottoman Yatırım".
2. **"Kimlikli Selfie" KYC requirement removed** — `REQUIRED_IDENTITY_DOCUMENTS` in
   `backend_server.py` now `{"identity_front", "identity_back"}` (was including `"selfie"`);
   `api_upload_documents` no longer accepts/expects a selfie; `App.jsx` `KYC_DOC_LABELS` and the
   `KycUpload` intro text no longer mention it. (Note: `backend_server.py` still has a
   `"selfie": "Yüz Doğrulama"` label string in one historical-data label dict — harmless, kept
   only so any pre-existing old `documents` rows with `doc_type='selfie'` still render a label
   instead of the raw key; does not re-enable the requirement.)
3. **Desktop login/register width** — traced the CSS cascade: `extra.css`'s
   `@media (min-width:761px)` block had `.auth-screen{max-width:540px}`, which was overriding the
   more specific `.auth-phone{max-width:1180px}` rule due to load order, not specificity. Changed
   `.auth-screen`'s desktop max-width to `720px`.
4. Same as #1 (duplicate complaint) — done.
5. **Sell/red color** — the `--red`/`--rose` CSS custom properties in `theme.css` were a
   pink-leaning hue (`#d95577`/`#fce9ef` light, `#d6657f`/`#3a2631` dark). Changed to a proper red
   (`#e5484d`/`#fdeaea` light, `#ff5c5c`/`#3a2323` dark) at the variable level so it cascades to
   every sell-related usage (badges, price-down indicators, trade sheet, error text) at once
   rather than patching one button.
6. **News**:
   - *Photo-less articles*: found the actual bug — `market_news(market)` in `backend_server.py`
     had a 3rd-tier fallback (`items = fetch_market_news(market)`, unfiltered) after the two
     photo-filtered tiers had already failed, which let photo-less items through. Removed that
     fallback line entirely; only photo-having items can appear now, at the cost of an empty tab
     when no photo article is available for a market.
   - *"3 hours stale" freshness complaint*: audited every refresh-interval constant —
     `NEWS_REFRESH_SECONDS=900`, `MARKET_NEWS_REFRESH_SECONDS=600`,
     `YENILEME_SANIYE=600` — all already correctly 10-15 min, not a bug in the code. Tried to
     empirically reproduce the staleness by running `market_news.sekme_haberleri()` directly via
     `device_bash python3` from Cem's Windows machine; **all 13 upstream news sources failed with
     `URLError`** from that machine (likely a local network/firewall restriction on that specific
     path), so this could not be used to prove or disprove the live Render server's actual
     fetch behavior. **Unresolved**: if the news is still showing 3-hour-old articles on the live
     site after this deploy, the likely next step is checking Render's own outbound network / the
     upstream RSS sources' actual response times from Render's IP, not the refresh-interval config
     (which is already correct).
7. **Portfolio donut/label alignment** — `.pf-alloc` in `theme.css` was `align-self:end`, which
   bottom-aligned the donut+legend within its `grid-row: 2 / span 3` cell, visually detaching it
   from the "Toplam değer" line at the top of the same row span. Changed to `align-self:start`
   with a small `margin-top` so it lines up with the top of the cash/gain summary instead.
8. **Katılım (BIST XKTUM) → referral-only, list stays visible with live prices** — this was the
   most involved fix. Previously Katılım was fully tradable (confirmed correct in an earlier,
   now-superseded reading of an older screenshot); this message explicitly says it should behave
   like Halka Arz/Fon/Döviz (referral-only) but with the list still shown (unlike Halka
   Arz/Fon, which hide the list entirely). Implementation:
   - `market.js`: `listFor()`'s `PARTICIPATION` case now tags every returned instrument with
     `kind: "participation"` (same pattern as IPO); removed `PARTICIPATION` from
     `TRADABLE_MARKETS`; added a `[PARTICIPATION]` entry to `MARKET_CONTACT_TEXT`.
   - `App.jsx`: added `participation` to the `REFERRAL_ONLY` map (the central `openTrade`
     function checks `REFERRAL_ONLY[stock.kind]` before ever opening the trade sheet — this is
     what makes the block work from **every** entry point, including the "Tüm Hisseler"
     `StockPicker` search sheet, not just the Home tab's own click handler); fixed the Home-tab
     wrapper's `marketTab → kind` ternary (was hardcoded `6→fund, 5→ipo, else→currency` with no
     branch for Katılım, which would've mislabeled the referral message as "Döviz işlemleri");
     added `PARTICIPATION` to the `market.js` import list.
   - `StockPicker` (in `App.jsx`) already had an early-return that hides the list entirely for
     `marketTab === IPO || marketTab === FUNDS` — deliberately did **not** add PARTICIPATION to
     that check, so Katılım's list stays visible and searchable, per the boss's explicit "tüm
     hisseleri eklenecekti" instruction.
   - **Price accuracy**: confirmed Katılım/XKTUM is just a static code whitelist
     (`S_XKTUM` in `market.js`) filtering the *same* live `stocks` array every other BIST tab
     reads from — there is no separate/stale data source for Katılım, so "hep güncel doğru olması
     gerekiyordu" was already structurally satisfied once the filter/tagging above was in place.
9. **Bakiye Geçmişi shows admin-approved deposit/withdraw requests, admin note optional** —
   `admin_money_action` in `backend_server.py` already wrote a `user_transactions` row
   (`transaction_type: "deposit"/"withdrawal"`) on every approval, but (a) the frontend
   `Portfolio.jsx` "Geçmiş" tab was filtering the transaction list down to
   `trade_buy/trade_sell/stock_sale` only — deposits/withdrawals never rendered there at all —
   and (b) the transaction's `note` was pulled from the user's own request note, not the admin's.
   Fixed both: added a `moneyMoves` memo + a new `MoneyMoveCard` component (shows "Para
   Yatırma"/"Para Çekme", an "Onaylandı" badge, the note if present, signed amount, date); merged
   it with the existing stock-trade list into one chronologically-sorted `gecmisAkisi` feed shown
   under the "Tümü" filter (the "Alış"/"Satış" filter chips stay stock-trade-only, since those
   labels mean buy/sell of a stock, not a cash movement). Backend: `admin_money_action` now writes
   the transaction's `note` from the admin's `reason` field (falling back to the existing generic
   "... talebi onaylandı" text when the admin leaves it blank) instead of echoing back the user's
   own request note — this is what "admin not ekleyebilsin" actually needed.
10. **All mandatory admin "gerekçe" requirements removed** — found and removed 3 separate
    server-side 8-character-minimum gates: `api_admin_action` (`entity in {"orders","money"}`,
    used for both order approval/rejection and the Para Talepleri queue) and
    `api_admin_document_action` (KYC document reject/retry). All three now accept an empty
    `reason`/`note`. Frontend: removed the matching client-side blocking checks and
    "(zorunlu, en az 8 karakter)" labels in `AdminConsole.jsx`'s `ApprovalList` (documents),
    `OrdersPanel`, and `MoneyPanel` — all three note fields are now genuinely optional
    ("(opsiyonel)") rather than merely appearing optional while still blocking submission.
11. Meta-complaint about thoroughness — addressed by re-reading each of the 6 screenshots against
    the live `device_bash`-read code before touching anything (not from memory of the prior
    pass), and by re-testing every numbered item against the actual file content rather than
    assuming an earlier pass's notes were still accurate.

Explicitly re-declined again this pass (unchanged, will keep being declined regardless of
rephrasing — see §9.1): the T+2 fund-lock-on-any-trade mechanism, and the ±0.10%/2.5s fake price
jitter. Neither was requested this time, but flagging again per standing instructions.

Build: `npx vite build --outDir /tmp/dist_new --emptyOutDir && cp -rf /tmp/dist_new/. dist/`.
Verified markers in the built bundle before committing: `"Katılım hisse işlemleri"`, `"Bakiye
Geçmişi"`, `"Onaylandı"`, `max-width:720px` in the CSS, and that `"Gerekçe kısa"` (the old
mandatory-reason error string) no longer appears anywhere in the new JS bundle. `dist/index.html`
was confirmed to reference the freshly-built hashed filenames. **Cem still needs to run
`git push origin main` himself — no push credentials in this environment.**

Not re-verified live on Render yet (same stale-deployment caveat as the prior pass — Render did
not appear to auto-redeploy promptly last time even after a confirmed-matching push): after Cem
pushes, worth a live check that the new bundle hash is actually served before assuming any of
this is visible to real users.

## 2026-09-23 (yet later) — favicon/SEO stale-cache fallout, Service Worker fix, and a new 6-item request

Between the pass above and this one, Cem reported (angrily, across many screenshots) that none of
the favicon/logo/SEO work looked live. Investigation split this into genuinely separate problems
that had all been conflated as "nothing you did is live":

- **Real bug, fixed** (`d072526`): `favicon.svg` had the wrong image (mosque skyline) baked in
  under 44KB of AI-generator C2PA metadata, and `index.html`/`robots.txt`/`sitemap.xml` had the
  wrong canonical domain (`ottoman-eggb.onrender.com` instead of `ottomanyatirim.com`) hardcoded
  in ~27 places (canonical, hreflang, OG/Twitter tags, JSON-LD). Rebuilt all icon files from
  `logo-icon@2x.png` and fixed every domain reference.
- **Real bug, fixed** (`ceefc81`): the Service Worker (`public/sw.js`) was the actual cause of
  "still shows old content after a confirmed-good deploy" — confirmed live via
  `navigator.serviceWorker.getRegistrations()` showing an active worker while `WebFetch`
  (no cookies/no SW, independent of the browser) proved the server was already serving the fresh
  build. Bumped `SURUM` to `v3` and changed the navigate handler to retry once after 400ms before
  falling back to the cached shell, instead of falling back on the first hiccup.
- **Not a bug**: a transient `ERR_NAME_NOT_RESOLVED` on Cem's own network, and a "no separate
  branch / deploy not happening" theory that didn't hold up (`git branch -a` / `git ls-remote`
  showed only `main`, correctly configured) — verified with hard evidence rather than deferring to
  either theory, then reported back exactly what did and didn't check out.

**IMPORTANT — still unpushed as of this writing**: `ceefc81` (SW v3) was never pushed by Cem
before the next request came in. It and everything below are sitting on local `main`, one and two
commits ahead of `origin/main`. **Cem must run `git push origin main` himself** — this environment
has no push credentials and never pushes on its own, even though `device_bash` runs directly on
his machine with his own git identity.

### New 6-item request, all done in commit `df63cfb`

1. **BIST 50 tab moved between BIST 100 and BIST 30.** Renumbering the `BIST/BIST100/.../BIST50`
   constants in `market.js` would have touched every switch/Set/map that keys off them, so instead
   added a separate display-order array, `MARKET_TAB_ORDER = [BIST, BIST100, BIST50, BIST30,
   PARTICIPATION, IPO, FUNDS, CURRENCY]`, consumed only by `Home.jsx`'s tab rendering
   (`HOME_MARKETS`). Also added `NEWS_TAB_ORDER` (same order, with `DIVIDEND` kept in its original
   slot since Haberler still shows Temettü as a filter) and wired it into `News.jsx` for
   consistency, since it's the same set of market tabs.
2. **"Öne çıkan yükselenler/düşenler" (gainers/losers) extended.** Previously only rendered on the
   "BIST Tüm" tab. Now also computed and shown on BIST 100, BIST 30, and BIST 50 (Katılım/IPO/Fon
   tabs unaffected — those stay as pure lists/referral notices, they don't have a meaningful
   gainers/losers concept the same way).
3. **New "Bakiye İşlemleri" section on the Account screen**, inserted between "Hesap İşlemleri"
   and "Diğer": Para yatır, Para çek, Banka hesaplarım (moved here from Hesap İşlemleri, since it's
   a balance-related action), Bakiye Geçmişi. This groups all money-movement entry points in one
   place instead of splitting them across two unrelated sections.
4. **Deposit/withdraw admin-approval-message flow** — already working (this is the item #9 work
   from the pass before last: admin-approved balance history with an optional admin note). Cem's
   screenshot of it showed it working correctly; no further change needed here.
5. **Admin panel "İşlem Notu \*" (required) screenshot** — checked exhaustively
   (`grep -rn "İşlem Notu" src/ tools/`, zero matches anywhere in the current source). The current
   "Bakiye Yükle" modal already shows "Gerekçe (opsiyonel)", not a required field. This screenshot
   almost certainly reflects a stale cached copy of the admin panel in Cem's browser from before
   item #10 of the pass-before-last removed the mandatory-reason gate — worth trying an incognito
   window or clearing the Service Worker/cache for the admin panel's origin specifically.
6. **Copyable IBANs in the admin panel.** Added a small `KopyaBtn` component (reuses the existing
   `kopyala()` clipboard helper, shows a brief "Kopyalandı" confirmation) and wired it into the
   three places IBANs appear in `AdminConsole.jsx`: the platform's own bank accounts
   (`BankaKarti`), the "Müşteri IBAN'ları" list, and — the one that actually matters for "kolayca
   transfer yapabilelim" — each pending withdrawal request in the Para Çekme queue, so the admin
   can copy the customer's IBAN with one click when sending the transfer.

Build verified clean (`npx vite build`, no errors/warnings besides the pre-existing >500KB chunk
size notice). Markers checked in the new bundle: `"Öne çıkan yükselenler"` and `"Kopyalandı"` both
present exactly once, only in the newly-built `index-D6J8fi5Z.js` (not the stale bundles still
sitting untracked-by-reference in `dist/assets/` from earlier builds — `dist/index.html` correctly
points at the new hash). Committed as `df63cfb`.

**Cem still needs to `git push origin main`** to get `ceefc81` and `df63cfb` onto GitHub/Render.

## 2026-09-23 (still later) — undo a wrong call, redesign two admin screens (`c21a8ac`)

Cem pointed out two real mistakes from the previous pass, both now fixed:

1. **The new "Bakiye İşlemleri" section in Account.jsx was a mistake.** I hadn't noticed the
   Account screen already has a quick-action tile row at the top (Para yatır / Para çek / Banka
   hesaplarım / Bakiye Geçmişi) — the settings-list section I added below duplicated all four of
   those. Removed it; "Banka hesaplarım" is back in the "Hesap İşlemleri" list where it was
   before (it was moved out by mistake).
2. **Bakiye Geçmişi didn't show the balance after each transaction, and the admin panel didn't
   match the reference panel Cem sent screenshots of.** Fixes:
   - `Portfolio.jsx`: the transactions table already stores `balance_after` per row (backend
     always computed it, just wasn't surfaced) — added a "Yeni: <bakiye>" line under each
     deposit/withdrawal history card using that existing field.
   - `AdminConsole.jsx`: renamed "Para Yükleme" → **"Bakiye Yönetimi"** (matches the reference's
     name for that screen) and added a sort control (İsim / Bakiye yüksek-düşük) — the screen
     itself (search + per-customer Bakiye Yükle/Çıkar buttons) already matched.
   - `AdminConsole.jsx`: replaced the old per-document "Belgeler" list with a per-**user** KYC
     queue, **"Kullanıcı Doğrulama"**: an icon count bar (toplam/inceleniyor/onaylı/reddedilen/
     eksik belge, matching the reference's people/clock/check/x/question icons), a search box,
     and a card per user (avatar, name, id, status badge, phone, location) with a "Belgeleri
     İncele" button that opens a modal listing that user's documents with real Onayla/Reddet
     actions (previously this button in other panels just opened the generic user editor).
   - Note: "Onay Bekleyenler" (a different, pre-existing screen covering pending users/orders/
     money together) was left untouched — it's one of the reference panel's original 14 screens
     and serves a different, broader purpose than the new per-user KYC queue.
   - `extra.css`: added `.ac-select` (the new sort dropdown) and `.ac-kyc-sayaclar` (the icon
     count bar) styles; no changes to existing badge colors (`.ac-durum.onay/bekle/incele/ret`
     were already exactly right for this — green/amber/blue/red).

Build verified clean. Bundle markers checked: `"Bakiye İşlemleri"` no longer appears anywhere in
the new JS bundle; `"Bakiye Yönetimi"`, `"Kullanıcı Doğrulama"`, `"Belgeleri İncele"` all present.
`dist/index.html` updated to the new hash. Committed as `c21a8ac`.

**Cem still needs to `git push origin main`.**
