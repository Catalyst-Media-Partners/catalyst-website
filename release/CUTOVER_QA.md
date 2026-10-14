# INFUSED v1b.2 cutover QA | 2026-10-14

- Trusted existing v1b.1 source baseline: `npm run build`, `npm run check`, `node scripts/verify-cloudflare.mjs` passed BEFORE modification.
- Migration change: only dedicated `src/worker.mjs` verified 301 legacy redirects and extended integration tests; no changes to `build.mjs`, source copy, visual CSS, JSON, imagery, payment integrations, or protected Catalyst routing.
- Updated source version to `1.0.2-b1`; original approved 14 pages and static media unaffected.
- After changes: `npm run build`, `npm run check`, and Worker mock integration tests passed: 14 pages, 144 linked destinations, 53 verified internal assets/references, 7 redirect mappings, www 308, robots policies, canonical URLs, and 14-URL sitemap.
- Online before the code change: all 14 standalone Worker preview routes loaded as HTML with image references and non-404 content. The currently authoritative GoDaddy DNS still serves the old site.
- DNS investigation: Cloudflare rescan and live resolver agree on A, NS, CNAMEs, DMARC, MX absence and DS absence (see docs/DOMAIN_CUTOVER.md).
- Not yet tested: production hostname TLS/render after registrar delegation, legacy privacy URL, legacy hosted buyer PDF, the source of every possible unindexed WordPress URL, real mobile Safari/Firefox.
- Status: Worker-only code ready for controlled deployment, domain delegation remains a separate registrar operation.
- Rebuilt an unmodified v1b.1 source extraction and compared all 37 generated public files byte-for-byte with v1b.2 output: PASS; no visible website asset or HTML changed.
