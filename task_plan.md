# Soedirman Baik implementation

Goal: responsive, minimal P3MD good-act feed with anonymous submissions and admin premoderation.

## Phases
- [complete] Foundation, tool-guided design, shared tokens.
- [complete] Feed, composer, submission status, accessible motion.
- [complete] Persistent submissions, protected uploads, admin moderation.
- [in_progress] Verify complete flows, privacy, responsive layout, production build.

## Constraints
- No student registration. No verified poster identity.
- Photos, videos, articles, and website links.
- Only approved content is readable in feed; private owner/admin preview of pending content.
- Navy/gold/cream/red, Plus Jakarta Sans, Instagram-inspired single-column feed.
- Short Indonesian copy. No decorative clutter.
- Supabase/Mux credentials absent. User asked whether to connect projects or run locally first. Proceed with independent UI work while awaiting answer.
- No Frugent.

## Errors
- Listed planning-with-files path was stale; located and read installed skill.
- npm audit fix cannot resolve eslint-config-next's braces advisory without an unrelated major downgrade; will replace the affected dev lint dependency chain.
- ESLint 9 / @eslint/js 10 peer mismatch resolved by installing current compatible ESLint and TypeScript lint packages.
- Unit test detected missing bound post IDs in two local asset queries. Added parameters; rechecking unfinished-media approval and edit detach behavior.
- Browser harness port 3100 was occupied by another process; moved isolated tests to verified port 3137 without touching that process.
