# v1b.0 quality checks

**Scope:** New independent full development baseline sourced solely from the single supplied invitation HTML. Not a production launch.

| Check | Result |
| --- | --- |
| Source provenance | Original HTML preserved byte-for-byte (SHA-256 d7ae64fd71b3c23f0c9f298fa6d29111ddc895693830d4fad7651d4196fd61bb) |
| Homepage copy | 7,352 visible body characters identical to original |
| Visual similarity | Pixel-identical at 1440, 1024, 768, 390px (Chromium in-memory rendering) |
| Content/asset integrity | 12 original sections and all 21 original embedded WebP assets preserved |
| Subpages | 13, each using only original section/card content |
| Browser responsive checks | 40 route/viewport renders (1440/1024/768/390/320), plus 512/360/300px reflow checks |
| Overflow | No document-level horizontal overflow detected at 1440/1024/768/512/390/360/320/300px |
| Navigation | 14 total routes, 144 internal references, 53 local assets checks, original external links retained |
| Keyboard | Mobile last navigation item can receive focus and scroll into view |
| Syntax/structural | `npm run build` and `npm run check` passed; one H1 per generated page; no duplicate IDs; preview robots present |
| HTTP | Python static server returned 200 for all 14 routes, CSS and image, under both Live Server root conventions |
| JavaScript | None required by the original source or added here; zero page script errors |
| Clean extraction | Rebuilt generated public tree compared against archive baseline during packaging |

**Limitations:** Chromium was tested through in-memory browser rendering. Automated browser navigation to localhost is restricted in this environment; static local HTTP responses and resolution of all internal links were verified separately. No independent WCAG 2.2 AA audit, market claims verification, image rights audit or live checkout/form test was performed.

**Pre-production decisions:** Confirm market claims and event/program specifics, image permissions, the external CannaCon exhibitor request and Map Dynamics registration URLs, legal/privacy requirements and event dates. Preview must remain `noindex` until production approval.
