# General Conference Data Conventions

This file describes the data shapes and rules used by
`data/episodes/general-conference/` and `data/people/`.

## Directory layout

```text
data/episodes/general-conference/
├── _album.yml
├── _artist.yml
├── 2026-april/
│   ├── _season.yml
│   ├── gc-2026-04-01-01-dallin-h-oaks-introduction.yml
│   └── ...
└── 2026-october/
    ├── _season.yml
    └── ...
```

- Folder name: `<year>-<monthName>`, where monthName is `april` or `october`.
- Talk files: `<talk-id>.yml`. Files beginning with `_` are metadata, not talks.
- `scripts/episodes.ts` recursively loads every non-underscore `.yml` and
  attaches the nearest `_album.yml`, `_artist.yml`, and `_season.yml`.

## `_season.yml`

```yaml
season: 391
label: 196th Annual General Conference
startDate: 2026-04-04
endDate: 2026-04-05
sessions:
  1: Saturday Morning
  2: Saturday Afternoon
  3: Sunday Morning
  4: Sunday Afternoon
```

- `season`: `2 * confNumber - (month === 4 ? 1 : 0)`.
  `confNumber` is the ordinal conference number (196 for 2026).
- `label`: `<ordinal> <Annual|Semiannual> General Conference`.
- `startDate` / `endDate`: the actual Saturday/Sunday dates, not the first of
  the month.
- `sessions`: 1-based session index to label. Do not hard-code five. Recent
  conferences have four; older ones have five (including Saturday Evening).
  Build this map from the conference nav.

The repo's older collector uses `confNumber = 195 - (2025 - year)` and a
first-of-month date. Those are historical artifacts. Prefer the conference page
description (`196th annual general conference`) and the talk
`datePublished` values for new data.

## Talk YAML

```yaml
id: gc-2026-04-01-01-dallin-h-oaks-introduction
title: Introduction
date: 2026-04-04
session: 1
sequence: 1
links:
  mp3: https://assets.churchofjesuschrist.org/065kn0zd5mrfs7it2ixgmz5j65sc25jdm2tymc1u-128k-en.mp3
speaker:
  id: dallin-h-oaks
  title:
    full: President of The Church of Jesus Christ of Latter-day Saints
    short: President
summary: The conference we convene today is different because it begins with
  what we call a solemn assembly.
topics: []
duration: 147
```

Required by `scripts/validate.ts`:

- `id` — matches the filename (without `.yml`); matches
  `/^[a-z0-9\-éñíóá]+$/`.
- `title`
- `speaker` (and `speaker.id` must exist in `data/people/`)
- `date` — `YYYY-MM-DD`
- `topics` — array
- `links.mp3`

Optional but used by feeds:

- `session`, `sequence` — ordering and pubDate generation.
- `summary` — description text.
- `duration` — seconds; if absent, the feed writes `NaN`.

## ID rules

Talk id:

```text
gc-<year>-<month>-<session>-<sequence>-<speaker-slug>-<title-slug>
```

- `year` — four digits.
- `month` — two digits (`04` or `10`).
- `session` — two digits, 1-based.
- `sequence` — two digits, 1-based within the session.
- `speaker-slug` — `name.toLowerCase().replace(/[^a-zéñíó]+/gi, '-')`.
- `title-slug` — `title.toLowerCase().replace(/\W+/g, '-')`, no trim.

The title slug intentionally leaves leading/trailing hyphens. For example,
`Ministering—“That Ye Love One Another; as I Have Loved You”` becomes
`ministering-that-ye-love-one-another-as-i-have-loved-you-` (trailing hyphen),
and `“I Will Give Away All My Sins to Know Thee”` becomes
`-i-will-give-away-all-my-sins-to-know-thee-` (leading and trailing hyphens).
The full id then contains `...-wan-liang-wu--i-will-...` because the id template
also adds a hyphen before the title slug. Do not "clean" these; the existing
archive uses this convention.

Speaker id:

```text
name.toLowerCase().replace(/[^a-zéñíó]+/gi, '-')
```

This preserves `é`, `ñ`, `í`, `ó` but not other accented letters. Check the
result against `data/people/` and the official `/learn/` slug.

## Dates and sessions

- `datePublished` lives in `meta.structuredData` as a JSON string on each talk
  API response. Parse it and take the first 10 characters.
