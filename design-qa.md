**Design QA**

- Source visual truth: `C:\Users\Cem\AppData\Local\Temp\codex-clipboard-eae8930f-bedd-4340-9205-713576451fdd.png`, `C:\Users\Cem\Desktop\ottoman-push\fuzul-render.png`, and the Fuzul Yatirim landing-page section structure.
- Implementation screenshots: `qa-final-landing-desktop.png`, `qa-final-landing-mobile.png`, `qa-final-news-desktop.png`, `qa-final-news-mobile.png`, `qa-final-portfolio-desktop.png`, `qa-final-portfolio-mobile.png`.
- Viewports: 1440 x 950 desktop and 390 x 844 mobile at device scale factor 1.
- State: landing page; authenticated dark-mode news page; authenticated dark-mode portfolio page.

**Full-view comparison evidence**

- Portfolio summary content, legend, tabs, search and position rows are fully visible. The summary and return chart are in a horizontal scroll-snap carousel instead of a vertical stack.
- Dark mode uses consistent screen, card, border, text, modal and navigation tokens. Computed values: screen `rgb(15, 18, 26)`, cards `rgb(23, 28, 39)`, primary text `rgb(247, 248, 255)`.
- News uses real local editorial imagery, clear source labels, larger headlines, dates and a full image treatment in detail view. All 24 rendered thumbnails loaded successfully in both viewport tests.
- Landing follows the reference information order: hero, investment services, metrics, reasons to choose, testimonials, regulators and partners, discovery links, conversion callout and corporate footer.
- Desktop and mobile body overflow measured 0 px across landing, news and portfolio.

**Focused region comparison evidence**

- Portfolio card: legend bottom remains inside card bottom on desktop and mobile; card remains inside carousel bounds.
- News list: image crops use `object-fit: cover`, source badges remain legible and headline wrapping stays within the card.
- Landing metrics: desktop cards use a 2 x 2 grid so large values no longer collide.

**Comparison history**

- P1: portfolio legend was clipped by the desktop grid row. Fixed with an explicit carousel row span and stable card height; post-fix evidence is `qa-final-portfolio-desktop.png`.
- P1: dark mode left cards and text in light-theme colors. Fixed with shared dark tokens and comprehensive component selectors; post-fix evidence is `qa-final-news-desktop.png` and `qa-final-portfolio-desktop.png`.
- P1: news used synthetic color thumbnails and weak typography. Replaced with three project-local editorial image assets and rebuilt featured/list/detail presentation; post-fix evidence is `qa-final-news-desktop.png` and `qa-final-news-mobile.png`.
- P2: landing metric values collided in a dense four-column row. Fixed with a 2 x 2 metric grid; post-fix evidence is `qa-final-landing-desktop.png`.

**Required fidelity surfaces**

- Fonts and typography: passed; hierarchy, wrapping, weights and line heights are readable at both tested widths.
- Spacing and layout rhythm: passed; no clipped persistent controls or horizontal page overflow.
- Colors and visual tokens: passed; Ottoman violet, neutral surfaces and dark-theme contrast are consistent.
- Image quality and asset fidelity: passed; local 1200 x 900 JPEG assets are sharp and correctly cropped.
- Copy and content: passed; Ottoman branding is retained throughout the Fuzul-derived information architecture.

**Primary interactions tested**

- Landing to E-Sube login, login, theme toggle, News navigation, Portfolio navigation, horizontal carousel geometry and responsive layouts.
- Browser console and page errors: none.

final result: passed
