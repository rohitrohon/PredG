# PREDICTION GAME 3.0

## Important Changes of Prediction Game 3.0
* **5 Categories:** Instead of 4 categories, in Prediction Game 3.0, predictions are made for 5 categories:
  * Match Result
  * Scoreline
  * Team to score 1st Goal
  * Team which will have greater Possession
  * Wild Prediction (Optional)
* **Maximum Cap for Gamble Points:** Introducing a Maximum Cap for Gamble points based on your rank in the Points table:
  * Top 5 can gamble a maximum of 500 points in a match (added condition to 25% points).
  * Bottom 5 can gamble a maximum of 1000 points in a match (added condition to 25% points).
* **Autofill:** If somebody is unable to fill their prediction by the deadline, autofill will be applied.

---

## TABLE OF CONTENTS
1. [What is Prediction Game?](#1-what-is-prediction-game)
2. [Predictions](#2-predictions)
3. [Auto Fill](#3-auto-fill)
4. [Point System](#4-point-system)
5. [Wild Prediction](#5-wild-prediction)
6. [Additional Features](#6-additional-features)
7. [Captain and Bonus](#7-captain-and-bonus)
8. [Gamble](#8-gamble)
9. [Battle](#9-battle)
10. [Market](#10-market)

---

## 1. What is Prediction Game?
* **Exclusive Tournament:** Prediction Game is an exclusive tournament of Odisha Spurs.
* **Duration:** Runs for the entire length of the Premier League Season (for 38 matchweeks).
* **Game Selection:** For each matchweek, 5 games are selected out of 10 Premier League games.
* **5 Categories:** For each selected game, predictions are done for 5 categories:
  1. Match Result
  2. Scoreline
  3. Team to score 1st Goal
  4. Team which will have greater Possession
  5. Wild Prediction (Optional)
* **Deadline:** Submission deadline is **1 hour before the start of the first game** of the matchweek.
* **Prizes:** Points are accumulated throughout the season and top 3 participants are awarded prizes.
* **Fixture Selection:** Selection of fixtures is done by participants on a rotation basis.
* **Lock-in:** Predictions once submitted cannot be modified or altered during the matchweek.

---

## 2. Predictions

### Mandatory Predictions
Suppose a match is between **Team A vs Team B** (where Team A is the home team). While giving predictions, one option for each category must be selected for the match:

| Category | Options |
| :--- | :--- |
| **MATCH RESULT** | Team A, Team B, Draw |
| **SCORELINE** | Home Team score - Away Team score (e.g., `1-0`, `2-1`) + Safe Bet (Home / Away) |
| **1ST GOAL** | Team A, Team B, No goal |
| **POSSESSION** | Team A, Team B, Equal Possession |

---

## 3. Auto Fill
*(If a participant fails to submit predictions before the deadline, the auto-fill mechanism automatically populates predictions for that matchweek).*

---

## 4. Point System

### General Categories (Match Result, 1st Goal, Possession)
Points awarded depend on correctness and prediction distribution among participants. The 5 denominations of points are: **100, 50, 20, 10, 0**.

| Group Condition | Definition / Criteria | Points |
| :--- | :--- | :--- |
| **Unique** | Only 1 person predicted this correct outcome | **100** |
| **Minority Group** | A smaller group predicted this correct outcome | **50** |
| **Majority Group** | The larger group predicted this correct outcome | **20** |
| **Same** | Everyone predicted the exact same correct outcome | **10** |
| **Incorrect** | Prediction was incorrect | **0** |

> **Note on Minority Group:** If the number of people predicting two different outcomes is equal, both are considered minority groups.  
> *Example (MUN vs CRY with 8 players):*  
> - 2 predict MUN win (Minority)  
> - 2 predict CRY win (Minority)  
> - 4 predict Draw (Majority)  

---

### Scoreline Point System
Scoreline predictions are evaluated based on exactness and sub-criteria:

| Condition | Points Awarded |
| :--- | :--- |
| **Exactly Correct** | **100** |
| **Safe Bet Correct** | **50** |
| **Away Goal Correct** | **20** |
| **Home Goal Correct** | **10** |
| **Incorrect** | **0** |

#### Example (Newcastle vs Aston Villa):
Predicted Scoreline: `3-2` | Safe Bet: `Home`

* **Case 1:** Match ends `3-2` $ightarrow$ **100 points** (Exactly correct)
* **Case 2:** Match ends `3-0` $ightarrow$ **50 points** (Safe bet correct)
* **Case 3:** Match ends `1-2` $ightarrow$ **20 points** (Away goal correct)
* **Case 4:** Match ends `2-1` $ightarrow$ **0 points** (Incorrect)

---

## 5. Wild Prediction
*(Optional category introduced in 3.0 for extra strategy and variance).*

---

## 6. Additional Features
There are five main features beyond base predictions:
1. **Captain** (Starts MW 1) - Default
2. **Bonus** (Starts MW 1) - Default
3. **Battle** (Starts MW 2) - Default
4. **Gamble** (Starts MW 2) - Optional
5. **Market** (Starts MW 3) - Optional

---

## 7. Captain and Bonus

### Captain (2x Multiplier)
* One of the 5 selected matches must be designated as **Captain**.
* Points obtained from the Captain match are doubled ($2	imes$).

### Bonus (+50 Points)
* If a participant scores points ($10, 20, 50, 	ext{or } 100$) in **all four core categories** for a single match, a bonus of **50 points** is awarded for that match.

---

## 8. Gamble
* **Availability:** Matchweek 2 onwards.
* **Limit:** Maximum 10% of total available points (subject to rank caps: Top 5 max 500, Bottom 5 max 1000).
* **Selection:** Must select "Yes", specify points amount, and select 1 match to gamble upon.

| Match Performance | Outcome |
| :--- | :--- |
| Points scored in **all 4 categories** | Gambled points **DOUBLED** ($+2	imes$) |
| Points scored in **3 categories** | Gambled points **RETAINED** ($0$) |
| Points scored in **less than 3 categories** | Gambled points **DEDUCTED** ($-1	imes$) |

### Combining Gamble and Captain:
If the Gamble match is also selected as Captain, the net gamble effect is doubled ($2	imes$):
* **Case 1:** All 4 categories correct $ightarrow$ Gambled 50 pts become $+100 	imes 2 = \mathbf{+200	ext{ pts}}$.
* **Case 2:** Only 2 categories correct $ightarrow$ Gambled 50 pts become $-50 	imes 2 = \mathbf{-100	ext{ pts}}$.

---

## 9. Battle
* **Availability:** Matchweek 2 onwards.
* **Pairings:** Based on overall table standings (e.g., 8 players: 1 vs 8, 2 vs 7, 3 vs 6, 4 vs 5).
* **Match:** A single Battle Match is selected for everyone each week.
* **Mechanism:** Category-by-category comparison between opponents:
  * **Green:** You scored higher than opponent in category.
  * **Red:** You scored lower than opponent in category.
  * **Yellow:** You scored equal points as opponent in category.

| Battle Outcome | Points |
| :--- | :--- |
| **Win** (More category wins/greens) | **3 Battle Points** |
| **Draw** (Equal category wins/greens) | **1 Battle Point** |
| **Clean Sweep** (4 greens out of 4) | **5 Battle Points** |

*Battle Points can be accumulated and redeemed in the Market.*

---

## 10. Market
* **Availability:** Matchweek 3 onwards.
* Battle points can be redeemed for tactical power-ups:

| Item | Cost | Effect |
| :--- | :--- | :--- |
| **Double** | 5 Battle Points | Doubles points of selected match ($2	imes$) |
| **Triple** | 10 Battle Points | Triples points of selected match ($3	imes$) |
| **Shield** | 15 Battle Points | Protects Gamble match from point deduction |

### Rules & Stacking:
* Items cannot be hoarded; redeemed items **must be used in that matchweek**.
* Items can be combined on the same or different matches.
* **Example Stacking:**  
  Applying **Double** ($2	imes$) and **Triple** ($3	imes$) on the same match gives $2 	imes 3 = \mathbf{6	imes}$.  
  If that match is also **Captained** ($2	imes$), the overall multiplier becomes $6 	imes 2 = \mathbf{12	imes}$ total points!
