# Quickstart: Using the Code Review Documents

**Feature**: 001-codebase-review
**Date**: 2026-04-07

## What You'll Find

After the review is complete, the `docs/` directory at repository root will
contain structured code review documents organized by workspace:

```
docs/
├── README.md                   ← START HERE
├── backend/                    ← 10 documents covering all backend services
├── mobile/                     ← 5 documents covering the mobile app
├── dashboard/                  ← 4 documents covering the admin dashboard
└── shared/                     ← 4 integration documents + roadmap
```

## How to Read the Review

### Step 1: Read the Roadmap

Open `docs/shared/roadmap.md` first. It contains every finding sorted by
severity with references to the detailed review documents.

### Step 2: Fix Critical Issues

Work through the Critical section of the roadmap. Each entry links to its
source document where you'll find the file path, description, and a specific
fix recommendation.

### Step 3: Address Integration Problems

Open the `docs/shared/` integration documents to understand how backend, mobile,
and dashboard disagree on data contracts, error handling, or event flow.

### Step 4: Review Per-Workspace Details

Dive into individual workspace directories for deeper analysis of specific
services or components.

## Finding ID Reference

Every finding has a unique ID like `AUTH-003` or `MOB-API-012`. Use these IDs
to cross-reference between the roadmap and individual review documents.

## How to Generate the Review

1. Run `/speckit.tasks` to generate the task breakdown
2. Each task corresponds to producing one review document
3. Tasks can be executed in parallel per workspace
4. The roadmap task depends on all individual review tasks being complete

## How to Validate

After generating review documents, verify:
- Every file listed in "Files Covered" tables exists in the codebase
- Every finding ID is unique across all documents
- The roadmap references every finding from every document
- No source file in backend/mobile/dashboard is missing from all reviews
