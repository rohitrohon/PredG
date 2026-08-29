/**
 * Utility to fetch official Premier League match result stats (scores, yellow cards, shots, offsides, corners, first goal, possession).
 * Required for PredG prediction game scoring and wild card predictions.
 * Uses ESPN Official API as primary source for 100% exact stats, with TheSportsDB as fallback.
 */

const TEAM_ALIASES = {
  'nottm forest': ['nottingham forest', 'nottingham', 'nottm forest', 'forest'],
  'nottingham forest': ['nottingham forest', 'nottingham', 'nottm forest', 'forest'],
  'man utd': ['manchester united', 'man utd', 'manutd', 'man united'],
  'manchester united': ['manchester united', 'man utd', 'manutd', 'man united'],
  'man city': ['manchester city', 'man city', 'mancity'],
  'manchester city': ['manchester city', 'man city', 'mancity'],
  'spurs': ['tottenham hotspur', 'tottenham', 'spurs'],
  'tottenham': ['tottenham hotspur', 'tottenham', 'spurs'],
  'wolves': ['wolverhampton wanderers', 'wolverhampton', 'wolves'],
  'wolverhampton': ['wolverhampton wanderers', 'wolverhampton', 'wolves'],
  'west ham': ['west ham united', 'west ham'],
  'brighton': ['brighton & hove albion', 'brighton'],
  'newcastle': ['newcastle united', 'newcastle'],
  'leicester': ['leicester city', 'leicester'],
  'ipswich': ['ipswich town', 'ipswich']
};

function teamMatches(dbName, apiName) {
  if (!dbName || !apiName) return false;
  const dbLower = dbName.trim().toLowerCase();
  const apiLower = apiName.trim().toLowerCase();

  if (apiLower.includes(dbLower) || dbLower.includes(apiLower)) return true;

  const aliases = TEAM_ALIASES[dbLower];
  if (aliases) {
    return aliases.some(alias => apiLower.includes(alias) || alias.includes(apiLower));
  }
  return false;
}

