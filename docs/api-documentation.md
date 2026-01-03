# Fantasy Cricket API - Complete Documentation

## Overview
Fantasy API provides scoring, squads, and points information for cricket matches.
- APIs are only available under the Paid plan
- Using under 'Lifetime Free' plan has a usage penalty

**Important Note:** All matches may not be available in the Fantasy Cricket APIs. If you query using unavailable match IDs, you will receive an error.

---

## Available Fantasy APIs

### 1. Fantasy Squad API
**Endpoint:** `https://api.cricapi.com/v1/match_squad`

**Purpose:** Squad details of a specific match. Provides as much detail as available for the Squad for a given match.

**Prerequisites:** You need to get the match ID from the Match List APIs first.

**Response Structure:**

| Field | Type | Description |
|-------|------|-------------|
| status | String | success / failure based on the API result |
| data | Array | Contains exactly 2 JSON objects, one for each team |
| data[0] | Object | Team 1 name and player details |
| data[0].teamName | String | Name of the team |
| data[0].players | Array | Array of players with relevant basic info |
| data[1] | Object | Team 2 name and player details |

---

### 2. Fantasy Scorecard API
**Endpoint:** `https://api.cricapi.com/v1/match_scorecard`

**Purpose:** Provides the scorecard information for the match in question (also called Fantasy Summary in CricAPI).

**Response Structure:**

| Field | Type | Description |
|-------|------|-------------|
| status | String | success / failure based on the API result |
| data | Object | Contains details about the match |
| data.name | String | Name of the match |
| data.matchType | String | Match type (t20, odi, test) |
| data.status | String | Status of the match |
| data.venue | String | Venue of the match |
| data.date | Date | Date of the match without time |
| data.dateTimeGMT | DateTime | GMT Date and Time in ISO Format |
| data.teams | Array | Team names as an array |
| data.score | Object | Score information with Runs, Wickets, Overs, Innings |
| data.tossWinner | String | Team that won the toss |
| data.tossChoice | String | Choice made by Toss winners |
| data.matchWinner | String | Team that won the match |
| data.series_id | Guid | Series this match belongs to |
| data.scorecard | Array | Array of Innings with scorecard details |

**Scorecard Inning Object:**

| Field | Type | Description |
|-------|------|-------------|
| batting | Array | Batting information on a per-Batsman basis |
| bowling | Array | Bowling information on a per-Bowler basis |
| catching | Array | Catching/Fielding information on a per-Catcher basis |
| extras | Object | Collation of all Extras in this inning |
| totals | Object | Total summation of the scorecard for this inning |
| inning | String | Team / inning identifier |

---

### 3. Fantasy Ball-By-Ball API
**Endpoint:** `https://api.cricapi.com/v1/match_bbb`

**Status:** In Testing - Details coming soon!

---

### 4. Fantasy Points API
**Endpoint:** `https://api.cricapi.com/v1/match_points`

**Purpose:** Points calculation based on your Rule Set. Gives Player-wise, Inning-wise and Role-wise (batting/bowling/catching) Points evaluation.

**Important:** If you use this while the match is on, the points can fluctuate up/down based on your Ruleset rules.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| apikey | String | Yes | Your API key |
| id | String | Yes | Match ID |
| ruleset | Number | No | Ruleset ID (default: 0 for Default Ruleset) |

**Response Structure:**

| Field | Type | Description |
|-------|------|-------------|
| status | String | success / failure based on the API result |
| data | Object | Contains points data |
| data.innings | Array | Array of objects, one for each inning |
| innings[].batting | Array | Batting points on a per-Batsman basis |
| innings[].bowling | Array | Bowling points on a per-Bowler basis |
| innings[].catching | Array | Catching/Fielding points on a per-Catcher basis |
| innings[].inning | String | Team / inning identifier |
| data.totals | Array | Array of objects, one each per Active Player |

---

## Custom Ruleset
You can create a custom Ruleset in your Member Area to customize how fantasy points are calculated. Otherwise, the Default Ruleset will be used.

---

## API Usage Notes
1. Fantasy APIs require a paid subscription
2. Not all matches have fantasy data available
3. Check `fantasyEnabled` flag in match data before calling Fantasy APIs
4. Points can change during live matches based on ruleset rules
5. Always handle error responses gracefully

---

## Base URL
`https://api.cricapi.com/v1/`

## Authentication
All API calls require the `apikey` parameter with your valid API key.

## Required Parameters for All Endpoints
- `apikey` - Your API key (Required)
- `id` - Match ID (Required)
