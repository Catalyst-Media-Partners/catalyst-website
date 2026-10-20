# INFUSED Las Vegas direct-purchase website update

## Release objective
Make the public INFUSED site describe the May 13–14, 2027 event at the Las Vegas Convention Center and offer a prominent self-service booth purchase path.

## Scope
- Production source branch: `infused-show` (not Catalyst `main`).
- Keep the 14 existing pages, images, layout, forms, canonical metadata, existing redirects, and separated Cloudflare Worker.
- Show verified event dates/venue on homepage, opportunity page, contact page and shared footer.
- Promote the already-used Map D registration flow `https://shows.map-dynamics.com/infusedlv2027/?register` from primary navigation, homepage hero, opportunities, and contact.
- Add starting booth prices from current Las Vegas sales materials: inline 10x10 from $3,000, corner 10x10 from $3,500.
- Add inert `data-track="lv27_booth_purchase"` and `data-cta-position` attributes to facilitate future analytics wiring. These attributes **do not** themselves record clicks or preserve UTMs across third-party checkout.
- Retain existing Jotform contact option for assisted exhibitor sales.
- Add PR-only QA without changing production deployment authorization.

## QA before approval
- GitHub PR `validate`: `npm run build`, `npm run check`, `node scripts/verify-cloudflare.mjs`.
- Manual mobile/desktop smoke on preview and production after approved owner merge.
- Confirm the exact Map D registration URL still permits live booth selection, discount application and Stripe Checkout. This source change does not alter Map D inventory, discount codes or payment settings.
- Production deployment remains the existing owner-gated `infused-show` GitHub workflow. This PR does not merge or deploy itself.

## Follow-ons not in this change
Full first-party UTM/click capture, Map D-to-Stripe attribution, purchase conversion analytics, SEO performance and discount automation need independent implementation and testing.