async function fetchMatchResultStats(homeTeam, awayTeam, dateStr, eventId) {
  // If only 1 or 2 arguments passed (e.g. eventId as first arg)
  if (!awayTeam && homeTeam) {
    eventId = homeTeam;
    homeTeam = '';
    awayTeam = '';
  }

  // 1. Primary Source: ESPN Official Stats API
  if (homeTeam && awayTeam) {
    try {
      let espnUrl = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard';
      if (dateStr) {
        const cleanDate = dateStr.replace(/-/g, '').slice(0, 8);
        espnUrl += `?dates=${cleanDate}`;
      }
      const resScore = await fetch(espnUrl);
      if (resScore.ok) {
        const dataScore = await resScore.json();
        const events = dataScore.events || [];

        const matchEvent = events.find(e => {
          const name = e.name || '';
          return teamMatches(homeTeam, name) && teamMatches(awayTeam, name);
        });

        if (matchEvent) {
          const statusState = matchEvent.status?.type?.state;
          // If match has not kicked off yet (scheduled / 'pre'), no actual results exist yet
          if (statusState === 'pre') {
            return null;
          }

          const resSum = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/summary?event=${matchEvent.id}`);
          if (resSum.ok) {
            const sumData = await resSum.json();
            const boxscore = sumData.boxscore;
            if (boxscore && boxscore.teams && boxscore.teams.length >= 2) {
              const homeObj = boxscore.teams.find(t => t.homeAway === 'home') || boxscore.teams[0];
              const awayObj = boxscore.teams.find(t => t.homeAway === 'away') || boxscore.teams[1];

              const getVal = (teamObj, statName) => {
                if (!teamObj || !teamObj.statistics) return 0;
                const s = teamObj.statistics.find(i => i.name === statName);
                return s ? Number(s.displayValue) : 0;
              };

              const hYellow = getVal(homeObj, 'yellowCards');
              const aYellow = getVal(awayObj, 'yellowCards');
              const hCorners = getVal(homeObj, 'wonCorners');
              const aCorners = getVal(awayObj, 'wonCorners');
              const hOffsides = getVal(homeObj, 'offsides');
              const aOffsides = getVal(awayObj, 'offsides');
              const hShots = getVal(homeObj, 'totalShots');
              const aShots = getVal(awayObj, 'totalShots');
              const hPoss = getVal(homeObj, 'possessionPct');
              const aPoss = getVal(awayObj, 'possessionPct');

              const comps = sumData.header?.competitions?.[0]?.competitors || [];
              const hComp = comps.find(c => c.homeAway === 'home') || comps[0];
              const aComp = comps.find(c => c.homeAway === 'away') || comps[1];

              const homeScore = hComp ? Number(hComp.score || 0) : 0;
              const awayScore = aComp ? Number(aComp.score || 0) : 0;

              let result = 'Draw';
              if (homeScore > awayScore) result = 'Home';
              else if (awayScore > homeScore) result = 'Away';

              let possession = 'Equal';
              if (hPoss > aPoss) possession = 'Home';
              else if (aPoss > hPoss) possession = 'Away';

              return {
                source: 'ESPN Official API',
                match: `${homeTeam} vs ${awayTeam}`,
                actualResults: {
                  homeScore,
                  awayScore,
                  result,
                  firstGoal: homeScore > 0 ? 'Home' : (awayScore > 0 ? 'Away' : 'No goal'),
                  possession,
                  yellowCards: hYellow + aYellow,
                  offsides: hOffsides + aOffsides,
                  corners: hCorners + aCorners,
                  shots: hShots + aShots
                },
                breakdown: {
                  yellowCards: `Home (${hYellow}) + Away (${aYellow}) = ${hYellow + aYellow}`,
                  corners: `Home (${hCorners}) + Away (${aCorners}) = ${hCorners + aCorners}`,
                  offsides: `Home (${hOffsides}) + Away (${aOffsides}) = ${hOffsides + aOffsides}`,
                  shots: `Home (${hShots}) + Away (${aShots}) = ${hShots + aShots}`
                }
              };
            }
          }
        }
      }
    } catch (err) {
      console.warn('ESPN match stats fetch failed, falling back to SportsDB:', err.message);
    }
  }

  // 2. Fallback: TheSportsDB API with exact non-double-counting calculation
  if (eventId) {
    try {
      const resEvent = await fetch(`https://www.thesportsdb.com/api/v1/json/3/lookupevent.php?id=${eventId}`);
      if (resEvent.ok) {
        const dEvent = await resEvent.json();
        const event = dEvent.events ? dEvent.events[0] : null;
        if (event) {
          const strStatus = (event.strStatus || '').toLowerCase();
          if (strStatus.includes('not started') || strStatus.includes('postponed') || strStatus.includes('ns')) {
            return null;
          }

          const homeScore = event.intHomeScore !== null && event.intHomeScore !== undefined ? Number(event.intHomeScore) : null;
          const awayScore = event.intAwayScore !== null && event.intAwayScore !== undefined ? Number(event.intAwayScore) : null;
          
          let result = null;
          if (homeScore !== null && awayScore !== null) {
            if (homeScore > awayScore) result = 'Home';
            else if (awayScore > homeScore) result = 'Away';
            else result = 'Draw';
          }

          const resStats = await fetch(`https://www.thesportsdb.com/api/v1/json/3/lookupeventstats.php?id=${eventId}`);
          const dStats = resStats.ok ? await resStats.json() : {};
          const statsList = dStats.eventstats || [];

          let shotsInside = 0;
          let shotsOutside = 0;
          let totalShotsExact = 0;
          let cornersExact = 0;
          let offsidesExact = 0;
          let yellowCardsExact = 0;
          let possessionWinner = null;

          statsList.forEach(s => {
            const name = (s.strStat || '').toLowerCase();
            const h = Number(s.intHome || 0);
            const a = Number(s.intAway || 0);

            if (name === 'shots insidebox') shotsInside += (h + a);
            else if (name === 'shots outsidebox') shotsOutside += (h + a);
            else if (name === 'total shots') totalShotsExact += (h + a);
            else if (name.includes('corner')) cornersExact += (h + a);
            else if (name.includes('offside')) offsidesExact += (h + a);
            else if (name.includes('yellow card')) yellowCardsExact += (h + a);
            else if (name.includes('possession')) {
              if (h > a) possessionWinner = 'Home';
              else if (a > h) possessionWinner = 'Away';
              else possessionWinner = 'Equal';
            }
          });

          const calculatedShots = totalShotsExact > 0 ? totalShotsExact : (shotsInside + shotsOutside);

          // Timeline for first goal
          const resTimeline = await fetch(`https://www.thesportsdb.com/api/v1/json/3/lookuptimeline.php?id=${eventId}`);
          const dTimeline = resTimeline.ok ? await resTimeline.json() : {};
          const timeline = dTimeline.timeline || [];

          let firstGoal = 'No goal';
          if (homeScore > 0 || awayScore > 0) {
            const goalEvent = timeline.find(t => t.strTimelineDetail && (t.strTimelineDetail.includes('Goal') || t.strTimelineDetail.includes('Penalty')));
            if (goalEvent) {
              firstGoal = (goalEvent.idTeam === event.idHomeTeam) ? 'Home' : 'Away';
            } else {
              firstGoal = homeScore > 0 ? 'Home' : 'Away';
            }
          }

          const cardEvents = timeline.filter(t => t.strTimelineDetail && t.strTimelineDetail.includes('Yellow Card'));
          if (cardEvents.length > 0 && yellowCardsExact === 0) {
            yellowCardsExact = cardEvents.length;
          }

          return {
            source: 'TheSportsDB (Corrected Math)',
            match: `${event.strHomeTeam} vs ${event.strAwayTeam}`,
            actualResults: {
              homeScore,
              awayScore,
              result,
              firstGoal,
              possession: possessionWinner || (homeScore >= awayScore ? 'Home' : 'Away'),
              yellowCards: yellowCardsExact,
              offsides: offsidesExact,
              corners: cornersExact,
              shots: calculatedShots
            },
            breakdown: {
              shots: `Shots insidebox + Shots outsidebox = ${calculatedShots}`
            }
          };
        }
      }
    } catch (err) {
      console.error('TheSportsDB fetch failed:', err.message);
    }
  }

  return null;
}

module.exports = {
  fetchMatchResultStats
};
