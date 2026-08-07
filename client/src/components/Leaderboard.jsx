import React, { useEffect, useState } from 'react';
import api from '../api';
import { Trophy, Award, HelpCircle, TrendingUp } from 'lucide-react';

function Leaderboard({ groupId }) {
  const [standings, setStandings] = useState([]);
  const [matchweeks, setMatchweeks] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [chartMetric, setChartMetric] = useState('cumulative');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStandings();
  }, [groupId]);

  const fetchStandings = async () => {
    try {
      setLoading(true);
      setError('');
      // Fetch the group results dashboard to populate standings and historical predictions
      const dash = await api.getGroupResultsDashboard(groupId);
      
      const activeStandings = dash.standings.filter(
        (s) => s.userId && s.userId._id !== '600000000000000000000000'
      );
      setStandings(activeStandings);
      setMatchweeks(dash.matchweeks || []);
      setPredictions(dash.predictions || []);
    } catch (err) {
      setError('Failed to load standings for this group.');
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return <Trophy size={18} style={{ color: '#ffd700' }} />;
    if (rank === 2) return <Award size={18} style={{ color: '#c0c0c0' }} />;
    if (rank === 3) return <Award size={18} style={{ color: '#cd7f32' }} />;
    return <span style={{ color: 'var(--text-muted)' }}>#{rank}</span>;
  };

  const activePlayers = standings.filter(s => s.userId).map(s => s.userId.username).sort((a, b) => a.localeCompare(b));

  const getProgressionData = () => {
    const rows = [];
    matchweeks.forEach((mw) => {
      const mwNum = mw.matchweekNumber;
      const mwPreds = predictions.filter(p => p.matchweekId.toString() === mw._id.toString());
      
      const row = { mw: mwNum };
      activePlayers.forEach((player) => {
        if (chartMetric === 'cumulative') {
          const prevWeeksPreds = predictions.filter(p => {
            const mDoc = matchweeks.find(m => m._id.toString() === p.matchweekId.toString());
            return p.userId?.username === player && mDoc && mDoc.matchweekNumber <= mwNum;
          });
          row[player] = prevWeeksPreds.reduce((acc, p) => acc + (p.totalPointsScored || 0), 0);
        } else {
          const pred = mwPreds.find(p => p.userId?.username === player);
          row[player] = pred ? pred.totalPointsScored : 0;
        }
      });
      rows.push(row);
    });
    return rows;
  };

  const progressionRows = getProgressionData();

  const renderProgressionChart = () => {
    if (progressionRows.length === 0) return null;

    const width = 800;
    const height = 300;
    const paddingX = 50;
    const paddingY = 40;

    // Collect all points values to determine scale
    const allVals = [];
    progressionRows.forEach(row => {
      activePlayers.forEach(player => {
        allVals.push(row[player] || 0);
      });
    });

    const maxVal = Math.max(...allVals, 100);
    const minVal = Math.min(...allVals, 0);

    const PLAYER_COLORS = [
      '#38bdf8', // sky blue
      '#f59e0b', // amber
      '#10b981', // emerald
      '#ec4899', // pink
      '#8b5cf6', // purple
      '#14b8a6', // teal
      '#f43f5e', // rose
      '#a855f7', // violet
    ];

    const weeksCount = progressionRows.length;

    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={18} style={{ color: 'var(--primary)' }} /> Visual Season Journey
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.15rem' }}>Points progression of all players week-by-week.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className={`btn ${chartMetric === 'cumulative' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
              onClick={() => setChartMetric('cumulative')}
            >
              Cumulative Points
            </button>
            <button 
              className={`btn ${chartMetric === 'weekly' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
              onClick={() => setChartMetric('weekly')}
            >
              Weekly Points
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          {activePlayers.map((player, index) => {
            const color = PLAYER_COLORS[index % PLAYER_COLORS.length];
            return (
              <div key={player} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color }}></span>
                <span style={{ fontWeight: 600 }}>{player}</span>
              </div>
            );
          })}
        </div>

        {/* SVG Chart */}
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="300" style={{ overflow: 'visible' }}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
              const y = paddingY + ratio * (height - 2 * paddingY);
              const valLabel = Math.round(maxVal - ratio * (maxVal - minVal));
              return (
                <g key={index}>
                  <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                  <text x={paddingX - 8} y={y + 4} fill="var(--text-muted)" fontSize="9" textAnchor="end">{valLabel}</text>
                </g>
              );
            })}

            {/* X Axis Weeks Labels */}
            {progressionRows.map((row, i) => {
              const x = paddingX + (i * (width - 2 * paddingX)) / Math.max(1, weeksCount - 1);
              const showLabel = weeksCount < 12 || i % 2 === 0 || i === weeksCount - 1;
              return (
                <g key={i}>
                  <line x1={x} y1={paddingY} x2={x} y2={height - paddingY} stroke="rgba(255,255,255,0.03)" />
                  {showLabel && (
                    <text x={x} y={height - 8} fill="var(--text-muted)" fontSize="8" textAnchor="middle">W{row.mw}</text>
                  )}
                </g>
              );
            })}

            {/* Lines for each player */}
            {activePlayers.map((player, pIdx) => {
              const color = PLAYER_COLORS[pIdx % PLAYER_COLORS.length];
              const points = progressionRows.map((row, i) => {
                const x = paddingX + (i * (width - 2 * paddingX)) / Math.max(1, weeksCount - 1);
                const val = row[player] || 0;
                const y = height - paddingY - ((val - minVal) * (height - 2 * paddingY)) / Math.max(1, maxVal - minVal);
                return { x, y };
              });

              let pathD = '';
              if (points.length > 0) {
                pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
              }

              return (
                <g key={player}>
                  {pathD && <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                  {points.map((p, index) => {
                    const isLast = index === points.length - 1;
                    return (
                      <circle 
                        key={index}
                        cx={p.x} 
                        cy={p.y} 
                        r={isLast ? "4" : "2"} 
                        fill={isLast ? color : "var(--bg-dark)"} 
                        stroke={color} 
                        strokeWidth={isLast ? "2" : "1"} 
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Loading standings...</div>;
  }

  if (error) {
    return <div className="card" style={{ color: 'var(--danger)', textAlign: 'center' }}>{error}</div>;
  }

  const totalPlayers = standings.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ borderBottom: 'none', marginBottom: '0.25rem', paddingBottom: 0 }}>
            League <span className="text-gradient">Standings</span>
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>Accumulated scores and rankings over the matches.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchStandings} style={{ fontSize: '0.85rem' }}>
          Refresh
        </button>
      </div>

      {/* Rules Context Banner */}
      <div className="card" style={{ background: 'rgba(56, 189, 248, 0.05)', borderColor: 'rgba(56, 189, 248, 0.2)', padding: '1rem 1.5rem' }}>
        <h4 style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <HelpCircle size={16} /> Gamble Limits & Caps Info
        </h4>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Your rank determines your maximum gamble limit for the matchweek. 
          <span style={{ color: 'var(--success)', fontWeight: 600 }}> Top 50%</span> can gamble a max of <strong>500 pts</strong>. 
          <span style={{ color: 'var(--danger)', fontWeight: 600 }}> Bottom 50%</span> can gamble a max of <strong>1000 pts</strong>. 
          All players can gamble a maximum of 10% of their total available points in this group.
        </p>
      </div>

      {/* Standings Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
                <th>Name</th>
                <th>Username</th>
                <th style={{ textAlign: 'right' }}>Total Points</th>
                <th style={{ textAlign: 'right' }}>Battle Points (BP)</th>
                <th style={{ width: '180px', textAlign: 'center' }}>Gamble Bracket</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((standing, index) => {
                const rank = index + 1;
                const half = Math.ceil(totalPlayers / 2);
                let bracketClass = '';
                let bracketText = '';
                
                if (rank <= half) {
                  bracketClass = 'badge-success';
                  bracketText = 'Max 500 pts';
                } else {
                  bracketClass = 'badge-danger';
                  bracketText = 'Max 1000 pts';
                }

                const userObj = standing.userId || { username: 'Unknown User', role: 'player' };

                return (
                  <tr key={standing._id} style={{
                    background: rank <= half ? 'rgba(16, 185, 129, 0.02)' : 'rgba(239, 68, 68, 0.02)'
                  }}>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                        {getRankBadge(rank)}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {userObj.name || '-'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{userObj.username}</span>
                        {userObj.role === 'admin' && <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>Admin</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.05rem', color: 'var(--primary)' }}>
                      {standing.totalPoints}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>
                      {standing.battlePoints} BP
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${bracketClass || 'badge-info'}`} style={{ fontSize: '0.75rem' }}>
                        {bracketText}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Points Progression Histogram/Chart */}
      {renderProgressionChart()}

    </div>
  );
}

export default Leaderboard;
