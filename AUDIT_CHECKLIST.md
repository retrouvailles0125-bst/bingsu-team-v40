# V40 parity and production checklist

Status codes: PASS = verified from code; DEMO = V40 original behavior only; NOT DONE = production integration missing; NOT TESTED = no browser/database execution.

| Check | Status | Evidence / limitations |
|---|---|---|
| Original V40 HTML preserved | PASS | SHA-256 matches uploaded file; see SHA256SUMS.txt |
| Exact V40 layout, CSS and markup at `/` | PASS (source identity) | Root route returns original HTML unchanged; visual browser comparison NOT TESTED |
| Exact V40 client JavaScript behavior at `/` | DEMO | Same JS source; runtime interaction NOT TESTED |
| V40 menu and tabs | DEMO | Original V40 client script is intact |
| Donate form, QR and bill upload | DEMO | Browser-local data only; not safe for real transfers |
| Admin reconciliation and settings | DEMO | Browser-local demo password; not secure |
| Lucky Star animation and gifts | DEMO | Browser-local random draws, not authoritative server transactions |
| Trade/Gift offers and inventory | DEMO | Browser-local only; not safe for concurrent users |
| Love letters, public/private | DEMO | Private letters not securely private in demo |
| Account/login | DEMO | LocalStorage password hashes; not Supabase Auth |
| Supabase Auth and RLS integrated with V40 UI | NOT DONE | Needs replacing V40 data layer without altering DOM/CSS |
| Private bill storage with signed URLs | NOT DONE | Needs integration and access tests |
| Server-atomic donation verification, draws, trades | NOT DONE | Requires DB transactions and race-condition tests |
| Production Next.js build | NOT TESTED | npm dependencies not installed in this environment |
| Multiuser functional tests | NOT TESTED | Requires test Supabase project |
| Responsive screenshot comparison | NOT TESTED | Requires browser test at multiple viewport sizes |

**Release gate:** This is a V40-exact visual/functional DEMO, not a production website. Never collect real money or private user information in it.
