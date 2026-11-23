# Property Journey · Playwright & TypeScript

A real-estate automation portfolio that preserves the depth of a larger test framework: reusable page objects, typed fixtures, data-driven scenarios, multi-step journeys, persisted-state assertions, and failure diagnostics.

This is a sanitized source showcase, not a replacement website. Major historical flows remain available for code review even when the current website no longer exposes them. The website suites are deliberately opt-in; the default command and GitHub Actions run offline checks only.

## Start here

```sh
npm ci
npm run typecheck
npm test
```

No browser, target URL or credentials are needed for these checks. GitHub Actions runs the same installation, TypeScript and offline regression checks on pushes and pull requests.

## Engineering worth exploring

| Example | What it demonstrates |
| --- | --- |
| [Collection lifecycle](tests/search/02savedCollectionCrud.spec.ts) | Discover an unsaved property; create a named collection; verify membership; rename; remove the property; delete that collection; assert the final state. |
| [Search filters](tests/searchFilters/searchFilters.spec.ts) | Valid price bounds, property types, beds and baths across multiple locations; URL and visible-card assertions; saving and editing the resulting search. |
| [Onboarding](tests/auth/onboarding.spec.ts) | Location, budget, estimate recalculation, optional mortgage steps, property preferences, submission and persisted-profile assertions. |
| [Tour scheduling](tests/tour/requestTourActive.spec.ts) | Dashboard and search entry points; available/disabled slots; changing selections; phone collection; agreement handling; verification in dashboard Tours. |
| [Listing tour entry](tests/tour/requestTourListingPage.spec.ts) | Bounded candidate discovery, listing-detail entry and cross-page verification of the selected property. |
| [Listing disclosures](tests/mls-listing-page/mlsListingPage.spec.ts) | Multiple properties and markets; listing attribution, timestamps, contact details, disclosure copy and placeholders. These are UI checks, not a certification of legal compliance. |
| [Browse validation](pages/search/BreadcrumbPage.ts) | County navigation, broken-link detection, bounded sampling, collected warnings and diagnostic reports. Empty samples fail rather than silently skipping. |
| [Mortgage diagnostics](tests/mortgage/mortgageQualifyHrefTiming.spec.ts) | Navigation timing and changing qualification links; related specs cover navigation and a multi-step VA loan form. |
| [Assistant financing](utils/assistant/financingJourney.ts) | Bounded conversational turns, repeated-question detection, review-value assertions, explicit confirmation, and purchase/refinance branches. |
| [Toast capture](utils/toastRecorder.ts) | Preserve short-lived UI notifications for assertions after a transition. |
| [Replayable fixtures](fixtures/base.fixture.ts) | A per-test random seed recorded in the test output, with deterministic choices and isolated streams for parallel async helper work. |

## Suites and execution status

| Suite | Contents | Execution |
| --- | --- | --- |
| `tests/unit` | **39 offline regressions**: financing question recognition, contact parsing, submission classification and random replay/isolation | Default command and CI |
| `tests/assistant` | **16 scenarios**: chat smoke, five home searches, four tour journeys, four purchase and two refinance journeys | Explicit browser command; three browser projects |
| Feature folders under `tests/` | **20 detailed historical scenarios** across 17 spec files: authentication, onboarding, search, saved collections, browse navigation, listing disclosures, tours, agreement restrictions, estimates and mortgages | Separate explicit command; Chromium |

The browser suites were compiled and their test discovery checked during preparation. They were **not executed against a website**. Sign-in/sign-up and other removed UI features remain references; their presence does not imply current compatibility. A green offline build verifies helper behavior, not the live application.

## Structure

```text
pages/                  Detailed UI page objects grouped by feature
fixtures/               Typed auth, isolated discovery and replay fixtures
common/testData/        Synthetic assistant scenarios and illustrative locations
config/                 UI adapter and configurable example API paths
utils/                  Journey runners, toast capture, identities, pure classifiers
tests/unit/             Offline regression checks
tests/assistant/        Modern conversational journey examples
tests/auth/             Authentication and onboarding references
tests/search*/          Search, filters and saved collections
tests/tour/             Tour references
tests/mortgage/         Mortgage references
tests/...               Other feature references
```

## Optional browser execution

Use an authorized test website and dedicated accounts. No website is included here.

```sh
cp .env.example .env
# Configure your local target, selectors, example contracts and test accounts.
npx playwright install chromium

# Modern assistant examples:
npm run test:e2e -- --project=chromium

# Historical references, after adapting the target UI/contracts:
npm run test:reference -- --grep 'saved listing collection'
```

Both browser commands reject a missing `BASE_URL`. `npm run test:e2e` selects only assistant examples. `npm run test:reference` selects only historical examples; neither runs in Actions. Use `--list` to inspect discovery without launching browsers.

For replayable historical choices, set `TEST_SEED` before running. The framework combines it with the test title and records the resulting seed. Changing the seed explores a different valid selection; it cannot freeze changing live inventory.

Authentication fixtures use fresh contexts and environment-supplied accounts. There is no mailbox access, database-backed account counter, saved session cache or infrastructure bypass. Passwordless page-object methods accept a caller-supplied code; no OTP service is bundled. Some reference page objects synchronize UI actions with configured network responses; `config/contracts.ts` contains neutral example paths rather than private endpoints.

## Adaptation points and known limitations

- Historical selectors, routes, text and expected product behavior need review against the intended website. Network response shapes are example contracts; path configuration alone is not sufficient to retarget every assertion.
- Location availability, regional restrictions and rebate calculations are illustrative product expectations, not a service-coverage map or financial guidance. Adapt these rules to the target.
- Onboarding requires an already seeded, unfinished account. The demo does not create backend accounts. Tour fixtures require an account with an appropriate active market. Configure every account key needed by the chosen spec.
- Live inventory can leave no matching property or appointment. Bounded discovery fails with context rather than inventing success. Some inherited helpers still use fixed waits and UI fallbacks; a working target is needed to validate and tighten them.
- Tour/financing examples can create requests, onboarding can update preferences, and collection/search examples mutate their dedicated account. Signup demonstrates form entry without completing registration. No browser flow was run as part of this preparation.
- The collection CRUD test removes its own newly named collection. Account-wide random cleanup and editing an arbitrary existing saved search were excluded. Other reference mutations do not all implement rollback; use disposable test accounts.

## Public source hygiene

`.env.example` contains placeholders. Local `.env`, authentication state, dependencies, reports, traces, recordings, exports and generated artifacts are ignored. Browser recording is off by default; explicit website specs may still create local diagnostic attachments, screenshots and browse reports. Those can contain target/account data and are not part of the public source export.

Actions needs no secrets and uploads no website artifacts. Configured secrets, company branding, hosted private URLs, private integrations and original recordings are excluded from this source showcase. Scanning reduces exposure risk; it cannot guarantee every future edit or generated artifact is safe to share.

To export just the source:

```sh
python3 scripts/export-demo.py /absolute/path/outside-this-repo/property-journey.zip
```

The exporter uses a source allowlist and excludes `.git`, credentials, dependencies and runtime evidence. Publish a clean snapshot in a new repository; never copy the history of the original private project.
