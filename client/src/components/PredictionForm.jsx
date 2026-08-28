import React, { useEffect, useState } from 'react';
import api from '../api';
import { Calendar, Lock, Unlock, AlertCircle, UserCheck } from 'lucide-react';

function PredictionForm({ user, groupId, standing, onPointsUpdate }) {
  const [matchweek, setMatchweek] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deadline1Passed, setDeadline1Passed] = useState(false);
  const [deadline2Passed, setDeadline2Passed] = useState(false);

  // Total players count in group to compute Top/Bottom 50%
  const [totalPlayers, setTotalPlayers] = useState(8);

  // Countdown timer string
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    fetchActiveData();
  }, [groupId]);

  useEffect(() => {
    if (!matchweek) return;
    
    const checkDeadlines = () => {
      const d1Time = matchweek.matches && matchweek.matches[0] && matchweek.matches[0].kickoffTime 
        ? new Date(matchweek.matches[0].kickoffTime) 
        : new Date(matchweek.deadline);

      const d2Time = matchweek.matches && matchweek.matches[3] && matchweek.matches[3].kickoffTime 
        ? new Date(matchweek.matches[3].kickoffTime) 
        : d1Time;

      const now = new Date();
      const d1Passed = now > d1Time;
      const d2Passed = now > d2Time;

      setDeadline1Passed(d1Passed);
      setDeadline2Passed(d2Passed);
      setDeadlinePassed(d1Passed);

      if (d2Passed) {
        setCountdown('LOCKED (Deadline 2 Passed)');
      } else if (d1Passed) {
        const diff = d2Time - now;
        const hrs = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff / (1000 * 60)) % 60);
        const secs = Math.floor((diff / 1000) % 60);
        setCountdown(`2nd Deadline (Games 4 & 5): ${hrs}h ${mins}m ${secs}s remaining`);
      } else {
        const diff = d1Time - now;
        const hrs = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff / (1000 * 60)) % 60);
        const secs = Math.floor((diff / 1000) % 60);
        setCountdown(`Main Deadline (Game 1 Kickoff): ${hrs}h ${mins}m ${secs}s remaining`);
      }
    };

    checkDeadlines();
    const interval = setInterval(checkDeadlines, 1000);
    return () => clearInterval(interval);
  }, [matchweek]);

  const fetchActiveData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const mw = await api.getActiveMatchweek(groupId);
      setMatchweek(mw);

      if (mw) {
        const pred = await api.getMyPredictions(mw._id, groupId);
        setPrediction(pred);
      }

      // Fetch standings to count group players
      const data = await api.getGroupStandings(groupId);
      const activeStandings = data.filter(
        (s) => s.userId && s.userId._id !== '600000000000000000000000'
      );
      setTotalPlayers(activeStandings.length || 8);
    } catch (err) {
      setError(err.message || 'Failed to load prediction form data.');
    } finally {
      setLoading(false);
    }
  };

  const calculatePowerUpCost = (powerUps) => {
    let cost = 0;
    powerUps.forEach((pu) => {
      if (pu.type === 'Double') cost += 5;
      if (pu.type === 'Triple') cost += 10;
      if (pu.type === 'Shield') cost += 15;
    });
    return cost;
  };

  const handlePredictionChange = (matchId, field, value) => {
    if (deadlinePassed) return;

    const updatedPreds = prediction.predictions.map((p) => {
      if (p.matchId.toString() === matchId.toString()) {
        return { ...p, [field]: value };
      }
      return p;
    });

    setPrediction({ ...prediction, predictions: updatedPreds });
  };

  const togglePowerUp = (matchId, type) => {
    if (deadlinePassed) return;

    let currentPUs = [...prediction.marketPowerUps];
    const matchIdStr = matchId.toString();

    const existingIndex = currentPUs.findIndex(
      (pu) => pu.matchId.toString() === matchIdStr && pu.type === type
    );

    if (existingIndex >= 0) {
      currentPUs.splice(existingIndex, 1);
    } else {
      const newPUs = [...currentPUs, { matchId: matchIdStr, type }];
      const cost = calculatePowerUpCost(newPUs);
      
      // Calculate net difference for instant validation
      const oldCost = prediction ? calculatePowerUpCost(prediction.marketPowerUps) : 0;
      const netCost = cost - oldCost;

      if (netCost > (standing?.battlePoints || 0)) {
        alert(`Insufficient Battle Points! Power-up costs exceed your standing balance.`);
        return;
      }
      currentPUs = newPUs;
    }

    setPrediction({ ...prediction, marketPowerUps: currentPUs });
  };

  const toggleGamble = (matchId) => {
    if (deadlinePassed) return;

    const matchIdStr = matchId.toString();
    const isCurrentGamble = prediction.gamble?.active && prediction.gamble?.matchId?.toString() === matchIdStr;

    if (isCurrentGamble) {
      // Toggle off
      setPrediction({
        ...prediction,
        gamble: { active: false, points: 0, matchId: null }
      });
    } else {
      // Toggle on for this match
      setPrediction({
        ...prediction,
        gamble: { active: true, points: 0, matchId: matchIdStr }
      });
    }
  };

  const handleSubmitPredictions = async () => {
    if (deadlinePassed) return;

    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await api.submitPredictions(matchweek._id, {
        groupId,
        predictions: prediction.predictions,
        captainMatchId: prediction.captainMatchId,
        gamble: prediction.gamble,
        marketPowerUps: prediction.marketPowerUps
      });
      setPrediction(res.prediction);
      setSuccessMsg('Predictions submitted/updated successfully!');
      
      if (onPointsUpdate) {
        onPointsUpdate();
      }
    } catch (err) {
      setError(err.message || 'Failed to submit predictions.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Loading predictions form...</div>;
  }

  if (error && !matchweek) {
    return <div className="card" style={{ color: 'var(--danger)', textAlign: 'center' }}>{error}</div>;
  }

  if (!matchweek) {
    return <div className="card" style={{ textAlign: 'center' }}>No active matchweeks currently scheduled.</div>;
  }

  const isSecondChanceActive = deadline1Passed && !deadline2Passed && prediction?.isAutofilled;
  const isFullyLocked = deadline2Passed || (deadline1Passed && !prediction?.isAutofilled);
  const isLocked = isFullyLocked;

  const powerUpCost = prediction ? calculatePowerUpCost(prediction.marketPowerUps) : 0;

  // Find max gamble limit scoped to group standing points
  const pointsVal = standing ? standing.totalPoints : 0;
  const rankVal = standing ? standing.rank : null;
  let maxGamble = Math.floor(pointsVal * 0.10);
  if (maxGamble < 0) maxGamble = 0;
  
  const half = Math.ceil(totalPlayers / 2);
  if (rankVal !== null && rankVal <= half) {
    maxGamble = Math.min(maxGamble, 500);
  } else {
    maxGamble = Math.min(maxGamble, 1000);
  }

  return (
    <div>
      {/* Top Header Card */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <h2 style={{ borderBottom: 'none', marginBottom: '0.25rem', paddingBottom: 0 }}>
            Matchweek <span className="text-gradient">#{matchweek.matchweekNumber}</span> Predictions
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Kickoff Game 1: {new Date(matchweek.matches[0]?.kickoffTime || matchweek.deadline).toLocaleString()} | Kickoff Game 4: {new Date(matchweek.matches[3]?.kickoffTime || matchweek.deadline).toLocaleString()}
          </p>
        </div>

        {/* Market cost, Gamble limits & Submit buttons at the TOP of the page */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          
          {/* Market items and Gamble limit details */}
          {prediction && (
            <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '1.25rem', background: 'rgba(0,0,0,0.3)', margin: 0 }}>
              <div style={{ fontSize: '0.85rem' }}>
                Net BP Spent: <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{powerUpCost} BP</span>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-color)', height: '16px' }}></div>
              <div style={{ fontSize: '0.85rem' }}>
                Max Gamble: <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{maxGamble} pts</span>
              </div>
            </div>
          )}

          <button 
            className={`btn ${isLocked ? 'btn-secondary' : 'btn-primary'}`}
            style={{ padding: '0.6rem 1.25rem' }}
            onClick={handleSubmitPredictions}
            disabled={submitting || isLocked}
          >
            {submitting ? 'Saving...' : (isSecondChanceActive ? 'Save Second Chance Predictions' : 'Submit / Save Predictions')}
          </button>

          <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.3)', margin: 0 }}>
            {isLocked ? <Lock size={16} style={{ color: 'var(--danger)' }} /> : <Unlock size={16} style={{ color: 'var(--warning)' }} />}
            <span style={{ fontWeight: 700, color: isLocked ? 'var(--danger)' : 'var(--warning)' }}>
              {countdown}
            </span>
          </div>
        </div>
      </div>

      {prediction?.isAutofilled && (
        <div className="card" style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--primary)', border: '1px solid rgba(56, 189, 248, 0.3)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} /> Default predictions autofilled based on team ranks. {isSecondChanceActive ? 'Second Chance Deadline is active: Games 1-3 are locked, but you can edit Games 4 & 5 before Deadline 2!' : ''}
        </div>
      )}

      {error && (
        <div className="card" style={{ background: 'var(--danger-glow)', color: 'var(--danger)', marginBottom: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <AlertCircle size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> {error}
        </div>
      )}

      {successMsg && (
        <div className="card" style={{ background: 'var(--success-glow)', color: 'var(--success)', marginBottom: '1.5rem', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <UserCheck size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> {successMsg}
        </div>
      )}

      {prediction && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
            {prediction.predictions.map((singlePred, idx) => {
              const match = matchweek.matches[idx];
              if (!match) return null;

              const isMatchLocked = isFullyLocked || (isSecondChanceActive && idx < 3);

              const isCaptain = prediction.captainMatchId === match._id;
              const isGamble = prediction.gamble?.active && 
                               prediction.gamble?.matchId?.toString() === match._id.toString();

              const matchPowerUps = prediction.marketPowerUps.filter(
                (pu) => pu.matchId.toString() === match._id.toString()
              );

              const hasDouble = matchPowerUps.some(pu => pu.type === 'Double');
              const hasTriple = matchPowerUps.some(pu => pu.type === 'Triple');
              const hasShield = matchPowerUps.some(pu => pu.type === 'Shield');

              return (
                <div key={match._id} className="card" style={{ 
                  borderLeft: isCaptain ? '5px solid var(--warning)' : (isGamble ? '5px solid var(--danger)' : (match._id === matchweek.battleMatchId ? '5px solid var(--accent)' : '1px solid var(--border-color)')),
                  background: isGamble ? 'rgba(239, 68, 68, 0.01)' : 'var(--card-bg)',
                  opacity: isMatchLocked ? 0.75 : 1
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        Kickoff: {new Date(match.kickoffTime).toLocaleString()}
                      </span>
                      {match._id === matchweek.battleMatchId && (
                        <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>BATTLE MATCH</span>
                      )}
                      {isMatchLocked && (
                        <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>LOCKED</span>
                      )}
                    </div>

                    {/* Action buttons list */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      
                      {/* Captain Button */}
                      <button
                        className={`btn ${isCaptain ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderColor: isCaptain ? 'transparent' : 'rgba(245, 158, 11, 0.3)', color: isCaptain ? 'var(--bg-darker)' : 'var(--warning)' }}
                        onClick={() => {
                          if (isMatchLocked) return;
                          setPrediction({ ...prediction, captainMatchId: match._id });
                        }}
                        disabled={isMatchLocked}
                      >
                        ★ Captain (2x)
                      </button>

                      {/* Gamble Button (Always visible on all matchweeks for testing) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          className={`btn ${isGamble ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ 
                            padding: '0.35rem 0.75rem', 
                            fontSize: '0.75rem', 
                            borderColor: isGamble ? 'transparent' : 'rgba(239, 68, 68, 0.3)', 
                            color: isGamble ? 'var(--bg-darker)' : 'var(--danger)',
                            background: isGamble ? 'var(--danger)' : 'transparent'
                          }}
                          onClick={() => toggleGamble(match._id)}
                          disabled={isLocked}
                        >
                          🎲 Gamble
                        </button>

                        {isGamble && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <input
                              type="number"
                              min="1"
                              max={maxGamble}
                              className="form-input"
                              style={{ width: '80px', padding: '0.25rem 0.5rem', fontSize: '0.75rem', textAlign: 'center' }}
                              value={prediction.gamble?.points || ''}
                              onChange={(e) => {
                                if (isLocked) return;
                                const points = parseInt(e.target.value) || 0;
                                setPrediction({
                                  ...prediction,
                                  gamble: { ...prediction.gamble, points }
                                  });
                                }}
                                placeholder="Pts"
                                disabled={isLocked}
                                required
                              />
                            </div>
                          )}
                      </div>

                      {/* Power Ups */}
                      <button
                        className={`btn ${hasDouble ? 'btn-accent' : 'btn-secondary'}`}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                        onClick={() => togglePowerUp(match._id, 'Double')}
                        disabled={isLocked}
                      >
                        Double (5 BP)
                      </button>
                      <button
                        className={`btn ${hasTriple ? 'btn-accent' : 'btn-secondary'}`}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                        onClick={() => togglePowerUp(match._id, 'Triple')}
                        disabled={isLocked}
                      >
                        Triple (10 BP)
                      </button>
                      <button
                        className={`btn ${hasShield ? 'btn-accent' : 'btn-secondary'}`}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                        onClick={() => togglePowerUp(match._id, 'Shield')}
                        disabled={isLocked}
                      >
                        Shield (15 BP)
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifycontent: 'center', gap: '2rem', marginBottom: '1.5rem' }}>
                    <div style={{ textAlign: 'right', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>{match.homeTeam}</span>
                      <div className="team-logo-placeholder">{match.homeTeam.substring(0, 2).toUpperCase()}</div>
                    </div>
                    
                    <div style={{ fontWeight: 800, color: 'var(--text-muted)' }}>VS</div>
                    
                    <div style={{ textAlign: 'left', flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="team-logo-placeholder">{match.awayTeam.substring(0, 2).toUpperCase()}</div>
                      <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>{match.awayTeam}</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                    {/* Scoreline */}
                    <div className="card" style={{ background: 'rgba(0, 0, 0, 0.15)', padding: '1rem' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Scoreline</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <input
                          type="number"
                          min="0"
                          className="form-input"
                          style={{ padding: '0.5rem', textAlign: 'center', width: '50px' }}
                          value={singlePred.homeScore}
                          onChange={(e) => handlePredictionChange(match._id, 'homeScore', parseInt(e.target.value) || 0)}
                          disabled={isLocked}
                        />
                        <span>-</span>
                        <input
                          type="number"
                          min="0"
                          className="form-input"
                          style={{ padding: '0.5rem', textAlign: 'center', width: '50px' }}
                          value={singlePred.awayScore}
                          onChange={(e) => handlePredictionChange(match._id, 'awayScore', parseInt(e.target.value) || 0)}
                          disabled={isLocked}
                        />
                      </div>
                      
                      <label className="form-label" style={{ fontSize: '0.75rem', marginTop: '0.75rem' }}>Safe Bet</label>
                      <select
                        className="form-input"
                        style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                        value={singlePred.safeBet}
                        onChange={(e) => handlePredictionChange(match._id, 'safeBet', e.target.value)}
                        disabled={isLocked}
                      >
                        <option value="Home">{match.homeTeam}</option>
                        <option value="Away">{match.awayTeam}</option>
                      </select>
                    </div>

                    <div className="card" style={{ background: 'rgba(0, 0, 0, 0.15)', padding: '1rem' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Match Result</label>
                      <select
                        className="form-input"
                        style={{ marginTop: '0.25rem' }}
                        value={singlePred.result}
                        onChange={(e) => handlePredictionChange(match._id, 'result', e.target.value)}
                        disabled={isLocked}
                      >
                        <option value="Home">{match.homeTeam} Win</option>
                        <option value="Away">{match.awayTeam} Win</option>
                        <option value="Draw">Draw</option>
                      </select>
                    </div>

                    <div className="card" style={{ background: 'rgba(0, 0, 0, 0.15)', padding: '1rem' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>First Goal</label>
                      <select
                        className="form-input"
                        style={{ marginTop: '0.25rem' }}
                        value={singlePred.firstGoal}
                        onChange={(e) => handlePredictionChange(match._id, 'firstGoal', e.target.value)}
                        disabled={isLocked}
                      >
                        <option value="Home">{match.homeTeam}</option>
                        <option value="Away">{match.awayTeam}</option>
                        <option value="No goal">No goal</option>
                      </select>
                    </div>

                    <div className="card" style={{ background: 'rgba(0, 0, 0, 0.15)', padding: '1rem' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Greater Possession</label>
                      <select
                        className="form-input"
                        style={{ marginTop: '0.25rem' }}
                        value={singlePred.possession}
                        onChange={(e) => handlePredictionChange(match._id, 'possession', e.target.value)}
                        disabled={isLocked}
                      >
                        <option value="Home">{match.homeTeam}</option>
                        <option value="Away">{match.awayTeam}</option>
                        <option value="Equal">Equal Possession</option>
                      </select>
                    </div>

                    {/* Wild Prediction Category Select & Numeric Input */}
                    <div className="card" style={{ background: 'rgba(0, 0, 0, 0.15)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Wild Category</label>
                        <select
                          className="form-input"
                          style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}
                          value={singlePred.wildPredictionCategory || 'None'}
                          onChange={(e) => handlePredictionChange(match._id, 'wildPredictionCategory', e.target.value)}
                          disabled={isLocked}
                        >
                          <option value="None">None</option>
                          <option value="Yellow Cards">Yellow Cards</option>
                          <option value="Offsides">Offsides</option>
                          <option value="Corners">Corners</option>
                          <option value="Total Shots">Total Shots</option>
                        </select>
                      </div>

                      {singlePred.wildPredictionCategory && singlePred.wildPredictionCategory !== 'None' && (
                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Predicted Count</label>
                          <input
                            type="number"
                            min="0"
                            className="form-input"
                            style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}
                            value={singlePred.wildPredictionValue || 0}
                            onChange={(e) => handlePredictionChange(match._id, 'wildPredictionValue', parseInt(e.target.value) || 0)}
                            disabled={isLocked}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default PredictionForm;
