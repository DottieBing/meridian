# How Meridian scores a website

Method version: `website-score/2`
Source of truth: `packages/engines/website/src/scores.ts`

Every score in Meridian is plain arithmetic on stored findings. Nothing is estimated, nothing is learned from outcomes, and nothing is hidden. Each point deducted can be traced to a finding, and each finding carries its own evidence.

## What the score is, and what it is not

The website health score is a summary of the problems our automated checks found on a business's website. It answers one question: how much measurable trouble does this site show?

It is **not**:

- a prediction of whether the business will reply to outreach,
- a judgement of the business itself,
- proof that a site is broken. Many findings are observations that deserve a human look.

A high score means "our checks found little", not "this site is excellent". Checks that need a real browser (mobile layout, real load performance) are not part of the score yet.

## Which audits get a score

Only audits whose outcome is `ok`. Sites that were dead, unreachable, blocked, blocked by robots.txt, or that had no readable page get **no score** (shown as a dash). A site we could not look at is unknown, not perfect.

## Step 1: points per finding

Each finding costs points by severity:

| Severity | Points |
|---|---|
| critical | 40 |
| high | 20 |
| medium | 10 |
| low | 4 |
| info | 1 |

A finding that is a **judgement** rather than an observed fact (`isObjective = false`) costs **half** as much. Observed facts are things read directly from page code, headers or files. Judgements are our opinion, for example "tracking tags are loaded but no cookie-consent tool was recognised".

## Step 2: category scores

Findings belong to a category. Each category starts at **100** and loses the points of its findings, never going below 0.

| Category | What it covers |
|---|---|
| security | HTTPS, mixed content, security headers, known-vulnerable or end-of-life software versions |
| performance | compression, page size, redirects, render-blocking scripts, server response time |
| seo | titles, canonical links, sitemaps, robots.txt, structured data, social previews |
| accessibility | language declaration, image alt text, zoom restrictions |
| technical | unmaintained libraries and frameworks, Flash content, dead analytics, consent tooling |
| ux | mobile and usability checks (today only the viewport tag; more arrive with the browser tier) |

Findings in a category not listed here do not affect the score.

## Step 3: website health

Health starts at **100** and loses every category's deducted points, each multiplied by a weight:

| Category | Multiplier |
|---|---|
| security | 1.2 |
| performance | 1.2 |
| seo | 1.2 |
| accessibility | 0.9 |
| technical | 0.9 |
| ux | 0.6 |

```
health = max(0, round(100 - sum over categories of (multiplier x min(category points, 100))))
```

The multipliers say which problems matter more to a business owner. Mobile has the lowest weight today only because we measure so little of it; that will be revisited when the browser tier lands.

## Bands

| Health | Band |
|---|---|
| 85 and above | good |
| 70 to 84 | fair |
| 50 to 69 | weak |
| below 50 | poor |

## Worked example

A site has three findings:

- security, high, observed fact: 20 points
- seo, medium, judgement: 10 x 0.5 = 5 points
- seo, low, observed fact: 4 points

Category scores: security 100 - 20 = **80**, seo 100 - 9 = **91**, every other category 100.

Health: 100 - (20 x 1.2 + 9 x 1.2) = 100 - 34.8 = 65.2, which rounds to **65**, band **weak**.

This exact case is a unit test (`scores are documented arithmetic on the findings` in `rules.test.ts`), so the document and the code cannot silently drift apart.

## Where scores are stored

In the audit's investigation record: `summary.scores`, containing the method version, the health score, the band, each category's score, points, weighted deduction and finding count, and the list of findings that cost points. The Website Audit tab shows all of it, including a "-N" chip on every finding that cost points.

The Leads page reads the health score of each business's latest completed audit.

## Changing the method

1. Edit the constants in `scores.ts`.
2. Change `SCORE_METHOD_VERSION` (for example to `website-score/3`).
3. Update this document and the unit test.
4. Run `pnpm --filter @meridian/website rescore`. It recomputes every stored audit from its stored findings in seconds, with no re-audit.

Old scores are overwritten by the rescore, so the version string in each stored score always tells you which method produced it.

## Lead scores (`lead-scores/1`)

Source of truth: `packages/engines/website/src/lead-scores.ts` (these move to the opportunity engine when it is built).

These two scores describe a business, not its website. They are calculated on request from stored data and are not saved, so a new contact or a fresh audit changes them immediately.

### Contactability, 0 to 100

How many independent ways we can reach the business, based on stored contact points that are not stale. Each channel type counts once, however many of that type were found.

| Channel | Points |
|---|---|
| Email (only counts if it is not a privacy/legal, no-reply or technical mailbox) | 45 |
| Phone | 20 |
| Contact form | 15 |
| Social profile | 10 |
| Address | 10 |

This measures reach, not willingness. It says nothing about whether the business would answer.

### Data completeness, 0 to 100

How much we know about the business, with a list of what is still missing.

| Item | Points | Applies when |
|---|---|---|
| Industry known | 5 | always |
| Niche known | 5 | always |
| City known | 5 | always |
| Website address known | 15 | always |
| Website audited successfully | 25 | the business has a website |
| At least 3 pages audited | 10 | the business has a website |
| Technologies identified | 10 | the business has a website |
| Contact scan completed | 10 | always |
| At least one contact point stored | 15 | always |

Score = points earned divided by the points of the items that apply, as a percentage. A business with no website is not penalised for steps that cannot happen; it simply has fewer applicable items.

### Changing the lead scores

Edit `lead-scores.ts`, change `LEAD_SCORE_METHOD_VERSION`, update this section and the unit test. Nothing needs recomputing.

## Known limits

- Rules only see what the page code, headers and files show. A tool loaded late by JavaScript, or a technology hidden behind a CDN, may be missed.
- Version-based findings (old jQuery, end-of-life PHP) rely on versions the site reports. Hosts sometimes patch older versions themselves, and the finding text says so.
- Sites that block our crawler are not scored. They are a separate "needs a manual look" group.
- The constants are a considered first version, tuned on the first 185 audited sites. They should be revisited when the browser tier adds mobile and real performance measurements.
