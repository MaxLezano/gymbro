# GymBro — task list

Tick each item once it is done **and** checked on the emulator.

## 1. Before publishing on Play Store

- [x] **Coach Worker locked to the app**: requests need the app key; per-IP limits stay. *(Later, when publishing: Play Integrity.)*
- [x] **Lighter APK without losing features**: one universal APK (phones + emulator) until the Play Store release, then AAB. 128 MB -> 48 MB (R8, compressed native libs, no 32-bit x86, recompressed photos).
- [ ] **Error reporting (Sentry)**: crashes and JS errors reach a dashboard. *Code ready; waiting for the project DSN in .env.local.*
- [x] **Microphone declared**: privacy policy + answers for Play Console "Data safety" (docs/RELEASE.md §9).
- [ ] **Own exercise media** (replaces the licensed Gym Visual images). *Parked: a dedicated tool comes later.*

## 2. Details

- [ ] Coach header shows the provider that actually answered (Gemini or the fallback).
- [ ] 75 and 90 min programs get more volume than 60 min.
- [ ] More exercise images available offline (only 16 are preloaded).

## 3. Features for people who train

- [ ] Log what you ate: mark meals as eaten and track water.
- [ ] Body weight: progress chart and a weekly weigh-in reminder.
- [ ] Automatic warm-up sets for the first heavy lift of the day.
- [ ] Plate calculator: which plates to load for X kg.
- [ ] Training reminders on the program's days.
- [ ] Suggested deload week when progress stalls.
