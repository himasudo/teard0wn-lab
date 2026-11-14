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

## Verified release and remaining publishing step

Source is uploaded to the public repository:
https://github.com/himasudo/teard0wn-lab
Repository ID: 1457600714. The owner's initial commit was preserved.

Implementation commit `e3f39bf65acd44f5bc07a39a60593623e06f4f8e` passed the
complete GitHub Actions workflow on 14 November 2026:
https://github.com/himasudo/teard0wn-lab/actions/runs/43582204364

- 57 engine and lesson tests passed.
- 421 native x86-64 comparisons passed, zero mismatches.
- The portable build matched the checked-in artifact.
- All 19 browser checks passed, including every runnable lab at 1440, 820,
  and 390 pixels wide, debugger controls, grading, persistence, progress
  export/import, theme switching, and navigation.
- Desktop and phone workbench screenshots were visually reviewed.

The first CI attempt exposed a test timing issue: importing progress reads a
file asynchronously, but the test asserted before the error toast appeared.
The test now waits for that feedback. Primary-button hover contrast was also
corrected before the passing run.

GitHub Pages was still disabled at the last repository check. The connected
GitHub tools support source updates but do not expose Pages administration.
The earlier cloud-browser sign-in handoff did not connect on the owner's
device. Do not repeat that failed handoff or request credentials in chat.
The owner can enable Pages in Settings > Pages: select "Deploy from a branch",
then `main`, `/(root)`, and Save. No build server or runtime service is needed.
The intended URL is https://himasudo.github.io/teard0wn-lab/; verify a successful
deployment and the actual page before describing it as live.

## Concrete next work

1. Complete the Pages settings step, then verify the deployment and public URL.
2. Continue curriculum development from docs/CURRICULUM.md. Current runnable
   lessons are a foundation release, not fulfillment of the entire advanced
   curriculum.

Keep reported status factual: distinguish authored syllabus, runnable browser
labs, native lab packs, and measured hardware experiments. Never label planned
units complete or describe the teaching engine as a full native Linux debugger.
