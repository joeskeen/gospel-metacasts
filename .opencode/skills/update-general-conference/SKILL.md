---
name: Update General Conference Data
description: Add or update General Conference sessions and talks in this repo. Use when the user asks to bring the conference archive up to date, add a new April/October conference, fix conference metadata, or add speakers from a recent conference. Covers gathering via Chrome DevTools MCP, writing episode YAML, adding speaker portraits, validating, and rebuilding feeds.
---

# Update General Conference Data

This repo keeps one YAML file per talk in
`data/episodes/general-conference/<year>-<month>/`, one `_season.yml` per
conference, and one `data/people/<speaker-id>.yml` per speaker.

## Ground rules

- Follow the user's trust rules. Only create new conference folders and new
  speaker files. Do not edit existing data or overwrite uncommitted work without
  approval.
- Use Chrome DevTools MCP for the Church site. Do not start a dev server.
- `out/` is gitignored. Building feeds is verification, not a commit step.
- Prefer official `churchofjesuschrist.org/learn/<slug>` pages for new speakers.
  Do not use news articles, and do not touch the older
  `history.churchofjesuschrist.org` CHD data unless the user asks.

## 0. Find what is missing

```powershell
Get-ChildItem data/episodes/general-conference | Select-Object -ExpandProperty Name
```

Conferences are `YYYY-april` and `YYYY-october`. Add every conference through
the current date. April is the Annual conference; October is the Semiannual
conference.

## 1. Start Chrome for the MCP

The MCP is configured with `--browserUrl=http://127.0.0.1:9222`. If
`list_pages` fails with `ECONNREFUSED`, start a headless Chrome in the
background:

```powershell
google-chrome-stable --headless=new --remote-debugging-port=9222 `
  --user-data-dir=/tmp/opencode/chrome-profile `
  --no-first-run --no-default-browser-check --disable-gpu about:blank
```

Then call `list_pages` and keep the returned page id.

## 2. Gather the conference

Open the conference page (or any page on the same origin):

`https://www.churchofjesuschrist.org/study/general-conference/<year>/<month>?lang=eng`

Set `uri` near the top of `scripts/gather-conference.js`, then run it with the
Chrome DevTools `evaluate_script` tool and save the output:

```text
evaluate_script({
  pageId: <id>,
  sourcePath: "/absolute/path/to/.opencode/skills/update-general-conference/scripts/gather-conference.js",
  filePath: "/tmp/opencode/<year>-<month>.json",
  waitForStableDom: false
})
```

The script uses the site's same-origin API, so the page must be on
`churchofjesuschrist.org`. It reads the conference nav, fetches each talk's API
JSON, and returns:

- `sessions[]`: `index`, `label`, `text`, `href`, `description`
- `talks[]`: `href`, `title`, `authorName`, `authorRole`, `summary`, `audio`,
  `datePublished`, `duration`, `session`, `sequence`

What it reads from the talk page:

| Field | Source |
| --- | --- |
| title | `header h1` |
| byline | `header .byline .author-name` / `.author-role` |
| summary | `header .kicker` (optional; administrative talks may omit it) |
| audio | `meta.audio[0].mediaUrl` |
| date | `JSON.parse(meta.structuredData).datePublished` |
| duration | `Audio` element `loadedmetadata` on the MP3 |

Verified against the 196th conferences: all 37 April 2026 and 38 October 2026
talks had a date, audio, byline, and role. Only the solemn assembly and
sustaining items lacked a summary.

## 3. Generate the YAML

Dry run first:

```powershell
node .opencode/skills/update-general-conference/scripts/generate-conference.mjs `
  --input /tmp/opencode/2026-04.json --year 2026 --month 4 --dry-run
```

Then write:

```powershell
node .opencode/skills/update-general-conference/scripts/generate-conference.mjs `
  --input /tmp/opencode/2026-04.json --year 2026 --month 4
```

It writes:

- `data/episodes/general-conference/<year>-<month>/_season.yml`
- one talk YAML per item
- `data/people/<speaker-id>.yml` (`id` + `name`) for new speakers

