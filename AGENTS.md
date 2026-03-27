# Repository Guidelines

## Project Layout
- `src/components`: UI and page-level components.
- `src/hooks`: playback and app behavior hooks.
- `src/lib`: shared logic, providers, API clients, storage, and utilities.
- `src/store`: Zustand stores.
- `src/types`: shared TypeScript types.
- `public`, `assets`, `icons`: static assets.
- `android`: Capacitor Android project.
- Tests live next to source as `*.test.ts` or `*.test.tsx`; shared setup is `src/test/setup.ts`.

## Commands
- Install: `npm install --legacy-peer-deps`
- Dev: `npm run dev`
- Build: `npm run build`
- Type check: `npm run typecheck`
- Lint: `npm run lint`
- Test: `npm run test`
- Android sync: `npm run cap:sync:android`
- Debug APK: `npm run build:android:debug`

## Working Rules
- Use TypeScript and existing `@/` import aliases.
- Keep changes minimal and consistent with current patterns.
- Do not add dependencies unless clearly necessary.
- Prefer fixing root causes over adding workarounds.
- When changing playback, sync, provider, or store logic, add or update targeted tests.
- If a command is expensive, run the smallest relevant check first.

## Change Scope
- UI changes: keep current visual language unless the task explicitly asks for redesign.
- Native-related changes: avoid modifying `android/` unless web changes require sync instructions.
- Docs changes: keep README user-facing; keep this file implementation-facing.

## Commits and PRs
- Use short conventional commit prefixes such as `fix:`, `refactor:`, `feat:`, `docs:`.
- PRs should state user-visible impact, affected areas, and verification performed.
- Include screenshots only when UI behavior or styling changes.
