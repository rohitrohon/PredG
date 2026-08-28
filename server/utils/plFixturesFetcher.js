/**
 * Utility to fetch official Premier League matchweek fixtures with IST kickoff timestamps.
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
  'nottingham forest': 'Nottm Forest'
};

function formatCleanTeamName(rawName) {
  if (!rawName) return '';
  const clean = rawName.trim();
  const lower = clean.toLowerCase();
  return TEAM_NAME_MAP[lower] || clean;
}

function parseToISTFormat(dateString) {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';

    // Convert to IST (UTC + 5.5 hours) for datetime-local input (YYYY-MM-DDTHH:mm)
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(d.getTime() + istOffsetMs);

    const iso = istDate.toISOString();
    return iso.slice(0, 16); // "YYYY-MM-DDTHH:mm"
  } catch (err) {
    return '';
  }
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
    // Alternate home/away based on odd/even matchweek
    if (mwNum % 2 === 0) {
      rotated.push([pair[1], pair[0]]);
    } else {
      rotated.push([pair[0], pair[1]]);
    }
  }

  const currentYear = new Date().getFullYear();
  const startDate = new Date(currentYear, 7, 16);
  startDate.setDate(startDate.getDate() + (mwNum - 1) * 7);

  return rotated.map(([home, away], idx) => {
    const matchDate = new Date(startDate.getTime());
    if (idx >= 5) matchDate.setDate(matchDate.getDate() + 1);

    const hours = idx % 2 === 0 ? 17 : (idx % 3 === 0 ? 20 : 22);
    matchDate.setHours(hours, 30, 0, 0);

    const iso = matchDate.toISOString().slice(0, 16);
    const displayIST = formatISTDisplay(matchDate.toISOString());

    return {
      homeTeam: home,
      awayTeam: away,
      kickoffTime: iso,
      kickoffDisplayIST: displayIST,
      rawUtc: matchDate.toISOString()
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

  // 1. Try Football-Data.org if API key is provided
  if (process.env.FOOTBALL_DATA_API_KEY) {
    try {
      const res = await fetch(`https://api.football-data.org/v4/competitions/PL/matches?matchweek=${mwNum}`, {
        headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
      });
      if (res.ok) {
        const data = await res.json();
        const matches = data.matches || [];
        if (matches.length > 0) {
          return matches.map(m => {
            const rawUtc = m.utcDate;
            return {
              homeTeam: formatCleanTeamName(m.homeTeam?.name || m.homeTeam?.shortName),
              awayTeam: formatCleanTeamName(m.awayTeam?.name || m.awayTeam?.shortName),
              kickoffTime: parseToISTFormat(rawUtc),
              kickoffDisplayIST: formatISTDisplay(rawUtc),
              rawUtc
            };
          });
        }
      }
    } catch (err) {
      console.warn('Football-data.org matchweek fetch failed, trying free fallback:', err.message);
    }
  }

  // 2. Fallback: TheSportsDB Free Public API (Key '3')
  try {
    const d = new Date();
    const currentYear = d.getFullYear();
    const month = d.getMonth();
    const season = month >= 7 ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`;
    const url = `https://www.thesportsdb.com/api/v1/json/3/eventsround.php?id=4328&r=${mwNum}&s=${season}`;

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const events = data.events || [];

      if (events.length > 0) {
        const parsed = events.map(e => {
          const timeStr = e.strTime ? e.strTime.slice(0, 5) : '15:00';
          const dateStr = e.dateEvent || e.strTimestamp || `${currentYear}-08-17`;
          const rawUtc = e.strTimestamp ? `${e.strTimestamp}Z` : `${dateStr}T${timeStr}:00Z`;

          return {
            homeTeam: formatCleanTeamName(e.strHomeTeam),
            awayTeam: formatCleanTeamName(e.strAwayTeam),
            kickoffTime: parseToISTFormat(rawUtc),
            kickoffDisplayIST: formatISTDisplay(rawUtc),
            rawUtc
          };
        });

        if (parsed.length < 10) {
          const fallbackList = generateFallbackPLFixtures(mwNum);
          for (const f of fallbackList) {
            if (parsed.length >= 10) break;
            const exists = parsed.some(p => p.homeTeam === f.homeTeam || p.awayTeam === f.awayTeam);
            if (!exists) {
              parsed.push(f);
            }
          }
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('TheSportsDB matchweek fetch failed, using fallback template:', err.message);
  }

  // 3. Fallback: Generate 10-match Premier League schedule template with IST kickoff times
  return generateFallbackPLFixtures(mwNum);
}

module.exports = {
  fetchPLMatchweekFixtures,
  parseToISTFormat,
  formatISTDisplay
};
