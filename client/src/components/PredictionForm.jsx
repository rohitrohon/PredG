import React, { useEffect, useState } from 'react';
import api from '../api';
import { Calendar, Lock, Unlock, AlertCircle, UserCheck, RotateCcw, Info, BookOpen } from 'lucide-react';

function PredictionForm({ user, groupId, standing, onPointsUpdate }) {
  const [matchweek, setMatchweek] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deadline1Passed, setDeadline1Passed] = useState(false);
  const [deadline2Passed, setDeadline2Passed] = useState(false);
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

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

  const handleResetPredictions = () => {
    if (deadlinePassed || !matchweek) return;

    if (!window.confirm('Are you sure you want to reset all your prediction entries for this matchweek back to default?')) {
      return;
    }

    const resetTemplate = matchweek.matches.map((m) => ({
      matchId: m._id,
      result: 'Home',
      homeScore: '',
      awayScore: '',
      safeBet: 'Home',
      firstGoal: 'Home',
      possession: 'Home',
      wildPredictionCategory: 'None',
      wildPredictionValue: ''
    }));

    setPrediction({
      ...prediction,
      predictions: resetTemplate,
      captainMatchId: matchweek.matches[0] ? matchweek.matches[0]._id : null,
      gamble: { active: false, points: '', matchId: null },
      marketPowerUps: []
    });

    setSuccessMsg('Prediction form reset to default template. Click Submit to save changes.');
    setError('');
  };

  const handlePredictionChange = (matchId, field, value) => {
    if (deadlinePassed) return;

    if (field === 'wildPredictionCategory' && value && value !== 'None') {
      const existingCount = prediction.predictions.filter(
        (p) => p.matchId.toString() !== matchId.toString() && p.wildPredictionCategory === value
      ).length;

      if (existingCount >= 2) {
        alert(`Rule Limit: You can select "${value}" as the wild category for a maximum of 2 matches per matchweek.`);
        return;
      }
    }

    const updatedPreds = prediction.predictions.map((p) => {
      if (p.matchId.toString() === matchId.toString()) {
        return { ...p, [field]: value };
      }
      return p;
    });

    setPrediction({ ...prediction, predictions: updatedPreds });
  };

  const getMaxGambleLimit = () => {
    const pointsVal = standing ? standing.totalPoints : 0;
    const rankVal = standing ? standing.rank : null;
    let maxG = Math.floor(pointsVal * 0.10);
    if (maxG < 0) maxG = 0;
    
    const half = Math.ceil((totalPlayers || 8) / 2);
    if (rankVal !== null && rankVal <= half) {
      maxG = Math.min(maxG, 500);
    } else {
      maxG = Math.min(maxG, 1000);
    }
    return maxG;
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
      const totalCost = calculatePowerUpCost(newPUs);
      const userBP = standing?.battlePoints || 0;

      if (totalCost > userBP) {
        const chipCost = type === 'Double' ? 5 : (type === 'Triple' ? 10 : 15);
        alert(`Insufficient Battle Points!\n\nSelecting "${type}" requires ${chipCost} BP (Total power-up cost: ${totalCost} BP), but you only have ${userBP} Battle Points available.\n\nThis selection has been reset.`);
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
        gamble: { active: false, points: '', matchId: null }
      });
    } else {
      const maxG = getMaxGambleLimit();
      if (maxG <= 0) {
        alert(`Gamble Cap Limit Reached!\n\nYour maximum allowed gamble cap is currently 0 points based on your standing balance.\n\nGamble selection has been reset.`);
        setPrediction({
          ...prediction,
          gamble: { active: false, points: '', matchId: null }
        });
        return;
      }

      // Toggle on for this match
      setPrediction({
        ...prediction,
        gamble: { active: true, points: '', matchId: matchIdStr }
      });
    }
  };

  const handleGamblePointsInputChange = (e) => {
    if (deadlinePassed) return;
    const raw = e.target.value;
    if (raw === '' || raw === null || raw === undefined) {
      setPrediction({
        ...prediction,
        gamble: { ...prediction.gamble, points: '' }
      });
      return;
    }

    const clean = String(raw).replace(/^0+(?=\d)/, '');
    if (clean === '') {
      setPrediction({
        ...prediction,
        gamble: { ...prediction.gamble, points: '' }
      });
      return;
    }

    let points = parseInt(clean, 10);
    if (isNaN(points)) {
      setPrediction({
        ...prediction,
        gamble: { ...prediction.gamble, points: '' }
      });
      return;
    }

    points = Math.abs(points);
    const maxG = getMaxGambleLimit();

    if (points > maxG) {
      alert(`Gamble Points Exceed Cap!\n\nYou entered ${points} points, which exceeds your maximum allowed gamble cap of ${maxG} points.\n\nGamble choice has been reset.`);
      setPrediction({
        ...prediction,
        gamble: { active: false, points: '', matchId: null }
      });
      return;
    }

    setPrediction({
      ...prediction,
      gamble: { ...prediction.gamble, points }
    });
  };

  const handleSubmitPredictions = async () => {
    if (deadlinePassed) return;

    // Validate Wild Category max-2 limit
    const catCounts = {};
    for (const p of prediction.predictions) {
      const cat = p.wildPredictionCategory;
      if (cat && cat !== 'None') {
        catCounts[cat] = (catCounts[cat] || 0) + 1;
        if (catCounts[cat] > 2) {
          setError(`Validation error: "${cat}" wild category can be selected for at most 2 matches per matchweek.`);
          return;
        }
      }
    }

    // Ensure non-negative numbers via Math.abs, defaulting blank inputs to 0
    const sanitizedPredictions = prediction.predictions.map((p) => ({
      ...p,
      homeScore: Math.abs(Number(p.homeScore) || 0),
      awayScore: Math.abs(Number(p.awayScore) || 0),
      wildPredictionValue: Math.abs(Number(p.wildPredictionValue) || 0)
    }));

    let sanitizedGamble = prediction.gamble;
    if (sanitizedGamble && sanitizedGamble.active) {
      sanitizedGamble = {
        ...sanitizedGamble,
        points: Math.abs(Number(sanitizedGamble.points) || 0)
      };
    }

    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await api.submitPredictions(matchweek._id, {
        groupId,
        predictions: sanitizedPredictions,
        captainMatchId: prediction.captainMatchId,
        gamble: sanitizedGamble,
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

  const handleCleanNumericChange = (matchId, field, rawValue) => {
    if (rawValue === '' || rawValue === null || rawValue === undefined) {
      handlePredictionChange(matchId, field, '');
      return;
    }
    const cleanStr = String(rawValue).replace(/^0+(?=\d)/, '');
    if (cleanStr === '') {
      handlePredictionChange(matchId, field, '');
      return;
    }
    let parsed = parseInt(cleanStr, 10);
    if (isNaN(parsed)) parsed = '';
    else parsed = Math.abs(parsed); // Enforce non-negative absolute value
    handlePredictionChange(matchId, field, parsed);
  };

  if (loading) {
    return <div className="card" style={{ textAlign: 'center' }}>Loading prediction form...</div>;
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
    <div style={{ paddingBottom: '3rem' }}>
      {/* Top Header Card */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ borderBottom: 'none', marginBottom: '0.25rem', paddingBottom: 0 }}>
            Matchweek <span className="text-gradient">#{matchweek.matchweekNumber}</span> Predictions
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Kickoff Game 1: {new Date(matchweek.matches[0]?.kickoffTime || matchweek.deadline).toLocaleString()} | Kickoff Game 4: {new Date(matchweek.matches[3]?.kickoffTime || matchweek.deadline).toLocaleString()}
          </p>
        </div>

        {/* Countdown Badge, Reset Button & Rules Info Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', gap: '0.35rem', borderColor: 'var(--primary-glow)', color: 'var(--primary)' }}
            onClick={() => setShowRulesModal(true)}
            title="View Rules & Scoring System"
          >
            <Info size={15} /> Rules
          </button>

          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', gap: '0.35rem' }}
            onClick={handleResetPredictions}
            disabled={isLocked || submitting}
            title="Reset form back to default template"
          >
            <RotateCcw size={14} /> Reset Predictions
          </button>

          <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.3)', margin: 0 }}>
            {isLocked ? <Lock size={16} style={{ color: 'var(--danger)' }} /> : <Unlock size={16} style={{ color: 'var(--warning)' }} />}
            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: isLocked ? 'var(--danger)' : 'var(--warning)' }}>
              {countdown}
            </span>
          </div>
        </div>
      </div>

      {/* RULES MODAL OVERLAY */}
      {showRulesModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.82)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '680px',
            maxHeight: '88vh',
            overflowY: 'auto',
            background: 'rgba(15, 23, 42, 0.96)',
            border: '1px solid var(--primary-glow)',
            borderRadius: '16px',
            padding: '1.75rem',
            boxShadow: '0 20px 50px rgba(0,0,0,0.7)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontSize: '1.25rem' }}>
                <BookOpen size={22} /> PredG Point System & Rulebook
              </h3>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.3rem 0.7rem', fontSize: '0.85rem', borderRadius: '50%' }}
                onClick={() => setShowRulesModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.9rem', color: 'var(--text-main)' }}>
              
              {/* Match Result, First Goal & Possession Scoring */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', borderLeft: '4px solid var(--primary)' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontSize: '1rem' }}>⚽ Match Result, First Goal & Possession Points</h4>
                <p style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>Points awarded when your prediction for <strong>Match Result, First Goal, or Greater Possession</strong> is correct:</p>
                <ul style={{ paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <li><strong>Unique Prediction:</strong> <span style={{ color: 'var(--success)', fontWeight: 700 }}>100 pts</span> (Only you picked this outcome)</li>
                  <li><strong>Minority Group:</strong> <span style={{ color: 'var(--primary)', fontWeight: 700 }}>50 pts</span> (&lt; 50% of group players picked it)</li>
                  <li><strong>Majority Group:</strong> <span style={{ color: 'var(--warning)', fontWeight: 700 }}>20 pts</span> (&ge; 50% of group players picked it)</li>
                  <li><strong>Consensus (100%):</strong> <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>10 pts</span> (Everyone in group made the same pick)</li>
                  <li><strong>Incorrect Pick:</strong> <span style={{ color: 'var(--danger)', fontWeight: 700 }}>0 pts</span></li>
                </ul>
              </div>

              {/* Scoreline Scoring */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', borderLeft: '4px solid var(--primary)' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontSize: '1rem' }}>📊 Scoreline Points</h4>
                <p style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--primary-glow)' }}>
                  <strong>Safe Bet:</strong> Pick the team whose goal score you are confident in the scoreline
                </p>
                <ul style={{ paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <li><strong>Exact Scoreline Match:</strong> <span style={{ color: 'var(--success)', fontWeight: 700 }}>100 pts</span></li>
                  <li><strong>Safe Bet Team Score Tally Match:</strong> <span style={{ color: 'var(--primary)', fontWeight: 700 }}>50 pts</span></li>
                  <li><em>If exact scoreline & safe bet are incorrect:</em></li>
                  <ul style={{ paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <li>Away Goal Correct: <span style={{ color: 'var(--warning)', fontWeight: 700 }}>20 pts</span></li>
                    <li>Home Goal Correct: <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>10 pts</span></li>
                    <li>Both Goals Incorrect: <span style={{ color: 'var(--danger)', fontWeight: 700 }}>0 pts</span></li>
                  </ul>
                </ul>
              </div>

              {/* Wild Category */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', borderLeft: '4px solid var(--success)' }}>
                <h4 style={{ color: 'var(--success)', marginBottom: '0.5rem', fontSize: '1rem' }}>🎯 Wild Category</h4>
                <p>Predict exact stats for <em>Yellow Cards, Offsides, Corners, or Total Shots</em>:</p>
                <ul style={{ paddingLeft: '1.2rem', marginTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <li><strong>Correct Exact Count:</strong> <span style={{ color: 'var(--success)', fontWeight: 700 }}>100 pts</span></li>
                  <li><strong>Incorrect Count:</strong> <span style={{ color: 'var(--danger)', fontWeight: 700 }}>0 pts</span></li>
                </ul>
                <p style={{ marginTop: '0.4rem', fontWeight: 600, color: 'var(--warning)', fontSize: '0.85rem' }}>⚠️ Category Limit Rule: You can select the same wild category for a maximum of 2 matches per matchweek.</p>
              </div>

              {/* Consistency Bonus */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', borderLeft: '4px solid var(--accent)' }}>
                <h4 style={{ color: 'var(--accent)', marginBottom: '0.5rem', fontSize: '1rem' }}>🎁 Consistency Bonus</h4>
                <p>If you score points in <strong>any 4 out of 5 prediction categories</strong> for a single match, you receive an extra <strong>Consistency Bonus</strong>!</p>
              </div>

              {/* Captain Multiplier */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', borderLeft: '4px solid var(--warning)' }}>
                <h4 style={{ color: 'var(--warning)', marginBottom: '0.5rem', fontSize: '1rem' }}>★ Captain (2x Multiplier)</h4>
                <p>Select 1 match per matchweek as your Captain match. All match points earned from that game are multiplied by <strong>2x</strong>.</p>
              </div>

              {/* Gamble System */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', borderLeft: '4px solid var(--danger)' }}>
                <h4 style={{ color: 'var(--danger)', marginBottom: '0.5rem', fontSize: '1rem' }}>🎲 Gamble System Rules</h4>
                <p style={{ marginBottom: '0.4rem' }}>Stake standing points on 1 match per matchweek (Max 10% of total group points; capped at 500 pts for Top 50% players, 1000 pts for Bottom 50% players).</p>
                <ul style={{ paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <li><strong>4 or 5 Categories Correct:</strong> Gamble Successful ➔ <span style={{ color: 'var(--success)', fontWeight: 700 }}>+Staked Points Added</span></li>
                  <li><strong>3 Categories Correct:</strong> Gamble Neutral ➔ <span style={{ color: 'var(--warning)', fontWeight: 700 }}>0 Net Change (Points Maintained)</span></li>
                  <li><strong>Less than 3 Categories Correct:</strong> Gamble Failed ➔ <span style={{ color: 'var(--danger)', fontWeight: 700 }}>-Staked Points Deducted</span></li>
                </ul>
              </div>

              {/* Deadlines, Intelligent Autofill & Second Chance */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', borderLeft: '4px solid var(--primary)' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontSize: '1rem' }}>⏰ Deadlines, Intelligent Autofill & Second Chance Window</h4>
                <p><strong>Main Deadline:</strong> Locks before Game 1 Kickoff. Unsubmitted players automatically receive Intelligent Default Predictions with the following rules:</p>
                <ul style={{ paddingLeft: '1.2rem', marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
                  <li>Team positioned higher in the points table at the start of the matchweek will be autofilled for <strong>Match Result, First Goal, and Greater Possession</strong>.</li>
                  <li>Scoreline will be filled <strong>3-0</strong> in favour of the higher ranked team.</li>
                  <li><strong>Safe bet</strong> will always be set for the Home team and <strong>Wild Category</strong> will remain None.</li>
                  <li><strong>Captain</strong> will be selected as the last match of the matchweek, so that it can be edited before the second deadline.</li>
                  <li><strong>Gamble</strong> and other features remain unselected.</li>
                </ul>
                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}><strong>Second Chance Window:</strong> Players with default predictions can edit Games 4 & 5 before the Game 4 Kickoff deadline!</p>
              </div>

            </div>

            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button 
                className="btn btn-primary" 
                style={{ padding: '0.65rem 2.25rem', fontWeight: 700 }}
                onClick={() => setShowRulesModal(false)}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {prediction?.isAutofilled && (
        <div className="card" style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--primary)', border: '1px solid rgba(56, 189, 248, 0.3)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
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
                  {/* Top Bar for Card */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Calendar size={15} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {new Date(match.kickoffTime).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {match._id === matchweek.battleMatchId && (
                        <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>BATTLE MATCH</span>
                      )}
                      {isMatchLocked && (
                        <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>LOCKED</span>
                      )}
                    </div>

                    {/* Action buttons list */}
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Captain Button */}
                      <button
                        className={`btn ${isCaptain ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', borderColor: isCaptain ? 'transparent' : 'rgba(245, 158, 11, 0.3)', color: isCaptain ? 'var(--bg-darker)' : 'var(--warning)' }}
                        onClick={() => {
                          if (isMatchLocked) return;
                          setPrediction({ ...prediction, captainMatchId: match._id });
                        }}
                        disabled={isMatchLocked}
                      >
                        ★ Captain (2x)
                      </button>

                      {/* Gamble Button */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <button
                          className={`btn ${isGamble ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ 
                            padding: '0.3rem 0.65rem', 
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
                              style={{ width: '70px', padding: '0.25rem 0.4rem', fontSize: '0.75rem', textAlign: 'center' }}
                              value={prediction.gamble?.points === 0 || prediction.gamble?.points === '' ? '' : prediction.gamble?.points}
                              placeholder="0"
                              onFocus={(e) => e.target.select()}
                              onChange={handleGamblePointsInputChange}
                              onBlur={handleGamblePointsInputChange}
                              disabled={isLocked}
                              required
                            />
                          </div>
                        )}
                      </div>

                      {/* Power Ups */}
                      <button
                        className={`btn ${hasDouble ? 'btn-accent' : 'btn-secondary'}`}
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                        onClick={() => togglePowerUp(match._id, 'Double')}
                        disabled={isLocked}
                      >
                        Double (5 BP)
                      </button>
                      <button
                        className={`btn ${hasTriple ? 'btn-accent' : 'btn-secondary'}`}
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                        onClick={() => togglePowerUp(match._id, 'Triple')}
                        disabled={isLocked}
                      >
                        Triple (10 BP)
                      </button>
                      <button
                        className={`btn ${hasShield ? 'btn-accent' : 'btn-secondary'}`}
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                        onClick={() => togglePowerUp(match._id, 'Shield')}
                        disabled={isLocked}
                      >
                        Shield (15 BP)
                      </button>
                    </div>
                  </div>

                  {/* Team vs Team Header - Mobile Responsive */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right', flex: '1 1 120px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{match.homeTeam}</span>
                    </div>
                    
                    <div style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.9rem' }}>VS</div>
                    
                    <div style={{ textAlign: 'left', flex: '1 1 120px', display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{match.awayTeam}</span>
                    </div>
                  </div>

                  {/* Prediction Categories Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                    
                    {/* Scoreline */}
                    <div className="card" style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '0.85rem' }}>
                      <label className="form-label" style={{ fontSize: '0.7rem' }}>Scoreline</label>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <input
                          type="number"
                          min="0"
                          className="form-input"
                          style={{ padding: '0.4rem', textAlign: 'center', width: '55px', fontSize: '1rem', fontWeight: 700 }}
                          value={singlePred.homeScore === 0 || singlePred.homeScore === '' ? '' : singlePred.homeScore}
                          placeholder="0"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleCleanNumericChange(match._id, 'homeScore', e.target.value)}
                          disabled={isLocked}
                        />
                        <span style={{ fontWeight: 700 }}>-</span>
                        <input
                          type="number"
                          min="0"
                          className="form-input"
                          style={{ padding: '0.4rem', textAlign: 'center', width: '55px', fontSize: '1rem', fontWeight: 700 }}
                          value={singlePred.awayScore === 0 || singlePred.awayScore === '' ? '' : singlePred.awayScore}
                          placeholder="0"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleCleanNumericChange(match._id, 'awayScore', e.target.value)}
                          disabled={isLocked}
                        />
                      </div>
                      
                      <label className="form-label" style={{ fontSize: '0.7rem', marginTop: '0.6rem' }}>Safe Bet</label>
                      <select
                        className="form-input"
                        style={{ padding: '0.4rem', fontSize: '0.8rem' }}
                        value={singlePred.safeBet}
                        onChange={(e) => handlePredictionChange(match._id, 'safeBet', e.target.value)}
                        disabled={isLocked}
                      >
                        <option value="Home">{match.homeTeam}</option>
                        <option value="Away">{match.awayTeam}</option>
                      </select>
                    </div>

                    {/* Match Result (Home, Away, Draw) */}
                    <div className="card" style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '0.85rem' }}>
                      <label className="form-label" style={{ fontSize: '0.7rem' }}>Match Result</label>
                      <select
                        className="form-input"
                        style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}
                        value={singlePred.result}
                        onChange={(e) => handlePredictionChange(match._id, 'result', e.target.value)}
                        disabled={isLocked}
                      >
                        <option value="Home">{match.homeTeam} Win</option>
                        <option value="Away">{match.awayTeam} Win</option>
                        <option value="Draw">Draw</option>
                      </select>
                    </div>

                    {/* First Goal (Home, Away, No goal) */}
                    <div className="card" style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '0.85rem' }}>
                      <label className="form-label" style={{ fontSize: '0.7rem' }}>First Goal</label>
                      <select
                        className="form-input"
                        style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}
                        value={singlePred.firstGoal}
                        onChange={(e) => handlePredictionChange(match._id, 'firstGoal', e.target.value)}
                        disabled={isLocked}
                      >
                        <option value="Home">{match.homeTeam}</option>
                        <option value="Away">{match.awayTeam}</option>
                        <option value="No goal">No goal</option>
                      </select>
                    </div>

                    {/* Greater Possession (Home, Away, Equal) */}
                    <div className="card" style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '0.85rem' }}>
                      <label className="form-label" style={{ fontSize: '0.7rem' }}>Greater Possession</label>
                      <select
                        className="form-input"
                        style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}
                        value={singlePred.possession}
                        onChange={(e) => handlePredictionChange(match._id, 'possession', e.target.value)}
                        disabled={isLocked}
                      >
                        <option value="Home">{match.homeTeam}</option>
                        <option value="Away">{match.awayTeam}</option>
                        <option value="Equal">Equal Possession</option>
                      </select>
                    </div>

                    {/* Wild Category & Numeric Input */}
                    <div className="card" style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.7rem' }}>Wild Category</label>
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
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Predicted Count</label>
                          <input
                            type="number"
                            min="0"
                            className="form-input"
                            style={{ marginTop: '0.25rem', fontSize: '0.85rem', textAlign: 'center' }}
                            value={singlePred.wildPredictionValue === 0 || singlePred.wildPredictionValue === '' ? '' : singlePred.wildPredictionValue}
                            placeholder="0"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleCleanNumericChange(match._id, 'wildPredictionValue', e.target.value)}
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

          {/* BOTTOM SUMMARY CARD & SUBMIT BUTTON */}
          <div className="card" style={{ 
            marginTop: '2rem', 
            padding: '1.5rem', 
            background: 'rgba(15, 23, 42, 0.95)', 
            border: '1px solid var(--border-glow)', 
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.9rem' }}>
                Net BP Spent: <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1.1rem' }}>{powerUpCost} BP</span>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-color)', height: '20px' }}></div>
              <div style={{ fontSize: '0.9rem' }}>
                Max Gamble Limit: <span style={{ color: 'var(--danger)', fontWeight: 800, fontSize: '1.1rem' }}>{maxGamble} pts</span>
              </div>
            </div>

            <button 
              className={`btn ${isLocked ? 'btn-secondary' : 'btn-primary'}`}
              style={{ 
                padding: '0.85rem 2.5rem', 
                fontSize: '1.05rem', 
                fontWeight: 800, 
                width: '100%', 
                maxWidth: '450px',
                margin: '0 auto',
                boxShadow: isLocked ? 'none' : '0 0 20px rgba(56, 189, 248, 0.3)'
              }}
              onClick={handleSubmitPredictions}
              disabled={submitting || isLocked}
            >
              {submitting ? 'Saving...' : (isSecondChanceActive ? 'Save Second Chance Predictions' : 'Submit / Save Predictions')}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

export default PredictionForm;
