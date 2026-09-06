# EnergyIQ final stabilization report

The stabilization pass is complete. The canonical energy formula, sample-data preservation and reset behavior, default client-only mode, and separation of estimates from forecasts remain intact. No external or paid service or new dependency was added.

## Result

- TypeScript and Java require a qualifying observation on every one of the latest 60 completed calendar days, ending yesterday. Coverage counts only distinct, valid dates in the latest completed 60/90-day windows. Old history, sparse observations, duplicates, invalid values, today, and future observations cannot unlock a forecast. Fully observed zeros remain valid.
- Forecast metadata and UI report data coverage rather than unsupported medium/high confidence. The model still uses its existing deterministic tuning; coverage does not claim predictive accuracy.
- Authentication now loads existing appliances and settings before login navigation completes, also hydrates restored sessions, and exposes transient loading failures with retry. Concurrent session resolution is deduplicated and superseded requests cannot overwrite newer hydration.
- Full-stack server history is explicitly labeled API-only in navigation, the forecast chart, the history route, and README. Its history input uses the authenticated local API; the chart can display forecasts from those records. Full-stack mode has no Usage History editor and does not synchronize browser history to H2.
- Major routes load on demand. Production mode constants and guarded imports exclude account routes, Axios/interceptors, JWT decoding, and STOMP/SockJS dependencies from the default client build.

## Verification results

Environment: Windows PowerShell, Node.js 24.19.0, npm 11.17.0, Temurin Java 21.0.12.1. Frontend commands ran in `frontend`; Maven wrapper commands ran in `backend` with `JAVA_HOME` pointing to the existing Java 21 installation.

| Command | Final result |
| --- | --- |
| `npm ci` | PASS: 413 packages installed, 414 audited, 0 vulnerabilities. |
| `npm run lint` | PASS: no errors or warnings. |
| `npm test` | PASS: 57 tests in 14 files. |
| `npm run build` | PASS: TypeScript and default production build. |
| `npm run build:fullstack` | PASS: TypeScript and full-stack production build. |
| `.\mvnw.cmd test` with Java 21 | PASS: 69 tests, 0 failures, 0 errors, 0 skipped. |
| `.\mvnw.cmd clean package` with Java 21 | PASS: 69 tests, 0 failures, 0 errors, 0 skipped; executable JAR packaged. |
| `git diff --check` | PASS. |

Regression coverage includes 60 observations more than a year old in both stacks, stale history plus one recent observation, sparse recent data, invalid/current/future dates or values, duplicates, 60/90-day boundaries, and legitimate zero forecasts. An H2 persistence test exercises the Java service and real forecaster against old records and then 60 recent recorded zeros. Existing formula parity, calendar aggregation, ownership/security, product-language, and sample preservation tests pass.

The frontend login integration test submits the actual LoginPage and verifies existing appliances, EUR rate, and household size appear before dashboard navigation without remounting AppProvider. Additional tests cover restored sessions and retry after hydration failure; HTTP requests are mocked in those frontend tests.

Default output inspection found no account-route, backendApi, Axios, JWT-decoder, STOMP, or SockJS code/chunks. The default entry chunk is 224.76 kB (74.56 kB gzip); its largest separate chart chunk is 394.35 kB (109.69 kB gzip). The full-stack entry is 231.30 kB (76.76 kB gzip), with account, API, and WebSocket dependencies emitted separately. Both builds completed without oversized-chunk warnings. The last requested build was full-stack, so `frontend/dist` currently contains that build.

The local browser loaded the demo dashboard and the Usage History route, including the new completed-day coverage wording. No browser console errors were captured. The packaged backend also started successfully using a temporary in-memory H2 database and loopback binding, and was stopped afterward. The original client-mode Vite development server was restored after the clean install.

## Resolved verification issues and limits

- Initial `npm ci` failed because the existing Vite process held Rollup's Windows native module open. Stopping that workspace process allowed the clean install to pass.
- The first frontend verification found a changed session-error message assertion and TypeScript errors in request tracking and Vite configuration. These were corrected; final lint, tests, and both builds passed.
- The first `clean package` attempt failed because its redirected log was inside `target`, which Maven needed to remove. Moving the log to the system temporary directory allowed the complete command to pass.
- npm reported existing deprecated-package notices and an esbuild install-script approval notice. Maven reported existing MockBean deprecation, annotation-processing, and Mockito dynamic-agent notices. No dependency upgrades were made during this pass.
- Automatic approval review blocked the additional browser smoke-test setup that would seed a disposable local account, returning only “blocked by policy.” Therefore a real browser login against the backend was not verified. The passing frontend login integration and Java/H2 tests provide the authentication-hydration and persistence evidence described above.

