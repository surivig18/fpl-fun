---
name: FPL feed quirks
description: Non-obvious behavior of the official Fantasy Premier League API used by this project
---

The current-gameweek picks endpoint may omit `purchase_price` and `selling_price` even though older payloads included them.

**Why:** Treating those fields as always present creates `NaN` values that fail response validation and breaks the personal squad view.

**How to apply:** When mapping picks, use the player's current market price when either ownership price is absent. Keep the fallback explicit so a future API change is easy to spot.