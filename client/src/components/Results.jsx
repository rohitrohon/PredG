import React, { useEffect, useState } from 'react';
import api from '../api';
import { BarChart3, LineChart, Award, TrendingUp, Clock, CheckCircle } from 'lucide-react';

// Temperature color gradient styles helper matching spreadsheet screenshot
const getTemperatureStyle = (pts, hasScore) => {
  if (!hasScore || pts === null || pts === undefined) {
    return { textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' };
  }
  // Darker shade of red (#ea9999) for 0 points, matching the Google Sheets exactly
  if (pts <= 0) {
    return { backgroundColor: '#ea9999', color: '#5c0000', textAlign: 'right', fontWeight: 600 };
  }
  if (pts <= 10) {
    return { backgroundColor: '#fce5cd', color: '#783f04', textAlign: 'right', fontWeight: 600 };
  }
  if (pts <= 20) {
    return { backgroundColor: '#fff2cc', color: '#7f6000', textAlign: 'right', fontWeight: 600 };
  }
  if (pts <= 50) {
    return { backgroundColor: '#d9ead3', color: '#274e13', textAlign: 'right', fontWeight: 700 };
  }
  if (pts <= 100) {
    return { backgroundColor: '#b6d7a8', color: '#134f30', textAlign: 'right', fontWeight: 800 };
  }
  return { backgroundColor: '#93c47d', color: '#0c343d', textAlign: 'right', fontWeight: 900 };
};

const getTotalTemperatureStyle = (pts, hasScore) => {
  if (!hasScore || pts === null || pts === undefined) {
    return { textAlign: 'right', fontWeight: 700, color: 'var(--primary)' };
  }
  if (pts <= 0) {
    return { backgroundColor: '#ea9999', color: '#5c0000', textAlign: 'right', fontWeight: 700 };
  }
  if (pts <= 30) {
    return { backgroundColor: '#fce5cd', color: '#783f04', textAlign: 'right', fontWeight: 700 };
  }
  if (pts <= 70) {
    return { backgroundColor: '#fff2cc', color: '#7f6000', textAlign: 'right', fontWeight: 700 };
  }
  if (pts <= 120) {
    return { backgroundColor: '#d9ead3', color: '#274e13', textAlign: 'right', fontWeight: 800 };
  }
  if (pts <= 200) {
    return { backgroundColor: '#b6d7a8', color: '#134f30', textAlign: 'right', fontWeight: 800 };
  }
  return { backgroundColor: '#6aa84f', color: '#ffffff', textAlign: 'right', fontWeight: 900 };
};

// Assign unique background colors to the Name/Participant cells based on active items
const getNameCellStyle = (isCaptain, powerUp, isGamble, hasShield) => {
  if (powerUp?.type === 'Triple') {
    return { backgroundColor: '#8e7cc3', color: '#000000', fontWeight: 700 };
  }
  if (powerUp?.type === 'Double') {
    return { backgroundColor: '#b4a7d6', color: '#000000', fontWeight: 700 };
  }
  if (isCaptain) {
    return { backgroundColor: '#d9d2e9', color: '#000000', fontWeight: 700 };
  }
  if (isGamble) {
    return { backgroundColor: '#cfe2f3', color: '#000000', fontWeight: 700 };
  }
  if (hasShield) {
    return { backgroundColor: '#d0e0e3', color: '#000000', fontWeight: 700 };
  }
  return {};
};

// Core scoring engine replicated on client to compute category-wise points dynamically
function getGeneralCategoryPoints(userChoice, correctChoice, categoryDistribution = {}, totalPlayers = 1) {
  if (!correctChoice || userChoice !== correctChoice) {
    return 0;
  }

  // Count of people who predicted the correct outcome
  const nCorrect = categoryDistribution[correctChoice] || 0;
  
  // Maximum count among all options in this category
  const counts = Object.values(categoryDistribution);
  const nMax = Math.max(...counts, 1);

  if (nCorrect === 1) {
    return 100; // Unique
  }
  if (nCorrect === totalPlayers) {
    return 10; // Same
  }
  if (nCorrect === nMax) {
    return 20; // Majority
  }
  if (nCorrect < nMax && nCorrect > 1) {
    return 50; // Minority
  }

  return 0;
}

function getScorelinePoints(predHome, predAway, predSafeBet, actHome, actAway) {
  if (actHome === null || actAway === null || actHome === undefined || actAway === undefined) {
    return 0;
  }

  // Exactly Correct
  if (predHome === actHome && predAway === actAway) {
    return 100;
  }

  // Safe Bet Correct: Only the team designated as Safe Bet should score the exact number of goals predicted
  if (predSafeBet === 'Home' && predHome === actHome) return 50;
  if (predSafeBet === 'Away' && predAway === actAway) return 50;

  // Away Goal Correct
  if (predAway === actAway) {
    return 20;
  }

  // Home Goal Correct
  if (predHome === actHome) {
    return 10;
  }

  return 0;
}

function Results({ groupId, user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Current season selection states
  const [selectedMwId, setSelectedMwId] = useState('');
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [progressionMetric, setProgressionMetric] = useState('weekly'); // 'weekly', 'cumulative', 'ranks', 'winners'
  const [selectedPlayerForChart, setSelectedPlayerForChart] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, [groupId]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.getGroupResultsDashboard(groupId);
      setData(res);
      
      if (res?.matchweeks && res.matchweeks.length > 0) {
        // Default to the latest completed matchweek
        const latest = res.matchweeks[res.matchweeks.length - 1];
        setSelectedMwId(latest._id);
        if (latest.matches && latest.matches.length > 0) {
          setSelectedMatchId(latest.matches[0]._id);
        }
      }
      if (res?.standings && res.standings.length > 0) {
        const firstPlayer = res.standings.find(s => s.userId && s.userId.role === 'player') || res.standings[0];
        setSelectedPlayerForChart(firstPlayer?.userId?.username || '');
      }
    } catch (err) {
      setError(err.message || 'Failed to retrieve weekly results dashboard.');
    } finally {
      setLoading(false);
    }
  };

  // Update selected match when matchweek changes
  const handleMatchweekChange = (mwId) => {
    setSelectedMwId(mwId);
    const mw = data?.matchweeks?.find(m => m._id.toString() === mwId.toString());
    if (mw?.matches && mw.matches.length > 0) {
      setSelectedMatchId(mw.matches[0]._id);
    } else {
      setSelectedMatchId('');
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Loading results dashboard...</div>;
  }

  if (error) {
    return <div className="card" style={{ color: 'var(--danger)', textAlign: 'center' }}>{error}</div>;
  }

  const { matchweeks = [], predictions = [], standings = [], battles = [] } = data || {};

  if (matchweeks.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        <BarChart3 size={48} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.5 }} />
        <h3>No Results Available</h3>
        <p>No matchweeks have been completed yet in this league. Once the admin enters results and finalizes calculations, detailed trends and graphics will appear here.</p>
      </div>
    );
  }

  const selectedMw = matchweeks.find(m => m._id.toString() === selectedMwId.toString()) || matchweeks[matchweeks.length - 1];
  const selectedMwPredictions = predictions.filter(p => p.matchweekId && p.matchweekId.toString() === selectedMwId.toString());
  const selectedMwBattles = battles.filter(b => b.matchweekId && b.matchweekId.toString() === selectedMwId.toString());

  // 1. Calculate prediction choice distribution for the active matchweek to evaluate Unique/Minority/Majority/Same
  const computeMwDistribution = (mwPreds) => {
    const dist = {};
    mwPreds.forEach((predDoc) => {
      predDoc.predictions.forEach((p) => {
        const mId = p.matchId.toString();
        if (!dist[mId]) {
          dist[mId] = {
            result: { Home: 0, Away: 0, Draw: 0 },
            firstGoal: { Home: 0, Away: 0, 'No goal': 0 },
            possession: { Home: 0, Away: 0, Equal: 0 }
          };
        }
        if (p.result in dist[mId].result) dist[mId].result[p.result]++;
        if (p.firstGoal in dist[mId].firstGoal) dist[mId].firstGoal[p.firstGoal]++;
        if (p.possession in dist[mId].possession) dist[mId].possession[p.possession]++;
      });
    });
    return dist;
  };

  const currentMwDistribution = computeMwDistribution(selectedMwPredictions);
  const totalPlayersSub = selectedMwPredictions.length || 1;

  // Render match-by-match predictions table in CSV tabular format
  const renderMatchPredictionsTable = () => {
    if (!selectedMatchId) return <p style={{ color: 'var(--text-muted)' }}>No matches in this week.</p>;

    const currentMatch = selectedMw.matches.find(m => m._id.toString() === selectedMatchId.toString());
    if (!currentMatch) return null;

    // Filter prediction rows for this match
    const rows = selectedMwPredictions.map(predDoc => {
      const matchPred = predDoc.predictions.find(p => p.matchId.toString() === selectedMatchId.toString());
      if (!matchPred) return null;

      // Extract actual outcomes
      const actRes = currentMatch.actualHomeScore !== null ? (currentMatch.actualHomeScore > currentMatch.actualAwayScore ? 'Home' : currentMatch.actualAwayScore > currentMatch.actualHomeScore ? 'Away' : 'Draw') : null;
      const actFirst = currentMatch.actualFirstGoal || null;
      const actPoss = currentMatch.actualPossession || null;

      const dist = currentMwDistribution[selectedMatchId.toString()] || {
        result: { Home: 0, Away: 0, Draw: 0 },
        firstGoal: { Home: 0, Away: 0, 'No goal': 0 },
        possession: { Home: 0, Away: 0, Equal: 0 }
      };

      // Calculate Category Points
      const ptsResult = getGeneralCategoryPoints(matchPred.result, actRes, dist.result, totalPlayersSub);
      const ptsFirstGoal = getGeneralCategoryPoints(matchPred.firstGoal, actFirst, dist.firstGoal, totalPlayersSub);
      const ptsPossession = getGeneralCategoryPoints(matchPred.possession, actPoss, dist.possession, totalPlayersSub);
      
      const ptsScoreline = getScorelinePoints(
        matchPred.homeScore, 
        matchPred.awayScore, 
        matchPred.safeBet, 
        currentMatch.actualHomeScore, 
        currentMatch.actualAwayScore
      );

      // Check if wild correct
      let ptsWild = 0;
      const isWild = predDoc.predictions.find(p => p.matchId.toString() === selectedMatchId.toString());
      const isWildCorrect = currentMatch.actualResults?.wildPredictionCorrectUsers?.some(
        id => id.toString() === predDoc.userId?._id?.toString()
      );
      if (isWildCorrect) {
        ptsWild = 100;
      }

      // Check Multipliers (Captain/Double/Triple)
      const isCaptain = predDoc.captainMatchId && predDoc.captainMatchId.toString() === selectedMatchId.toString();
      const powerUp = predDoc.marketPowerUps?.find(pu => pu.matchId.toString() === selectedMatchId.toString());
      const hasShield = predDoc.marketPowerUps?.some(pu => pu.matchId.toString() === selectedMatchId.toString() && pu.type === 'Shield');

      let correctCats = 0;
      if (ptsResult > 0) correctCats++;
      if (ptsScoreline > 0) correctCats++;
      if (ptsFirstGoal > 0) correctCats++;
      if (ptsPossession > 0) correctCats++;
      if (ptsWild > 0) correctCats++;

      const gotBonus = correctCats >= 4;
      const bonusPoints = gotBonus ? 50 : 0;

      let matchGamblePoints = 0;
      const isGamble = predDoc.gamble?.active && predDoc.gamble.matchId?.toString() === selectedMatchId.toString();
      if (isGamble) {
        const gamblePtsVal = predDoc.gamble.points || 0;
        if (correctCats >= 4) {
          matchGamblePoints = gamblePtsVal;
        } else if (correctCats === 3) {
          matchGamblePoints = 0;
        } else {
          matchGamblePoints = hasShield ? 0 : -gamblePtsVal;
        }
      }

      const captainMult = isCaptain ? 2 : 1;
      let doubleMult = 1;
      let tripleMult = 1;
      if (powerUp) {
        if (powerUp.type === 'Double') doubleMult = 2;
        if (powerUp.type === 'Triple') tripleMult = 3;
      }
      const totalMultiplier = captainMult * doubleMult * tripleMult;

      const gotSuperBonus = correctCats === 5;
      const superBonusMult = gotSuperBonus ? 1.5 : 1;

      const categoriesSum = ptsResult + ptsScoreline + ptsFirstGoal + ptsPossession + ptsWild;
      const pointsBeforeSuper = (categoriesSum + bonusPoints + matchGamblePoints) * totalMultiplier;
      const totalMatchPoints = Math.round(pointsBeforeSuper * superBonusMult);

      const tags = [];
      if (isCaptain) tags.push(<span key="cap" className="badge badge-info" style={{ fontSize: '0.55rem', padding: '0.05rem 0.25rem', color: '#000000', backgroundColor: 'rgba(0,0,0,0.08)', borderColor: 'rgba(0,0,0,0.25)', fontWeight: 800 }}>C</span>);
      if (powerUp) tags.push(<span key="pu" className="badge badge-success" style={{ fontSize: '0.55rem', padding: '0.05rem 0.25rem', color: '#000000', backgroundColor: 'rgba(0,0,0,0.08)', borderColor: 'rgba(0,0,0,0.25)', fontWeight: 800 }}>{powerUp.type}</span>);
      if (gotSuperBonus) tags.push(<span key="sb" className="badge badge-accent" style={{ fontSize: '0.55rem', padding: '0.05rem 0.25rem', color: '#000000', backgroundColor: '#f59e0b', borderColor: 'rgba(0,0,0,0.25)', fontWeight: 800 }}>⚡ 1.5x Super Bonus</span>);
      
      if (isGamble) {
        tags.push(<span key="gam" className="badge badge-warning" style={{ fontSize: '0.55rem', padding: '0.05rem 0.25rem', color: '#000000', backgroundColor: 'rgba(0,0,0,0.08)', borderColor: 'rgba(0,0,0,0.25)', fontWeight: 800 }}>Gamble {predDoc.gamble.points}</span>);
        if (hasShield && correctCats < 3) {
          tags.push(<span key="shi" className="badge badge-info" style={{ fontSize: '0.55rem', padding: '0.05rem 0.25rem', color: '#000000', backgroundColor: 'rgba(0,0,0,0.08)', borderColor: 'rgba(0,0,0,0.25)', fontWeight: 800 }}>🛡️ Shielded</span>);
        }
      }

      return {
        username: predDoc.userId?.username || 'Unknown',
        rawUsername: predDoc.userId?.username,
        result: matchPred.result,
        resultPts: ptsResult,
        scoreline: `${matchPred.homeScore}-${matchPred.awayScore}`,
        safeBet: matchPred.safeBet,
        safeBetPts: ptsScoreline,
        firstGoal: matchPred.firstGoal,
        firstGoalPts: ptsFirstGoal,
        possession: matchPred.possession,
        possessionPts: ptsPossession,
        wildText: isWild && isWild.wildPredictionCategory !== 'None' ? `${isWild.wildPredictionCategory}: ${isWild.wildPredictionValue}` : '-',
        wildPts: ptsWild,
        total: totalMatchPoints,
        isCaptain,
        powerUp,
        isGamble,
        hasShield,
        tags
      };
    }).filter(r => r !== null).sort((a, b) => (a.username || '').localeCompare(b.username || ''));

    return (
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Match Result</th>
              <th style={{ textAlign: 'right' }}>Points</th>
              <th style={{ textAlign: 'center' }}>Scoreline</th>
              <th>Safe Bet</th>
              <th style={{ textAlign: 'right' }}>Points</th>
              <th>1st Goal</th>
              <th style={{ textAlign: 'right' }}>Points</th>
              <th>Possession</th>
              <th style={{ textAlign: 'right' }}>Points</th>
              <th>Wild Prediction</th>
              <th style={{ textAlign: 'right' }}>Points</th>
              <th style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 700 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} style={{
                background: row.rawUsername === user.username ? 'rgba(56, 189, 248, 0.03)' : 'transparent'
              }}>
                <td style={{ 
                  fontWeight: 700,
                  ...getNameCellStyle(row.isCaptain, row.powerUp, row.isGamble, row.hasShield)
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span>{row.username}</span>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {row.tags}
                    </div>
                  </div>
                </td>
                <td>{row.result}</td>
                <td style={getTemperatureStyle(row.resultPts, true)}>{row.resultPts}</td>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.scoreline}</td>
                <td>{row.safeBet}</td>
                <td style={getTemperatureStyle(row.safeBetPts, true)}>{row.safeBetPts}</td>
                <td>{row.firstGoal}</td>
                <td style={getTemperatureStyle(row.firstGoalPts, true)}>{row.firstGoalPts}</td>
                <td>{row.possession}</td>
                <td style={getTemperatureStyle(row.possessionPts, true)}>{row.possessionPts}</td>
                <td style={{ fontSize: '0.85rem' }}>{row.wildText}</td>
                <td style={getTemperatureStyle(row.wildPts, true)}>{row.wildText !== '-' ? row.wildPts : '-'}</td>
                <td style={getTotalTemperatureStyle(row.total, true)}>{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render Week Rank vs Season Overall Rank Comparison Table
  const renderRankComparisonTable = () => {
    if (selectedMwPredictions.length === 0) {
      return <p style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>No predictions recorded for this matchweek.</p>;
    }

    // Sort players by total score in this matchweek
    const sortedMwPredictions = [...selectedMwPredictions]
      .sort((a, b) => (b.totalPointsScored || 0) - (a.totalPointsScored || 0));

    return (
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '80px', textAlign: 'center' }}>Week Rank</th>
              <th>Player</th>
              <th style={{ textAlign: 'right' }}>Week Points</th>
              <th style={{ textAlign: 'center' }}>Overall Standing Rank</th>
            </tr>
          </thead>
          <tbody>
            {sortedMwPredictions.map((pred, index) => {
              const mwRank = index + 1;
              const overallStanding = standings.find(s => s.userId && s.userId._id.toString() === pred.userId?._id?.toString());
              const overallRank = overallStanding ? overallStanding.rank : '-';

              return (
                <tr key={pred._id} style={{
                  background: pred.userId && pred.userId._id.toString() === user.id ? 'rgba(56, 189, 248, 0.03)' : 'transparent'
                }}>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>
                    #{mwRank}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{pred.userId?.username || 'Unknown'}</span>
                    {pred.isAutofilled && <span className="badge badge-warning" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', marginLeft: '0.5rem' }}>Autofill</span>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.05rem' }}>
                    {pred.totalPointsScored || 0}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--warning)' }}>
                    {overallRank !== '-' ? `#${overallRank}` : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Generate lists of active users for progression matrix headers (alphabetically sorted)
  const activePlayers = standings
    .filter(s => s.userId && s.userId.username !== 'Average Player')
    .map(s => s.userId.username)
    .sort((a, b) => a.localeCompare(b));

  // Compute weekly progressions matrix table dynamically
  const getProgressionMatrixData = () => {
    const rows = [];
    
    matchweeks.forEach((mw) => {
      const mwNum = mw.matchweekNumber;
      const mwPreds = predictions.filter(p => p.matchweekId.toString() === mw._id.toString());
      
      const row = { mw: mwNum };
      let sum = 0;
      let count = 0;

      activePlayers.forEach((player) => {
        const pred = mwPreds.find(p => p.userId?.username === player);
        if (progressionMetric === 'ranks') {
          // Rank of this player in this week
          const sortedPreds = [...mwPreds].sort((a, b) => b.totalPointsScored - a.totalPointsScored);
          const pIndex = sortedPreds.findIndex(p => p.userId?.username === player);
          row[player] = pIndex !== -1 ? pIndex + 1 : '-';
        } else if (progressionMetric === 'cumulative') {
          // Sum up to this week
          const prevWeeksPreds = predictions.filter(p => {
            const mDoc = matchweeks.find(m => m._id.toString() === p.matchweekId.toString());
            return p.userId?.username === player && mDoc && mDoc.matchweekNumber <= mwNum;
          });
          const total = prevWeeksPreds.reduce((acc, p) => acc + (p.totalPointsScored || 0), 0);
          row[player] = total;
        } else {
          // Default: Weekly points
          const points = pred ? pred.totalPointsScored : 0;
          row[player] = points;
          sum += points;
          count++;
        }
      });

      if (progressionMetric === 'weekly') {
        row.avg = count > 0 ? Math.round(sum / count) : 0;
      }

      rows.push(row);
    });

    return rows;
  };

  const progressionRows = getProgressionMatrixData();

  // Helper to draw the Progression SVG chart for current season (all weeks)
  const renderProgressionChart = () => {
    if (!selectedPlayerForChart || progressionRows.length === 0) return null;

    const trendData = progressionRows.map(row => ({
      mw: row.mw,
      value: row[selectedPlayerForChart] || 0
    }));

    const width = 650;
    const height = 220;
    const padding = 35;

    const values = trendData.filter(d => typeof d.value === 'number').map(d => d.value);
    let maxVal = Math.max(...values, 100);
    let minVal = Math.min(...values, 0);

    const isRank = progressionMetric === 'ranks';
    if (isRank) {
      maxVal = activePlayers.length || 8;
      minVal = 1;
    }

    const n = trendData.length;

    const points = trendData.map((d, i) => {
      const x = padding + (i * (width - 2 * padding)) / Math.max(1, n - 1);
      let y;
      if (isRank) {
        // High rank = top of chart
        y = padding + ((d.value - 1) * (height - 2 * padding)) / Math.max(1, maxVal - 1);
      } else {
        y = height - padding - ((d.value - minVal) * (height - 2 * padding)) / Math.max(1, maxVal - minVal);
      }
      return { x, y, val: d.value };
    });

    let pathD = '';
    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    }

    let fillD = '';
    if (points.length > 0 && !isRank) {
      fillD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
    }

    return (
      <div style={{ width: '100%', overflowX: 'auto', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="220" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
            const y = padding + ratio * (height - 2 * padding);
            let valLabel = isRank ? Math.round(1 + ratio * (maxVal - 1)) : Math.round(maxVal - ratio * (maxVal - minVal));
            return (
              <g key={index}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                <text x={padding - 8} y={y + 4} fill="var(--text-muted)" fontSize="9" textAnchor="end">{isRank ? `#${valLabel}` : valLabel}</text>
              </g>
            );
          })}

          {fillD && <path d={fillD} fill="url(#chartGlow)" />}
          {pathD && <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

          {points.map((p, index) => {
            const showLabel = n < 10 || index % 2 === 0 || index === n - 1;
            return (
              <g key={index}>
                <circle cx={p.x} cy={p.y} r="4" fill="var(--bg-dark)" stroke="var(--primary)" strokeWidth="2" />
                {showLabel && (
                  <text x={p.x} y={p.y - 8} fill="var(--primary)" fontSize="9" fontWeight="700" textAnchor="middle">{p.val}</text>
                )}
                <text x={p.x} y={height - 18} fill="var(--text-muted)" fontSize="8" textAnchor="middle">{trendData[index].mw}</text>
              </g>
            );
          })}
          
          <text x={width / 2} y={height - 4} fill="var(--text-muted)" fontSize="9" fontWeight="700" textAnchor="middle">Matchweek</text>
        </svg>
      </div>
    );
  };

  // Get active matchweek winners for current season
  const getMwWinners = () => {
    return matchweeks.map(mw => {
      const mwPreds = predictions.filter(p => p.matchweekId.toString() === mw._id.toString());
      if (mwPreds.length === 0) return null;
      const sorted = [...mwPreds].sort((a, b) => b.totalPointsScored - a.totalPointsScored);
      return {
        mw: mw.matchweekNumber,
        winner: sorted[0]?.userId?.username || 'Unknown',
        points: sorted[0]?.totalPointsScored || 0
      };
    }).filter(w => w !== null);
  };

  const mwWinners = getMwWinners();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      
      {/* HEADER CARD */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ borderBottom: 'none', marginBottom: '0.25rem', paddingBottom: 0 }}>
            Results & <span className="text-gradient">Analytics</span>
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>Detailed tabular breakdown and graphic trends of the current season.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label className="form-label" style={{ marginBottom: 0 }}>Select Matchweek:</label>
          <select
            className="form-input"
            style={{ width: '180px' }}
            value={selectedMwId}
            onChange={(e) => handleMatchweekChange(e.target.value)}
          >
            {matchweeks.map((mw) => (
              <option key={mw._id} value={mw._id}>Matchweek #{mw.matchweekNumber}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 1. MATCH-BY-MATCH PREDICTIONS (CSV Predictions.csv Format) */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={18} style={{ color: 'var(--primary)' }} /> Predictions Details (Match-by-Match)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.15rem' }}>Choose a specific match fixture to inspect the detailed predictions table.</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Select Match:</label>
            <select
              className="form-input"
              style={{ width: '260px' }}
              value={selectedMatchId}
              onChange={(e) => setSelectedMatchId(e.target.value)}
            >
              {selectedMw?.matches?.map((m) => (
                <option key={m._id} value={m._id}>{m.homeTeam} vs {m.awayTeam}</option>
              ))}
            </select>
          </div>
        </div>

        {renderMatchPredictionsTable()}
      </div>

      {/* 2. MATCHWEEK RANK VS OVERALL RANK */}
      <div className="card">
        <div>
          <h3 style={{ margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={18} style={{ color: 'var(--warning)' }} /> Matchweek Rank vs. Season Overall Rank
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Comparison of player rankings for Matchweek #{selectedMw?.matchweekNumber} side-by-side with overall Leaderboard standings.
          </p>
        </div>

        {renderRankComparisonTable()}
      </div>

      {/* 3. PROGRESSION MATRIX & CHART (CSV Rankings.csv Format) */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <LineChart size={18} style={{ color: 'var(--warning)' }} /> Season Progression Matrix
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.15rem' }}>Weekly matrices and progression graphs of all players.</p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Matrix Metric:</label>
              <select
                className="form-input"
                style={{ width: '180px' }}
                value={progressionMetric}
                onChange={(e) => setProgressionMetric(e.target.value)}
              >
                <option value="weekly">Weekly Points</option>
                <option value="cumulative">Cumulative Points</option>
                <option value="ranks">Weekly Ranks</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Chart Player:</label>
              <select
                className="form-input"
                style={{ width: '150px' }}
                value={selectedPlayerForChart}
                onChange={(e) => setSelectedPlayerForChart(e.target.value)}
              >
                {activePlayers.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Dynamic progression line chart */}
        {renderProgressionChart()}

        {/* Matrix Data Table */}
        <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0f172a', textAlign: 'left' }}>Match Week</th>
                {activePlayers.map(player => (
                  <th key={player} style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0f172a', textAlign: 'right' }}>{player}</th>
                ))}
                {progressionMetric === 'weekly' && (
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0f172a', textAlign: 'right', color: 'var(--accent)', fontWeight: 700 }}>Avg Points</th>
                )}
              </tr>
            </thead>
            <tbody>
              {progressionRows.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 700 }}>Week #{row.mw}</td>
                  {activePlayers.map(player => {
                    const isWinner = progressionMetric === 'weekly' && mwWinners.find(w => w.mw === row.mw)?.winner === player;
                    return (
                      <td key={player} style={{ 
                        textAlign: 'right', 
                        fontWeight: isWinner ? 700 : 500, 
                        color: isWinner ? 'var(--success)' : 'inherit'
                      }}>
                        {progressionMetric === 'ranks' && row[player] !== '-' ? `#${row[player]}` : row[player]}
                      </td>
                    );
                  })}
                  {progressionMetric === 'weekly' && (
                    <td style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 700 }}>
                      {row.avg}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. WEEKLY WINNERS LIST */}
      <div className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.2rem' }}>
          <TrendingUp size={18} style={{ color: 'var(--success)' }} /> Current Season Matchweek Winners
        </h3>
        {mwWinners.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {mwWinners.map((w, idx) => (
              <div key={idx} className="card" style={{ background: 'rgba(0,0,0,0.15)', borderLeft: '3px solid var(--success)', padding: '0.75rem 1rem' }}>
                <small style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Week #{w.mw}</small>
                <h4 style={{ margin: '0.2rem 0', fontWeight: 700 }}>{w.winner}</h4>
                <div style={{ fontSize: '0.9rem', color: 'var(--success)', fontWeight: 600 }}>{w.points} points</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>No completed matchweeks yet.</p>
        )}
      </div>

    </div>
  );
}

export default Results;