## Every changed file

Paths are relative to `C:/Users/ttonn/Downloads/TrackEnergy-main`. There are 28 changed or added source/documentation files; generated dependencies and build artifacts are ignored.

| File | Change |
| --- | --- |
| `README.md` | Documents coverage eligibility, authentication hydration, API-only server history input, forecast metadata, and route/dependency splitting. |
| `STABILIZATION_REPORT.md` | This complete change and verification report. |
| `backend/src/main/java/com/energytracker/dto/HistoryForecastDTO.java` | Replaces confidence with dataCoverage and adds recentHistoryDays. |
| `backend/src/main/java/com/energytracker/repository/EnergyUsageLogRepository.java` | Removes the unbounded all-time forecast-eligibility count query. |
| `backend/src/main/java/com/energytracker/service/EnergyUsageService.java` | Computes bounded, finite, distinct 60/90-day coverage and gates forecasting on complete recent history. |
| `backend/src/main/java/com/util/TimeSeriesForecaster.java` | Excludes invalid kWh values from model inputs. |
| `backend/src/test/java/com/energytracker/service/DomainPersistenceTest.java` | Adds real H2 old-history and recent-zero forecast regressions. |
| `backend/src/test/java/com/energytracker/service/EnergyUsageProjectionContractTest.java` | Tests recent coverage, stale/sparse/duplicate/invalid observations, and revised metadata. |
| `frontend/src/App.tsx` | Lazy-loads major routes, excludes account routes from the default build, and labels server history API-only. |
| `frontend/src/components/EnergyUsageChart.test.tsx` | Verifies coverage wording, API-only labeling, and insufficient-history fallback. |
| `frontend/src/components/EnergyUsageChart.tsx` | Displays coverage metadata and recent-day readiness, and explains API-only server history. |
| `frontend/src/components/Layout.tsx` | Shows account hydration errors with a retry action on public application pages. |
| `frontend/src/components/Sidebar.tsx` | Exposes the full-stack history limitation through an API-only navigation label. |
| `frontend/src/config/runtime.ts` | Adds production mode constants while retaining fail-safe development/test mode resolution. |
| `frontend/src/context/AppContext.client.test.tsx` | Updates sample coverage assertions; preservation, reset, and no-backend-call tests remain intact. |
| `frontend/src/context/AppContext.fullstack.test.tsx` | Adds login-to-dashboard, restored-session, and hydration-retry integration tests. |
| `frontend/src/context/AppContext.tsx` | Integrates appliances/settings hydration into authentication and guards concurrent requests. |
| `frontend/src/pages/UsageHistory.test.tsx` | Updates the coverage fixture for the revised history status contract. |
| `frontend/src/pages/UsageHistory.tsx` | Displays the latest completed-day readiness and honest coverage wording. |
| `frontend/src/utils/api.tsx` | Becomes a typed, guarded lazy API facade. |
| `frontend/src/utils/backendApi.tsx` | Holds the existing Axios setup and request/refresh interceptors behind the lazy facade. |
| `frontend/src/utils/auth.tsx` | Guards backend-only authentication and lazily imports Axios. |
| `frontend/src/utils/energyEstimator.tsx` | Removes the unsupported fixed high-confidence annotation; arithmetic is unchanged. |
| `frontend/src/utils/historyForecast.test.ts` | Adds stale/sparse/duplicate/invalid-history and valid-zero regressions and coverage assertions. |
| `frontend/src/utils/historyForecast.ts` | Restricts eligibility to complete recent observations and reports bounded coverage. |
| `frontend/src/utils/websocket.tsx` | Guards WebSocket imports so they are excluded from the default client build. |
| `frontend/src/vite-env.d.ts` | Declares the production backend-mode constant. |
| `frontend/vite.config.ts` | Resolves the production mode constant from Vite's environment files. |

No commits, deployment, or publication were performed.