- Saturday sessions use Saturday's date; Sunday sessions use Sunday's date.
- Session order comes from the conference nav. The nav structure is:

  ```html
  <nav class="manifest">
    <ul class="doc-map">
      <li data-content-type="general-conference-session">
        <h2 class="label"><p class="title">Saturday Morning Session</p></h2>
        <ul class="doc-map">
          <li><a href=".../saturday-morning-session">session link</a></li>
          <li data-content-type="general-conference-talk">
            <a href=".../11oaks">talk link</a>
          </li>
          ...
        </ul>
      </li>
      ...
    </ul>
  </nav>
  ```

  The first nested `li` is the session link; talk items have a
  `data-content-type` attribute. Group talks by their parent session `li`.

## Speaker parsing

The talk header is:

```html
<header>
  <h1>Title</h1>
  <p class="subtitle">(Scripture reference)</p>   <!-- optional -->
  <div class="byline">
    <p class="author-name">By President Dallin H. Oaks</p>
    <p class="author-role">President of The Church of Jesus Christ of Latter-day Saints</p>
  </div>
  <p class="kicker">Summary</p>                    <!-- optional -->
</header>
```

- Strip `Presented by ` or `By ` from `.author-name`.
- The first token is an honorific only if it is one of `Elder`, `President`,
  `Sister`, `Brother`, `Bishop`. Otherwise the whole string is the name.
- `speaker.title.short` is the honorific; `speaker.title.full` is
  `.author-role`.
- Always write `short`, even when it is an empty string. The RSS generator
  interpolates it directly; a missing value produces the literal text
  `undefined` in the author field.
- A no-honorific administrative report (for example
  `Presented by Jared B. Larson`) gets `short: ''` by default. Use
  `Brother`/`Sister` if the speaker's form of address is known.

## Summary

Use `header .kicker`. It is the talk's one-sentence summary. It is optional:
administrative items such as a solemn assembly or sustaining of officers may
have no kicker. Do not use `header p:first-of-type`; a `p.subtitle` scripture
reference can appear before the byline.

## People YAML

```yaml
id: hutch-u-fale
name: Hutch U. Fale
website: https://www.churchofjesuschrist.org/learn/hutch-u-fale?lang=eng
photo: https://www.churchofjesuschrist.org/imgs/h3uh1c23vtjt8rwow087syz0p8fprwdacjfj6xuw/full/!390,/0/default
```

- `id` — matches the filename and the talk `speaker.id`.
- `name` — display name without the honorific.
- `website` — official `https://www.churchofjesuschrist.org/learn/<slug>?lang=eng`
  page.
- `photo` — `https://www.churchofjesuschrist.org/imgs/<image-id>/full/!390,/0/default`.
  The `!390,` variant is 390px wide and matches existing portraits.
- Verify the `/learn/` slug. The byline name and the official page slug can
  differ: `James G. O. Fantone` uses `james-o-fantone`.
- `scripts/collect-people-data.ts` skips people who already have both `website`
  and `photo`, so these fields protect the official page from later enrichment.

## RSS generation notes

`scripts/create-rss/general-conference.ts`:

- Reads all folders under `data/episodes/general-conference/`.
- Uses the first episode's `metadata.season` for the feed title and season.
- Builds the author as
  `` `${speaker.title.short} ${speaker.name}, ${speaker.title.full}`.trim() ``.
  This is why a missing `short` becomes `undefined`.
- `generatePubDate` maps session 1–5 to 10:00–18:00 local time and offsets by
  `sequence * 5` minutes. The mapping still works for four-session conferences;
  sessions 3 and 4 are on Sunday and get 14:00/16:00.
- Feed output is `out/general-conference/<year>-<monthName>.rss`, plus
  `all.rss`. `out/` is gitignored.

## Validation and CI

`npm run validate:yaml` runs `scripts/validate.ts`. It checks required fields,
id/filename agreement, id format, date format, duration numeric, season numeric,
and that every `speaker.id` exists in `data/people/`.

`.github/workflows/validate-metadata.yml` runs that validator on pull requests
that touch `data/episodes/**`. It does not build feeds.

## Known pitfalls

- Do not assume five sessions. 2026 has four.
- Do not copy the first-of-month date from older data.
- Do not use `header.p[0]` for the summary; use `.kicker`.
- Do not blindly strip the first word of the byline. "Presented by Jared B.
  Larson" has no honorific.
- Do not omit `short`; it produces `undefined` in the RSS author.
- Do not use a news article as a speaker website.
- Do not commit `out/`; it is generated and gitignored.
