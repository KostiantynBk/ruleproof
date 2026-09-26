# Data Sources

## 1. Real-world PR review comments — sindresorhus/ky

| Field | Value |
|---|---|
| **Repository** | <https://github.com/sindresorhus/ky> |
| **License** | MIT |
| **Fetch date** | 2026-09-25 |
| **API** | GitHub REST API — `GET /repos/{owner}/{repo}/pulls/comments` |
| **Collection script** | `scripts/fetch-reviews.mjs` |
| **Output file** | `samples/real-ky.history/reviews.json` |

### Fields kept

| Field | Description |
|---|---|
| `pr` | Pull-request number (parsed from `pull_request_url`) |
| `file` | File path the comment was left on |
| `line` | Line number (`line` or `original_line`) |
| `date` | Comment creation date (`YYYY-MM-DD`) |
| `reviewer` | Anonymized identity (`reviewer_1`, `reviewer_2`, …) in order of first appearance, consistent per login |
| `body` | Comment text with `@mentions` replaced by `@user` |
| `url` | Public permalink to the comment (`html_url`) |

### Privacy and filtering

- **Reviewer identities are anonymized.** GitHub logins are mapped to opaque labels
  (`reviewer_1`, `reviewer_2`, …) before writing to disk. The mapping is held only in
  memory during the fetch run and is never persisted.
- **Only short excerpts are quoted.** Individual comment bodies are reproduced as-is from
  the public GitHub API but are filtered to remove noise (see below). No email addresses,
  real names, or other personal data are stored.
- **Chatter is dropped.** Comments shorter than 25 characters, pure
  acknowledgement replies ("thanks", "done", "fixed", "resolved", "will do", "good point"),
  and bare ` ```suggestion ``` ` blocks without additional explanation are excluded.
- All remaining data was already publicly accessible via the GitHub API without
  authentication.

---

## 2. Synthetic Harbor Orders data

| Field | Value |
|---|---|
| **Origin** | Created specifically for this project |
| **Purpose** | Provides a realistic but entirely fictional codebase for rule-mining demonstrations |
| **Location** | `samples/harbor-orders/` |
| **History** | `samples/harbor-orders.history/` |

This dataset contains no real user data. All entities (orders, ships, ports, personnel)
are invented. It was designed to exercise common engineering patterns so that the
Rule Miner mode has a reproducible, self-contained example to work with.
