const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

let cachedStandings = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours cache

const TEAM_ALIASES = {
  'man city': 'manchester city',
  'mancity': 'manchester city',
  'man utd': 'manchester united',
  'manutd': 'manchester united',
  'man united': 'manchester united',
  'spurs': 'tottenham hotspur',
  'tottenham': 'tottenham hotspur',
  'wolves': 'wolverhampton wanderers',
  'wolverhampton': 'wolverhampton wanderers',
  'west ham': 'west ham united',
  'brighton': 'brighton & hove albion',
  'newcastle': 'newcastle united',
  'leicester': 'leicester city',
  'ipswich': 'ipswich town',
  'forest': 'nottingham forest'
};

function normalizeTeamName(name) {
  if (!name || typeof name !== 'string') return '';
  const clean = name.trim().toLowerCase();
  return TEAM_ALIASES[clean] || clean;
}

/**
 * Fetches real Premier League standings (all 20 teams) using ESPN Official API with DB & 24h caching.
 */
async function getPremierLeagueStandings(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedStandings && (now - lastFetchTime < CACHE_DURATION_MS)) {
    return cachedStandings;
  }

  // Look up DB cache first if not forcing refresh
  if (!forceRefresh && mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      const PLCache = require('../models/PLCache');
      const dbRecord = await PLCache.findOne({ dataType: 'standings' });
      if (dbRecord && dbRecord.data && dbRecord.data.length > 0) {
        cachedStandings = dbRecord.data;
        lastFetchTime = now;
        return cachedStandings;
      }
    } catch (e) {
      // Ignore DB read error, fall through to fetch
    }
  }

  // Option 1: ESPN Official Standings API (Primary Source - All 20 Teams)
  try {
    const url = 'https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings';
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const children = data.children || [];
      const entries = children[0]?.standings?.entries || [];
      if (entries.length > 0) {
        cachedStandings = entries.map((item, idx) => {
          const teamName = item.team?.displayName || item.team?.name || '';
          const stats = item.stats || [];
          const pts = stats.find(s => s.name === 'points')?.value ?? 0;
          const gd = stats.find(s => s.name === 'pointDifferential')?.value ?? 0;
          return {
            teamName,
            normalizedName: normalizeTeamName(teamName),
            rank: idx + 1,
            points: Number(pts),
            goalDifference: Number(gd)
          };
        });
        lastFetchTime = now;
        return cachedStandings;
      }
    }
  } catch (err) {
    console.warn('ESPN standings fetch failed, trying fallback API:', err.message);
  }

  // Option 2: Football-Data.org (if API key is provided)
  if (process.env.FOOTBALL_DATA_API_KEY) {
    try {
      const res = await fetch('https://api.football-data.org/v4/competitions/PL/standings', {
        headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
      });
      if (res.ok) {
        const data = await res.json();
        const standingsTable = data.standings?.[0]?.table || [];
        if (standingsTable.length > 0) {
          cachedStandings = standingsTable.map(item => ({
            teamName: item.team.name,
            normalizedName: normalizeTeamName(item.team.name),
            rank: item.position,
            points: item.points,
            goalDifference: item.goalDifference
          }));
          lastFetchTime = now;
          return cachedStandings;
        }
      }
    } catch (err) {
      console.warn('Football-data.org fetch failed:', err.message);
    }
  }

  return cachedStandings || [];
}

/**
 * Returns team rank in Premier League (1 is best, 20 is lowest). Returns 99 if not found.
 */
async function getTeamPLRank(teamName) {
  const standings = await getPremierLeagueStandings();
  if (!standings || standings.length === 0) return 99;

  const target = normalizeTeamName(teamName);
  const found = standings.find(s => {
    const norm = s.normalizedName;
    return norm === target || norm.includes(target) || target.includes(norm);
  });

  return found ? found.rank : 99;
}

module.exports = {
  getPremierLeagueStandings,
  getTeamPLRank
};
