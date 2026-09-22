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

## 8. Immediate next tasks

1. **Rotate the leaked `RENDER_API_TOKEN`** hardcoded in
   `tools/backend_server.py` (3 call sites, see §3) — revoke it in the
   Render dashboard, generate a new one, set it as an actual `RENDER_API_TOKEN`
   env var on the Render service, and remove the hardcoded fallback default
   from source. This needs the owner's action on the Render side; flag it
   explicitly rather than silently patching only the code.
2. Review the unstaged working-tree diffs listed in §6 — decide with the
   owner whether they're safe to commit, discard, or need investigation
   (they predate this handoff and weren't produced by any feature work
   described here).
3. No other explicit feature request from the owner is currently open. Wait
   for the next request; when screenshots are attached, treat them as the
   literal pixel-accurate spec, not inspiration.
4. When verifying anything live going forward: this cloud sandbox's network
   cannot reach Render/GitHub/Bing directly (proxy 403s), and neither can
   the mounted Linux VM's `curl`. Verification needs to happen through
   whatever channel in the *current* session actually has open egress —
   check what's available before assuming either the old
   desktop-commander/zip-staging pipeline or a direct `curl` will work, and
   don't report something as "confirmed live" without an actual successful
   fetch against the real domain.