It refuses to overwrite an existing conference folder unless `--force` is
passed. `--force` overwrites generated files but does not delete stale files; if
the folder needs a clean rebuild, ask before removing it. It also rejects
duplicate talk ids and missing dates/audio.

Review the dry-run output before writing. The generator is intentionally
conservative: it does not invent a summary or a portrait.

## 4. Add speaker portraits

For each new speaker, find the official leadership page:

`https://www.churchofjesuschrist.org/learn/<slug>?lang=eng`

The slug is usually the speaker id, but verify it. Known exception: the byline
`James G. O. Fantone` uses `james-o-fantone`.

Read the portrait image id from `meta[property="og:image"]` or the first
portrait `<img>` on that page, then add:

```yaml
website: https://www.churchofjesuschrist.org/learn/<slug>?lang=eng
photo: https://www.churchofjesuschrist.org/imgs/<image-id>/full/!390,/0/default
```

Use the `!390,` variant (390px wide) to match existing photos. Verify every new
photo URL returns an image before finishing.

`scripts/collect-people-data.ts` skips people who already have both `website`
and `photo`, so setting these prevents a later enrichment run from replacing the
official page.

## 5. Validate and rebuild

```powershell
npm run validate:yaml
npm run build:conference
npm run build:conference:people
npm run build:index
```

Confirm:

- the new conference feed has the expected item count;
- the new feed has no `undefined` author text;
- `out/episodes-index.json` includes the new talks;
- `git status` shows only the intended new files/edits.

```powershell
$feed = "out/general-conference/2026-april.rss"
(Select-String -Path $feed -Pattern '<item>' -AllMatches).Matches.Count
(Select-String -Path $feed -Pattern 'undefined' -AllMatches).Matches.Count
```

## 6. Stop only the Chrome you started

```powershell
pkill -f "user-data-dir=/tmp/opencode/chrome-profil[e]"
```

The `[e]` prevents the pattern from matching the `pkill` command itself.

## Conventions and pitfalls

See `references/conventions.md` for the full schema. The short version:

- **Season number**: `confNumber = 195 - (2025 - year)`;
  `season = 2 * confNumber - (month === 4 ? 1 : 0)`. Prefer the number and
  Annual/Semiannual wording from the conference page description when present
  (e.g. "196th annual general conference").
- **Sessions**: do not assume five. Recent conferences have four (Saturday
  Morning, Saturday Afternoon, Sunday Morning, Sunday Afternoon) after the
  Saturday Evening session was discontinued. Build `_season.yml` from the actual
  session nav items.
- **Dates**: use `datePublished` from `meta.structuredData` (true Saturday vs
  Sunday date). Older data has a first-of-month artifact; do not copy it.
- **Summaries**: use `header .kicker`; it is optional. Do not use
  `header p:first-of-type` — a `p.subtitle` scripture reference can come before
  the byline.
- **Speaker parsing**: strip `Presented by ` or `By `, then treat the first
  token as an honorific only if it is `Elder`, `President`, `Sister`, `Brother`,
  or `Bishop`. A no-honorific administrative report (e.g.
  `Presented by Jared B. Larson`) should get `short: ''`, or `Brother`/`Sister`
  if known, so the RSS generator does not emit `undefined`.
- **IDs**: talk ids are
  `gc-<year>-<month>-<session>-<sequence>-<speaker-slug>-<title-slug>`.
  Title slug is lowercase and `\W+` → `-` with no trim, so punctuation produces
  double/trailing hyphens. That is the repo convention; do not "fix" it.
- **Speaker slugs**: lowercase and replace `[^a-zéñíó]+` with `-`. Accents
  outside é/ñ/í/ó are dropped; check the result against `data/people/`.
- **RSS author bug**: the generator interpolates `title.short`; a missing
  `short` becomes the literal text `undefined`. Always include `short` (even an
  empty string) in new talk YAML.
- **CI**: `.github/workflows/validate-metadata.yml` runs `npm run validate:yaml`
  on metadata PRs. It does not build feeds.
