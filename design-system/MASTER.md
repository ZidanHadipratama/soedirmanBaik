# Soedirman Baik

Instagram-inspired, media-first community feed. User's crest and requested restraint override generic tool presets.

## Tokens
- Ink #293F54; soft ink #3C566E.
- Blue #507899; blue-light #EDF3F8; blue-dark #406481.
- Cool paper #F5F7FA; white #FFFFFF; muted ink #596B7C.
- Red #A95056; red-light #F8EDEF; border #E0E7EE.
- Plus Jakarta Sans throughout: 16px body, 13px metadata, 24px page heading.
- Spacing 4/8/12/16/24/32/48px. Cards 16px, dialogs 24px, controls 12px, badges pill.
- Muted blue primary action with white text; red accents for the brand period, appreciation, and article quotes. Focus 3px navy outline + 3px offset.

## Layout
Desktop: 232px left rail, 600px feed, quiet 220px utility aside. Mobile: full-width media, restrained header, four-item bottom nav (Beranda, Jelajahi, Kirim, Kiriman saya). Submission lives at the bottom of the rail on desktop and in bottom navigation on mobile; no top composer prompt.
Post previews use a consistent Instagram-style 4:5 frame; gallery tiles use a square three-column grid. Articles open on /articles?id=<post-id>, with safe Markdown and readable long-form spacing.
Post content dominates. No marketing hero, background pattern, confetti, decorative statistics, or scroll-reveal animations.

## Motion
160ms button feedback; 200ms dialog entry; 220ms appreciation feedback. Disable nonessential motion for prefers-reduced-motion.

## Components and copy
Shared Button, Input, Dialog, PostCard, StatusBadge. Lucide icons at 2px stroke. Tap targets >=48px.
Short Indonesian labels. Anonymous guest submissions, self or other student recognition. No verified membership or poster identity.

## Sources
TypeUI app-shell guidance: typeui-shell.json.
Superdesign generation instructions: superdesign-brief.md.
UI/UX Pro Max: minimal direction, general accessibility guidance; its suggested marketing page structure does not fit this app.

## Preview discussion surfaces
- Demo bottom navigation: Beranda, Ruang, Jelajahi, Kirim, Kiriman saya (five targets); production retains its existing navigation.
- Room directory uses two columns on desktop and one on mobile, with existing borders, spacing, and color tokens.
- Text posts use content-sized cards. Author continuations form a vertical sequence; reader replies use at most two visual levels.
- Per-thread anonymous labels, owner-only pending sections, explicit moderation states, and keyboard-accessible actions.
- Deep links: /ruang?slug=... and /diskusi?id=...; safe internal return links preserve room/personal contexts.
