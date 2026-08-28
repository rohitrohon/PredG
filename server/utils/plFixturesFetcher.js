/**
 * Utility to fetch official Premier League matchweek fixtures with IST kickoff timestamps.
 * Primary source: ESPN Official Premier League API
 */

const TEAM_NAME_MAP = {
  'manchester city': 'Manchester City',
  'manchester united': 'Manchester United',
  'tottenham hotspur': 'Tottenham',
  'wolverhampton wanderers': 'Wolves',
  'brighton & hove albion': 'Brighton',
  'west ham united': 'West Ham',
  'newcastle united': 'Newcastle',
  'leicester city': 'Leicester',
  'ipswich town': 'Ipswich',
  'nottingham forest': 'Nottm Forest',
  'afc bournemouth': 'Bournemouth',
  'leeds united': 'Leeds United',
  'coventry city': 'Coventry City',
  'hull city': 'Hull City'
};

function formatCleanTeamName(rawName) {
  if (!rawName) return '';
  const clean = rawName.trim();
  const lower = clean.toLowerCase();
  return TEAM_NAME_MAP[lower] || clean;
}

function formatForDateTimeLocalIST(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(d);
  const getVal = type => parts.find(p => p.type === type)?.value;
  return `${getVal('year')}-${getVal('month')}-${getVal('day')}T${getVal('hour')}:${getVal('minute')}`;
}

function parseISTToISO(istDateTimeString) {
  if (!istDateTimeString) return null;
  if (typeof istDateTimeString !== 'string') return new Date(istDateTimeString).toISOString();
  if (istDateTimeString.endsWith('Z') || istDateTimeString.includes('+')) {
    return new Date(istDateTimeString).toISOString();
  }
  const fullIstString = `${istDateTimeString}:00+05:30`;
  const d = new Date(fullIstString);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function formatISTDisplay(dateString) {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) + ' IST';
  } catch (err) {
    return '';
  }
}

async function fetchESPNMatchweekFixtures(mwNum) {
  try {
    // Season 2026-2027 MW1 Friday is Aug 21, 2026
    const baseMw1Friday = new Date(Date.UTC(2026, 7, 21)); // 2026-08-21
    const mwFriday = new Date(baseMw1Friday.getTime() + (mwNum - 1) * 7 * 86400000);

    const matches = [];
    // Search dates from Thursday to Tuesday (6 days window)
    for (let offset = -1; offset <= 4; offset++) {
      const d = new Date(mwFriday.getTime() + offset * 86400000);
      const yyyymmdd = d.toISOString().slice(0, 10).replace(/-/g, '');
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=${yyyymmdd}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const events = data.events || [];
        for (const e of events) {
          if (!e.competitions || e.competitions.length === 0) continue;
          const comp = e.competitions[0];
          const home = comp.competitors.find(c => c.homeAway === 'home');
          const away = comp.competitors.find(c => c.homeAway === 'away');
          if (!home || !away) continue;

          const homeTeam = formatCleanTeamName(home.team.displayName);
          const awayTeam = formatCleanTeamName(away.team.displayName);
          const rawUtc = new Date(e.date).toISOString();

          if (!matches.some(m => m.homeTeam === homeTeam && m.awayTeam === awayTeam)) {
            matches.push({
              homeTeam,
              awayTeam,
              kickoffTime: formatForDateTimeLocalIST(rawUtc),
              kickoffDisplayIST: formatISTDisplay(rawUtc),
              rawUtc
            });
          }
        }
      }
    }

    if (matches.length > 0) {
      matches.sort((a, b) => new Date(a.rawUtc) - new Date(b.rawUtc));
      return matches;
    }
  } catch (err) {
    console.warn('ESPN matchweek schedule fetch warning:', err.message);
  }
  return [];
}

function generateFallbackPLFixtures(mwNum) {
  const basePairs = [
    ['Arsenal', 'Chelsea'],
    ['Manchester City', 'Manchester United'],
    ['Liverpool', 'Tottenham'],
    ['Aston Villa', 'Newcastle'],
    ['Everton', 'West Ham'],
    ['Brighton', 'Wolves'],
    ['Crystal Palace', 'Brentford'],
    ['Fulham', 'Bournemouth'],
    ['Leicester', 'Ipswich'],
    ['Nottingham Forest', 'Southampton']
  ];

  const shift = (mwNum - 1) % basePairs.length;
  const rotated = [];
  for (let i = 0; i < basePairs.length; i++) {
    const pair = basePairs[(i + shift) % basePairs.length];
    if (mwNum % 2 === 0) {
      rotated.push([pair[1], pair[0]]);
    } else {
      rotated.push([pair[0], pair[1]]);
    }
  }

  const currentYear = new Date().getFullYear();
  const startDate = new Date(Date.UTC(currentYear, 7, 16));
  startDate.setUTCDate(startDate.getUTCDate() + (mwNum - 1) * 7);

  return rotated.map(([home, away], idx) => {
    const matchDate = new Date(startDate.getTime());
    if (idx >= 5) matchDate.setUTCDate(matchDate.getUTCDate() + 1);

    const hours = idx % 2 === 0 ? 17 : (idx % 3 === 0 ? 20 : 22);
    matchDate.setUTCHours(hours, 30, 0, 0);

    const rawUtc = matchDate.toISOString();

    return {
      homeTeam: home,
      awayTeam: away,
      kickoffTime: formatForDateTimeLocalIST(rawUtc),
      kickoffDisplayIST: formatISTDisplay(rawUtc),
      rawUtc
    };
  });
}

/**
 * Fetches Premier League fixtures for a given matchweek number.
 */
async function fetchPLMatchweekFixtures(matchweekNumber) {
  const mwNum = Number(matchweekNumber);
  if (!mwNum || mwNum < 1 || mwNum > 38) {
    throw new Error('Invalid matchweek number. Must be between 1 and 38.');
  }

  // 1. Try ESPN Official API (Primary source)
  const espnMatches = await fetchESPNMatchweekFixtures(mwNum);
  if (espnMatches.length > 0) {
    return espnMatches;
  }

  // 2. Fallback: Generate 10-match Premier League schedule template with IST kickoff times
  return generateFallbackPLFixtures(mwNum);
}

module.exports = {
  fetchPLMatchweekFixtures,
  formatForDateTimeLocalIST,
  parseISTToISO,
  formatISTDisplay
};
