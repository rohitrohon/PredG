import React, { useEffect, useState } from 'react';
import api from '../api';
import { Sword, History, Trophy, LayoutGrid, Check } from 'lucide-react';

function Battles({ user, groupId }) {
  const [matchweeks, setMatchweeks] = useState([]);
  const [selectedMatchweekId, setSelectedMatchweekId] = useState('');
  const [battles, setBattles] = useState([]);
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, [groupId]);

  useEffect(() => {
    if (selectedMatchweekId) {
      fetchBattles(selectedMatchweekId);
    }
  }, [selectedMatchweekId]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch matchweeks
      const mws = await api.getMatchweeks(groupId);
      const visibleMws = mws.filter(mw => mw.status !== 'draft');
      setMatchweeks(visibleMws);

      const active = visibleMws.find(mw => mw.status === 'active') || visibleMws[visibleMws.length - 1];
      if (active) {
        setSelectedMatchweekId(active._id);
      } else {
        setBattles([]);
      }

      // Fetch standings for total Battle Points
      const standingsData = await api.getGroupStandings(groupId);
      const activeStandings = standingsData.filter(
        (s) => s.userId && s.userId._id !== '600000000000000000000000'
      );
      setStandings(activeStandings);
    } catch (err) {
      setError('Failed to load battle data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBattles = async (mwId) => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getBattles(mwId, groupId);
      setBattles(data);
    } catch (err) {
      setError('Failed to load battles for the selected matchweek.');
    } finally {
      setLoading(false);
    }
  };

  const currentMw = matchweeks.find(mw => mw._id === selectedMatchweekId);
  const isCompleted = currentMw?.status === 'completed';

  // Get lists of unique usernames in the group standings
  const activePlayers = standings.map(s => s.userId?.username).filter(Boolean);

  // Render separate brackets showing battle pairings
  const renderBattleBrackets = () => {
    if (battles.length === 0) {
      return <p style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>No brackets scheduled for this matchweek.</p>;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {battles.map((battle, index) => {
          const p1 = battle.player1Id?.username || 'Player 1';
          const p2 = battle.player2Id?.username || 'Player 2';
          const p3 = battle.player3Id?.username || 'Player 3';
          const isTriad = battle.isTriad && battle.player3Id;

          const isUserP1 = battle.player1Id?._id?.toString() === user.id;
          const isUserP2 = battle.player2Id?._id?.toString() === user.id;
          const isUserP3 = battle.player3Id?._id?.toString() === user.id;
          const isUserInBattle = isUserP1 || isUserP2 || (isTriad && isUserP3);

          return (
            <div key={battle._id} className="card" style={{ 
              padding: '0.75rem 1rem', 
              background: 'rgba(0,0,0,0.15)',
              borderColor: isUserInBattle ? 'var(--primary)' : 'var(--border-color)',
              borderLeft: isUserInBattle ? '4px solid var(--primary)' : '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Bracket #{index + 1} {isTriad ? '(3-Way Triad Matchup)' : ''}
                </span>
                {isCompleted && (
                  <span className={`badge ${battle.outcome === 'Draw' || battle.outcome === 'Tie' ? 'badge-info' : 'badge-success'}`} style={{ fontSize: '0.65rem' }}>
                    {battle.outcome === 'Draw' || battle.outcome === 'Tie' ? 'Draw / Tie' : battle.outcome === 'Player1' ? `${p1} Win` : battle.outcome === 'Player2' ? `${p2} Win` : `${p3} Win`}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.2rem 0' }}>
                {!isTriad ? (
                  <>
                    <span style={{ fontWeight: isUserP1 ? 700 : 500, color: isUserP1 ? 'var(--primary)' : 'inherit', fontSize: '0.95rem' }}>{p1}</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, padding: '0 0.5rem' }}>
                      {isCompleted ? `${battle.player1Wins} - ${battle.player2Wins}` : 'vs'}
                    </span>
                    <span style={{ fontWeight: isUserP2 ? 700 : 500, color: isUserP2 ? 'var(--primary)' : 'inherit', fontSize: '0.95rem', textAlign: 'right' }}>{p2}</span>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: isUserP1 ? 700 : 500, color: isUserP1 ? 'var(--primary)' : 'inherit' }}>{p1} {isCompleted ? `(${battle.player1Wins}W)` : ''}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 700 }}>vs (Triad) vs</span>
                    <span style={{ fontWeight: isUserP2 ? 700 : 500, color: isUserP2 ? 'var(--primary)' : 'inherit' }}>{p2} {isCompleted ? `(${battle.player2Wins}W)` : ''}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 700 }}>vs</span>
                    <span style={{ fontWeight: isUserP3 ? 700 : 500, color: isUserP3 ? 'var(--primary)' : 'inherit' }}>{p3} {isCompleted ? `(${battle.player3Wins}W)` : ''}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render Category-wise Shootout Detailed matrix table partitioned by Bracket
  const renderShootoutTable = () => {
    if (!isCompleted) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          <Sword size={32} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
          <p>Shootout details will be revealed once the matchweek is completed and results are calculated.</p>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {battles.map((battle, bIdx) => {
          const p1 = battle.player1Id?.username || 'Player 1';
          const p2 = battle.player2Id?.username || 'Player 2';
          const p3 = battle.player3Id?.username || 'Player 3';
          const isTriad = battle.isTriad && battle.player3Id;

          // Category details mapping
          const p1Details = { name: p1, bp: battle.player1Points };
          const p2Details = { name: p2, bp: battle.player2Points };
          const p3Details = isTriad ? { name: p3, bp: battle.player3Points } : null;

          battle.details?.forEach(d => {
            const cat = d.category;
            p1Details[cat] = { val: d.player1Val, pts: d.player1Pts };
            p2Details[cat] = { val: d.player2Val, pts: d.player2Pts };
            if (isTriad && p3Details) {
              p3Details[cat] = { val: d.player3Val, pts: d.player3Pts };
            }
          });

          const bracketRows = [p1Details, p2Details];
          if (isTriad && p3Details) bracketRows.push(p3Details);

          const renderValueAndPts = (item) => {
            if (!item) {
              return (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>-</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>0 pts</span>
                </div>
              );
            }
            const displayVal = item.val !== null && item.val !== undefined && item.val !== '' ? item.val : '-';
            const displayPts = item.pts !== undefined && item.pts !== null ? item.pts : 0;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <span style={{ fontWeight: 600 }}>{displayVal}</span>
                <span style={{ 
                  fontSize: '0.75rem', 
                  color: displayPts > 0 ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: displayPts > 0 ? 600 : 400
                }}>
                  {displayPts} {displayPts === 1 ? 'pt' : 'pts'}
                </span>
              </div>
            );
          };

          return (
            <div key={battle._id} style={{ 
              padding: '1rem', 
              background: 'rgba(255, 255, 255, 0.02)', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, fontWeight: 700, color: 'var(--primary)' }}>
                  Bracket #{bIdx + 1}: {!isTriad ? `${p1} vs ${p2}` : `${p1} vs ${p2} vs ${p3} (3-Way Triad)`}
                </h4>
                <span className="badge badge-info" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  {!isTriad ? `Score: ${battle.player1Wins} - ${battle.player2Wins}` : `Wins: ${p1}(${battle.player1Wins}) ${p2}(${battle.player2Wins}) ${p3}(${battle.player3Wins})`}
                </span>
              </div>

              <div className="table-container" style={{ margin: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Result Choice (Pts)</th>
                      <th>Scoreline Choice (Pts)</th>
                      <th>1st Goal Choice (Pts)</th>
                      <th>Possession Choice (Pts)</th>
                      <th style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 700 }}>BP Gained</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bracketRows.map((row, idx) => (
                      <tr key={idx} style={{
                        background: row.name === user.username ? 'rgba(56, 189, 248, 0.03)' : 'transparent'
                      }}>
                        <td style={{ fontWeight: 700 }}>{row.name}</td>
                        <td>{renderValueAndPts(row.result)}</td>
                        <td>{renderValueAndPts(row.scoreline)}</td>
                        <td>{renderValueAndPts(row.firstGoal)}</td>
                        <td>{renderValueAndPts(row.possession)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)', fontSize: '1.05rem' }}>
                          +{row.bp} BP
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Standings list sorted by Battle Points
  const bpStandings = [...standings].sort((a, b) => b.battlePoints - a.battlePoints);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ borderBottom: 'none', marginBottom: '0.25rem', paddingBottom: 0 }}>
            H2H <span className="text-gradient">Battles</span>
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label className="form-label" style={{ marginBottom: 0 }}>Matchweek:</label>
          <select 
            className="form-input" 
            style={{ width: '180px' }}
            value={selectedMatchweekId}
            onChange={(e) => setSelectedMatchweekId(e.target.value)}
          >
            {matchweeks.map((mw) => (
              <option key={mw._id} value={mw._id}>Matchweek #{mw.matchweekNumber}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="card" style={{ color: 'var(--danger)', textAlign: 'center' }}>{error}</div>}
      {loading && <div style={{ textAlign: 'center', padding: '2rem' }}>Loading Battles...</div>}

      {!loading && currentMw && (
        <>
          {/* TOP SECTION: STANDINGS AND PAIRING GRID (Side by side) */}
          <div className="grid-2">
            
            {/* 1. BATTLE POINTS STANDINGS TABLE */}
            <div className="card">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: 'none', paddingBottom: 0 }}>
                <Trophy size={18} style={{ color: 'var(--accent)' }} /> Battle Points Rankings
              </h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '60px', textAlign: 'center' }}>Rank</th>
                      <th>Name</th>
                      <th>Username</th>
                      <th style={{ textAlign: 'right', color: 'var(--accent)' }}>Battle Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bpStandings.map((row, idx) => (
                      <tr key={row._id} style={{
                        background: row.userId?.username === user.username ? 'rgba(168, 85, 247, 0.03)' : 'transparent'
                      }}>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>#{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{row.userId?.name || '-'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{row.userId?.username}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)', fontSize: '1.05rem' }}>
                          {row.battlePoints} BP
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. BATTLE PAIRING BRACKETS */}
            <div className="card">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: 'none', paddingBottom: 0 }}>
                <Sword size={18} style={{ color: 'var(--primary)' }} /> Matchweek Pairing Brackets
              </h3>
              {renderBattleBrackets()}
            </div>

          </div>

          {/* BOTTOM SECTION: DETAILED SHOOTOUT MATRIX TABLE */}
          <div className="card">
            <div style={{ marginBottom: '1.2rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LayoutGrid size={18} style={{ color: 'var(--primary)' }} /> Battle Details
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.15rem' }}>
                Battle Match: <strong style={{ color: 'var(--primary)' }}>{currentMw.battleMatchId ? currentMw.matches.find(m => m._id.toString() === currentMw.battleMatchId.toString())?.homeTeam + ' vs ' + currentMw.matches.find(m => m._id.toString() === currentMw.battleMatchId.toString())?.awayTeam : 'Not Assigned'}</strong> (Matchweek {currentMw.matchweekNumber})
              </p>
            </div>
            
            {renderShootoutTable()}
          </div>
        </>
      )}

    </div>
  );
}

export default Battles;
