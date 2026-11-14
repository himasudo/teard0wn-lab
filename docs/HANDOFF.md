# teard0wn lab continuation

Updated 14 November 2026. This file preserves the agreed scope across chats.

## User-approved objective

New project named **teard0wn lab**, repository `teard0wn-lab`, GitHub Pages.
Memory Systems Lab is the prerequisite. Cover every track advertised in the
provided Low Level Labs screenshot, with original lessons/challenges, much
deeper explanations, and additional advanced systems/research tracks.

Explicit baseline: onboarding, assembly, reversing, crackmes, shellcoding,
vulnerability classes, binary exploitation, heap exploitation, crash triage and
sanitizers, fuzzing, ARM TrustZone, and kernel exploitation. Do not silently
drop TrustZone, kernel work, or the security topics in favor of generic systems
lessons. A different name alone is not the originality requirement: all content
and implementation here are independently authored.

## Present implementation

- Static modular website plus portable single HTML build.
- 12 authored runnable lessons across seven baseline tracks.
- Real-byte x86-64 subset assembler/executor with inspectable state and debugger.
- 22-track roadmap, including all baseline tracks and ten additional tracks.
- Local progress/code persistence and export/import.
- Three companion native C investigations.
- Engine and lesson suite: 57 checks passed.
- Native instruction comparison: 421 fixtures passed, zero mismatches.
- Three native C programs compiled and ran successfully.

## Verification and publishing blockers

Rendered browser verification is **not complete**. The local Chromium runner
could not start because this execution environment disallows a required local
socket. A separate cloud browser rejected local-file navigation under its URL
policy. Do not evade those restrictions. The browser suite is prepared for a
normal local development environment or GitHub Actions and must pass before
the publisher enables Pages.

The owner created the public repository on 14 November 2026:
https://github.com/himasudo/teard0wn-lab
Repository ID: 1457600714. Its initial main commit is
c7b59bd938d498a15bd4d2a4a38922c4f3878ad7. Source is being uploaded through the
connected GitHub integration. Check the repository Actions page for current
validation status. Pages was not enabled when this upload was prepared.
The cloud-browser sign-in handoff did not connect on the owner’s device; use
the GitHub integration for supported operations.

## Concrete next work

1. Verify the source upload and its current main commit.
2. Run the prepared browser suite, fix any UI findings,
   and inspect screenshots at desktop/tablet/phone widths.
3. Enable Pages after checks pass and verify the actual public URL.
4. Continue curriculum development from docs/CURRICULUM.md. Current runnable
   lessons are a foundation release, not fulfillment of the entire advanced
   curriculum.

Keep reported status factual: distinguish authored syllabus, runnable browser
labs, native lab packs, and measured hardware experiments. Never label planned
units complete or describe the teaching engine as a full native Linux debugger.
