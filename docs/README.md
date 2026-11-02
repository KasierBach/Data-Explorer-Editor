# Documentation

## Current roadmap and verification

- [Roadmap](roadmap/ROADMAP.md): dependency order, acceptance criteria, safety rules, and current implementation status.
- [Progress ledger](roadmap/ROADMAP-PROGRESS.md): execution history, findings, verification, and remaining blockers.
- [Quality evidence](roadmap/quality/README.md): reproducible test commands and links to package reports/manifests.
- [Local cleanup and retention](roadmap/quality/CLEANUP-2026-10-31.md): reviewed file moves, reproducible artifacts, and Docker ownership checks.

## Maintained guides

- [CI/CD operations](operations/ci-cd.md)
- [Performance baseline](performance/2026-06-performance-baseline.md)

## Local historical material

`archive/local-notes/` contains the original project overview, initial requirements, and August 2026 code-review notes moved from the repository root. These files remain ignored local material; they are not current acceptance criteria or proof that historical findings still exist.

Keep product source, colocated unit tests, browser projects, server fixtures, package configuration, CI workflows, and Prisma migrations in their existing directories. Generated builds, installed dependencies, coverage reports, and browser output are not documentation sources.
