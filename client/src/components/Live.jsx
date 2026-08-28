import React, { useEffect, useState } from 'react';
import api from '../api';
import { Clock, Trophy, Shield, Play, AlertCircle, RefreshCw, Award, Activity, Edit3 } from 'lucide-react';

function formatDeadlineIST(dateString) {
  if (!dateString) return '';
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
  } catch (e) {
    return dateString;
  }
}

// Shorten team names for prediction display in Home section:
// Single word -> First 3 letters (Arsenal -> ARS, Chelsea -> CHE, Everton -> EVE)
// Multiple words -> 1st letter of 1st word + 2 letters of 2nd word (Manchester United -> MUN, Manchester City -> MCI)
function getShortTeamName(teamName) {
  if (!teamName || typeof teamName !== 'string') return '';
  const words = teamName.trim().split(/\s+/);
  if (words.length >= 2) {
    const w1 = words[0];
    const w2 = words[1];
    if (w1.length >= 1 && w2.length >= 2) {
      return (w1[0] + w2.slice(0, 2)).toUpperCase();
    }
  }
  return teamName.trim().slice(0, 3).toUpperCase();
}

function renderChoiceAbbreviation(choice, homeTeam, awayTeam) {
  if (!choice) return '-';
  if (choice === 'Home') return getShortTeamName(homeTeam);
  if (choice === 'Away') return getShortTeamName(awayTeam);
  if (choice === 'Draw') return 'DRAW';
  if (choice === 'Equal') return 'EQUAL';
  if (choice === 'No goal') return 'NO GOAL';
  if (homeTeam && choice.toLowerCase() === homeTeam.toLowerCase()) return getShortTeamName(homeTeam);
  if (awayTeam && choice.toLowerCase() === awayTeam.toLowerCase()) return getShortTeamName(awayTeam);
  return getShortTeamName(choice);
}

function getMatchWinnerChoice(actualResults, homeTeam, awayTeam) {
  if (!actualResults) return null;
  if (actualResults.result === 'Home' || actualResults.result === 'Away' || actualResults.result === 'Draw') {
    return actualResults.result;
  }
  const h = Number(actualResults.homeScore);
  const a = Number(actualResults.awayScore);
  if (isNaN(h) || isNaN(a)) return null;
  if (h > a) return 'Home';
  if (a > h) return 'Away';
  return 'Draw';
}

// Replicated scoring helpers on the client
function getGeneralCategoryPoints(userChoice, correctChoice, categoryDistribution = {}, totalPlayers = 1) {
  if (!correctChoice || userChoice !== correctChoice) {
    return 0;
  }

  const nCorrect = categoryDistribution[correctChoice] || 0;
  const counts = Object.values(categoryDistribution);
  const nMax = Math.max(...counts, 1);

  if (nCorrect === 1) return 100; // Unique
  if (nCorrect === totalPlayers) return 10; // Same
  if (nCorrect === nMax) return 20; // Majority
  if (nCorrect < nMax && nCorrect > 1) return 50; // Minority

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

  if (predAway === actAway) return 20;
  if (predHome === actHome) return 10;

  return 0;
}

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

// Larger bounds for match totals temperature scale
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

function Live({ groupId, user, onNavigateToPredictions }) {
  const [matchweeks, setMatchweeks] = useState([]);
  const [selectedMwId, setSelectedMwId] = useState('');
  const [predictionData, setPredictionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);

  useEffect(() => {
    fetchMatchweeks();
  }, [groupId]);

  useEffect(() => {
    if (selectedMwId) {
      fetchPredictions(selectedMwId);
    }
  }, [selectedMwId]);

  const fetchMatchweeks = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getMatchweeks(groupId);
      const visible = data.filter(mw => mw.status !== 'draft');
      setMatchweeks(visible);

      if (visible.length > 0) {
        // Default to the latest matchweek
        const latest = visible[visible.length - 1];
        setSelectedMwId(latest._id);
      }
    } catch (err) {
      setError('Failed to fetch matchweeks.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPredictions = async (mwId) => {
    try {
      setError('');
      const data = await api.getMatchweekPredictions(mwId, groupId);
      setPredictionData(data);
    } catch (err) {
      setError('Failed to load predictions details.');
    }
  };

  const selectedMw = matchweeks.find(mw => mw._id === selectedMwId);
  const deadlinePassed = predictionData?.deadlinePassed || (selectedMw && new Date() > new Date(selectedMw.deadline));

  // Countdown timer for locked matchweeks
  useEffect(() => {
    if (!selectedMw || deadlinePassed) {
      setTimeRemaining('');
      return;
    }

    const interval = setInterval(() => {
      const diff = new Date(selectedMw.deadline) - new Date();
      if (diff <= 0) {
        setTimeRemaining('LOCKED');
        clearInterval(interval);
        fetchPredictions(selectedMwId);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedMw, deadlinePassed, selectedMwId]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Loading Live shootout...</div>;
  }

  if (error) {
    return <div className="card" style={{ color: 'var(--danger)', textAlign: 'center' }}>{error}</div>;
  }

  if (matchweeks.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        <Clock size={48} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.5 }} />
        <h3>No Matchweeks Scheduled</h3>
        <p> leagueweek setup has not been finalized yet. Once matchweeks are opened, live shootouts will appear here.</p>
      </div>
    );
  }

  const rawPredictions = predictionData?.predictions || [];
  const submittedPredictions = rawPredictions
    .filter(p => p.isSubmitted)
    .sort((a, b) => (a.userId?.username || '').localeCompare(b.userId?.username || ''));
  const totalSubPlayers = submittedPredictions.length || 1;

  // Calculate choice distribution across submitted predictions to evaluate Unique/Minority/Majority/Same points
  const distribution = {};
  submittedPredictions.forEach((predDoc) => {
    predDoc.predictions.forEach((p) => {
      const mId = p.matchId.toString();
      if (!distribution[mId]) {
        distribution[mId] = {
          result: { Home: 0, Away: 0, Draw: 0 },
          firstGoal: { Home: 0, Away: 0, 'No goal': 0 },
          possession: { Home: 0, Away: 0, Equal: 0 }
        };
      }
      if (p.result in distribution[mId].result) distribution[mId].result[p.result]++;
      if (p.firstGoal in distribution[mId].firstGoal) distribution[mId].firstGoal[p.firstGoal]++;
      if (p.possession in distribution[mId].possession) distribution[mId].possession[p.possession]++;
    });
  });

  // Helper to calculate exact player scores and details
  const getScoredPlayerDoc = (predDoc) => {
    let totalLiveScore = 0;
    const correctCategoriesMap = {}; // matchId -> count
    const matchScores = {}; // matchId -> matchTotal

    // Score matches
    predDoc.predictions.forEach((p) => {
      const mId = p.matchId.toString();
      const match = selectedMw.matches.find(m => m._id.toString() === mId);
      if (!match || match.actualResults.result === null) return;

      const act = match.actualResults;
      const dist = distribution[mId] || {
        result: { Home: 0, Away: 0, Draw: 0 },
        firstGoal: { Home: 0, Away: 0, 'No goal': 0 },
        possession: { Home: 0, Away: 0, Equal: 0 }
      };

      const ptsResult = getGeneralCategoryPoints(p.result, act.result, dist.result, totalSubPlayers);
      const ptsFirstGoal = getGeneralCategoryPoints(p.firstGoal, act.firstGoal, dist.firstGoal, totalSubPlayers);
      const ptsPossession = getGeneralCategoryPoints(p.possession, act.possession, dist.possession, totalSubPlayers);
      const ptsScoreline = getScorelinePoints(p.homeScore, p.awayScore, p.safeBet, act.homeScore, act.awayScore);

      // Check wild prediction correct automatically against actual match stats
      let isWildCorrect = false;
      if (p.wildPredictionCategory && p.wildPredictionCategory !== 'None') {
        const cat = p.wildPredictionCategory;
        const val = Number(p.wildPredictionValue);
        if (cat === 'Yellow Cards' && act.yellowCards !== null && val === Number(act.yellowCards)) isWildCorrect = true;
        if (cat === 'Offsides' && act.offsides !== null && val === Number(act.offsides)) isWildCorrect = true;
        if (cat === 'Corners' && act.corners !== null && val === Number(act.corners)) isWildCorrect = true;
        if (cat === 'Total Shots' && act.shots !== null && val === Number(act.shots)) isWildCorrect = true;
      }
      if (!isWildCorrect && act.wildPredictionCorrectUsers && act.wildPredictionCorrectUsers.some(
        id => id.toString() === predDoc.userId?._id?.toString()
      )) {
        isWildCorrect = true;
      }
      const ptsWild = isWildCorrect ? 100 : 0;

      let correctCats = 0;
      if (ptsResult > 0) correctCats++;
      if (ptsScoreline > 0) correctCats++;
      if (ptsFirstGoal > 0) correctCats++;
      if (ptsPossession > 0) correctCats++;
      if (ptsWild > 0) correctCats++;
      correctCategoriesMap[mId] = correctCats;

      const gotBonus = correctCats >= 4;
      const bonusPoints = gotBonus ? 50 : 0;

      // Gamble calculation for this specific match
      let matchGamblePoints = 0;
      const isGambleMatch = predDoc.gamble?.active && predDoc.gamble.matchId && predDoc.gamble.matchId.toString() === mId;
      if (isGambleMatch) {
        const gamblePtsVal = predDoc.gamble.points || 0;
        const hasShield = predDoc.marketPowerUps?.some(pu => pu.matchId.toString() === mId && pu.type === 'Shield');

        if (correctCats >= 4) {
          matchGamblePoints = gamblePtsVal;
        } else if (correctCats === 3) {
          matchGamblePoints = 0;
        } else {
          matchGamblePoints = hasShield ? 0 : -gamblePtsVal;
        }
      }

      // Multipliers
      let captainMult = 1;
      if (predDoc.captainMatchId && predDoc.captainMatchId.toString() === mId) {
        captainMult = 2;
      }
      let doubleMult = 1;
      let tripleMult = 1;
      const powerUp = predDoc.marketPowerUps?.find(pu => pu.matchId.toString() === mId);
      if (powerUp) {
        if (powerUp.type === 'Double') doubleMult = 2;
        if (powerUp.type === 'Triple') tripleMult = 3;
      }
      const totalMultiplier = captainMult * doubleMult * tripleMult;

      const categoriesSum = ptsResult + ptsScoreline + ptsFirstGoal + ptsPossession + ptsWild;
      const matchTotal = (categoriesSum + bonusPoints + matchGamblePoints) * totalMultiplier;
      matchScores[mId] = matchTotal;
      totalLiveScore += matchTotal;
    });

    // Score Gamble (Status Display)
    let gambleStatus = 'none';
    let gambleNet = 0;

    if (predDoc.gamble?.active && predDoc.gamble.matchId) {
      const gMatchIdStr = predDoc.gamble.matchId.toString();
      const match = selectedMw.matches.find(m => m._id.toString() === gMatchIdStr);

      if (match && match.actualResults.result !== null) {
        const correctCats = correctCategoriesMap[gMatchIdStr] || 0;
        const gamblePts = predDoc.gamble.points || 0;
        const hasShield = predDoc.marketPowerUps?.some(pu => pu.matchId.toString() === gMatchIdStr && pu.type === 'Shield');

        if (correctCats >= 4) {
          gambleNet = gamblePts;
          gambleStatus = `Won (+${gamblePts} pts)`;
        } else if (correctCats === 3) {
          gambleNet = 0;
          gambleStatus = 'Retained (+0 pts)';
        } else {
          if (!hasShield) {
            gambleNet = -gamblePts;
            gambleStatus = `Lost (-${gamblePts} pts)`;
          } else {
            gambleNet = 0;
            gambleStatus = 'Shielded (+0 pts)';
          }
        }
      } else {
        gambleStatus = 'Pending';
      }
    }

    return {
      username: predDoc.userId?.username || 'Unknown',
      points: totalLiveScore,
      submitted: predDoc.isSubmitted,
      isAutofilled: predDoc.isAutofilled,
      gambleNet,
      gambleStatus,
      correctCategoriesMap
    };
  };

  // Calculate live standings
  const calculateLiveStandings = () => {
    if (!selectedMw || !deadlinePassed) return [];
    return submittedPredictions.map(p => getScoredPlayerDoc(p)).sort((a, b) => b.points - a.points);
  };

  const liveStandings = calculateLiveStandings();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      
      {/* HEADER CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ borderBottom: 'none', marginBottom: '0.25rem', paddingBottom: 0 }}>
            MatchWeek <span className="text-gradient">Results</span>
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', gap: '0.35rem', color: 'var(--primary)', borderColor: 'var(--primary-glow)' }}
            onClick={() => setShowDeadlineModal(true)}
            title="View Deadlines & Autofill Information"
          >
            <Info size={15} /> Deadline Info
          </button>

          <label className="form-label" style={{ marginBottom: 0 }}>Matchweek:</label>
          <select
            className="form-input"
            style={{ width: '180px' }}
            value={selectedMwId}
            onChange={(e) => setSelectedMwId(e.target.value)}
          >
            {matchweeks.map((mw) => (
              <option key={mw._id} value={mw._id}>Matchweek #{mw.matchweekNumber}</option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={() => fetchPredictions(selectedMwId)} style={{ padding: '0.5rem' }} title="Refresh predictions">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* DEADLINE & AUTOFILL INFO MODAL OVERLAY */}
      {showDeadlineModal && (
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
            maxWidth: '620px',
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
                <Clock size={22} /> Matchweek Deadlines & Autofill System
              </h3>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.3rem 0.7rem', fontSize: '0.85rem', borderRadius: '50%' }}
                onClick={() => setShowDeadlineModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.9rem', color: 'var(--text-main)' }}>
              
              {/* 1st Main Deadline */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', borderLeft: '4px solid var(--primary)' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontSize: '1rem' }}>⏰ 1st Main Deadline (Game 1 Kickoff)</h4>
                <p>The primary prediction deadline locks exactly at the <strong>kickoff time of Game 1</strong> in the matchweek.</p>
                <p style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Players must submit their full prediction form (scores, safe bet, result, first goal, possession, wild category, captain, gamble & power-ups) before Game 1 starts.
                </p>
              </div>

              {/* Intelligent Autofill */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', borderLeft: '4px solid var(--warning)' }}>
                <h4 style={{ color: 'var(--warning)', marginBottom: '0.5rem', fontSize: '1rem' }}>🤖 How Intelligent Autofill Works</h4>
                <p>If a player <strong>misses the 1st Main Deadline</strong> without submitting, the system automatically generates <strong>Intelligent Default Predictions</strong> for them.</p>
                <p style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Default predictions analyze official Premier League standings and team rank differences to generate realistic predictions, ensuring unsubmitted players still participate and earn points.
                </p>
              </div>

              {/* 2nd Chance Deadline */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', borderLeft: '4px solid var(--success)' }}>
                <h4 style={{ color: 'var(--success)', marginBottom: '0.5rem', fontSize: '1rem' }}>🔄 2nd Chance Deadline (Games 4 & 5)</h4>
                <p>If you missed the 1st Main Deadline and received autofilled default predictions, you are granted a <strong>Second Chance Window</strong>!</p>
                <ul style={{ paddingLeft: '1.2rem', marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <li><strong>Games 1, 2 & 3:</strong> Permanently locked with your autofilled predictions.</li>
                  <li><strong>Games 4 & 5:</strong> Editable in the Prediction tab until the <strong>2nd Chance Deadline</strong> (Game 4 Kickoff time).</li>
                </ul>
              </div>

            </div>

            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button 
                className="btn btn-primary" 
                style={{ padding: '0.65rem 2.25rem', fontWeight: 700 }}
                onClick={() => setShowDeadlineModal(false)}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BEFORE DEADLINE DISPLAY */}
      {!deadlinePassed && selectedMw && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* COUNTDOWN CARD */}
          <div className="card" style={{
            textAlign: 'center', 
            padding: '2.5rem 2rem', 
            background: 'rgba(56, 189, 248, 0.03)',
            borderColor: 'rgba(56, 189, 248, 0.2)'
          }}>
            <Clock size={48} style={{ color: 'var(--primary)', margin: '0 auto 1rem', animation: 'pulse 2s infinite' }} />
            <h2 style={{ marginBottom: '0.25rem' }}>Matchweek #{selectedMw.matchweekNumber} Submission Deadline</h2>
            <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1.1rem', margin: '0.5rem auto 1.25rem' }}>
              Deadline: {formatDeadlineIST(selectedMw.deadline || selectedMw.submissionDeadline)}
            </div>
            <div style={{
              fontSize: '2.5rem', 
              fontWeight: 800, 
              fontFamily: 'monospace', 
              color: 'var(--primary)',
              background: 'rgba(0,0,0,0.25)',
              padding: '0.75rem 1.75rem',
              borderRadius: '12px',
              display: 'inline-block',
              letterSpacing: '0.05em',
              boxShadow: '0 0 20px rgba(56, 189, 248, 0.1)'
            }}>
              {timeRemaining || 'LOCKING...'}
            </div>

            {onNavigateToPredictions && (
              <div style={{ marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onNavigateToPredictions}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.75rem',
                    fontSize: '1rem',
                    fontWeight: 700
                  }}
                >
                  <Edit3 size={18} /> Fill Prediction
                </button>
              </div>
            )}

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '1.25rem' }}>
              Player predictions for all categories remain hidden until the submission deadline passes.
            </p>
          </div>

          {/* FIXTURES & DETAILS CARD */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={18} style={{ color: 'var(--primary)' }} /> Matchweek #{selectedMw.matchweekNumber} Fixtures
              </h3>
              <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                Predictions Hidden Until Deadline
              </span>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '80px', textAlign: 'center' }}>Match No.</th>
                    <th>Home Team</th>
                    <th style={{ textAlign: 'center', width: '40px' }}>vs</th>
                    <th>Away Team</th>
                    <th style={{ textAlign: 'center' }}>Kickoff Time</th>
                    <th style={{ textAlign: 'center' }}>Predictions Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMw.matches?.map((m, idx) => (
                    <tr key={m._id || idx}>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>#{idx + 1}</td>
                      <td style={{ fontWeight: 700 }}>{m.homeTeam}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>vs</td>
                      <td style={{ fontWeight: 700 }}>{m.awayTeam}</td>
                      <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                        {new Date(m.kickoffTime).toLocaleString(undefined, {
                          weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                          Locked until deadline
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* AFTER DEADLINE ACTIVE VIEW */}
      {deadlinePassed && selectedMw && (
        <>
          {/* LIVE MATCHWEEK STANDINGS GRID */}
          <div className="card" style={{ borderLeft: '4px solid var(--primary)', background: 'rgba(56, 189, 248, 0.02)' }}>
            <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Trophy size={18} style={{ color: 'var(--primary)' }} /> Live standings
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              {liveStandings.map((p, idx) => (
                <div key={idx} className="card" style={{ 
                  padding: '0.75rem 1rem', 
                  background: 'rgba(0,0,0,0.2)', 
                  borderColor: p.username === user.username ? 'var(--primary)' : 'var(--border-color)',
                  boxShadow: p.username === user.username ? '0 0 10px rgba(56, 189, 248, 0.05)' : 'none'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <small style={{ color: 'var(--text-muted)', fontWeight: 700 }}>#{idx + 1}</small>
                    {p.isAutofilled && <span className="badge badge-warning" style={{ fontSize: '0.55rem', padding: '0.1rem 0.35rem' }}>Autofill</span>}
                  </div>
                  <h4 style={{ margin: '0.2rem 0', fontWeight: 700, fontSize: '1rem', color: p.username === user.username ? 'var(--primary)' : 'inherit' }}>
                    {p.username}
                  </h4>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {p.points} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TABLE: FIXTURES AND RESULTS AT A GLANCE */}
          <div className="card">
            <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} style={{ color: 'var(--success)' }} /> Matchweek: {selectedMw?.matchweekNumber}
            </h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '100px', textAlign: 'center' }}>Match No.</th>
                    <th>Match</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center' }}>Score</th>
                    <th>1st Goal</th>
                    <th>Possession</th>
                    <th style={{ textAlign: 'center' }}>Yellow Cards</th>
                    <th style={{ textAlign: 'center' }}>Offsides</th>
                    <th style={{ textAlign: 'center' }}>Corners</th>
                    <th style={{ textAlign: 'center' }}>Total Shots</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMw.matches.map((m, idx) => {
                    const isCompleted = m.actualResults.homeScore !== null;
                    return (
                      <tr key={m._id}>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                          {idx + 1}
                        </td>
                        <td style={{ fontWeight: 700, whiteSpace: 'nowrap', minWidth: '240px' }}>
                          {m.homeTeam} vs {m.awayTeam}
                          {selectedMw.battleMatchId?.toString() === m._id.toString() && (
                            <span style={{ marginLeft: '0.5rem', color: 'var(--accent)', fontSize: '0.85rem' }} title="Battle Match of the Week">⚔️</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span className={`badge ${isCompleted ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.7rem', fontWeight: 700 }}>
                            {isCompleted ? renderChoiceAbbreviation(
                              getMatchWinnerChoice(m.actualResults, m.homeTeam, m.awayTeam),
                              m.homeTeam, m.awayTeam
                            ) : 'Not Yet Started'}
                          </span>
                        </td>
                        <td style={{ 
                          textAlign: 'center', 
                          fontWeight: 800, 
                          fontFamily: 'monospace', 
                          fontSize: '1.05rem', 
                          color: isCompleted ? 'var(--success)' : 'inherit',
                          whiteSpace: 'nowrap'
                        }}>
                          {isCompleted ? `${m.actualResults.homeScore} - ${m.actualResults.awayScore}` : 'vs'}
                        </td>
                        <td>{isCompleted ? renderChoiceAbbreviation(m.actualResults.firstGoal, m.homeTeam, m.awayTeam) : '-'}</td>
                        <td>{isCompleted ? renderChoiceAbbreviation(m.actualResults.possession, m.homeTeam, m.awayTeam) : '-'}</td>
                        <td style={{ textAlign: 'center' }}>{isCompleted && m.actualResults.yellowCards !== null ? m.actualResults.yellowCards : '-'}</td>
                        <td style={{ textAlign: 'center' }}>{isCompleted && m.actualResults.offsides !== null ? m.actualResults.offsides : '-'}</td>
                        <td style={{ textAlign: 'center' }}>{isCompleted && m.actualResults.corners !== null ? m.actualResults.corners : '-'}</td>
                        <td style={{ textAlign: 'center' }}>{isCompleted && m.actualResults.shots !== null ? m.actualResults.shots : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ALL MATCHES DETAIL SECTION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {selectedMw.matches.map((match, matchIdx) => {
              const mId = match._id.toString();
              const hasScore = match.actualResults.homeScore !== null;
              
              return (
                <div key={mId} className="card" style={{ padding: '1.5rem', background: 'rgba(15, 23, 42, 0.4)' }}>
                  
                  {/* MATCH SCORE HEADER */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    flexWrap: 'wrap', 
                    gap: '1rem', 
                    borderBottom: '1px solid var(--border-color)',
                    paddingBottom: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className="badge badge-info" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Match #{matchIdx + 1}</span>
                      <h3 style={{ margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {match.homeTeam} vs {match.awayTeam}
                        {selectedMw.battleMatchId?.toString() === match._id.toString() && (
                          <span style={{ color: 'var(--accent)', fontSize: '1rem' }} title="Battle Match of the Week">⚔️</span>
                        )}
                      </h3>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {hasScore ? (
                        <>
                          <div style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            color: 'var(--success)',
                            fontWeight: 800,
                            padding: '0.4rem 1rem',
                            borderRadius: '8px',
                            fontSize: '1.25rem',
                            fontFamily: 'monospace'
                          }}>
                            {match.actualResults.homeScore} - {match.actualResults.awayScore}
                          </div>
                          <span className="badge badge-success" style={{ fontWeight: 700 }}>
                            {renderChoiceAbbreviation(
                              getMatchWinnerChoice(match.actualResults, match.homeTeam, match.awayTeam),
                              match.homeTeam, match.awayTeam
                            )}
                          </span>
                        </>
                      ) : (
                        <>
                          <div style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-muted)',
                            fontWeight: 800,
                            padding: '0.4rem 1rem',
                            borderRadius: '8px',
                            fontSize: '1.25rem',
                            fontFamily: 'monospace'
                          }}>
                            VS
                          </div>
                          <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 700 }}>
                            <Play size={10} fill="currentColor" /> Not Yet Started
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* MATCH STATS OUTCOMES IF COMPLETED */}
                  {hasScore && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem', 
                      marginBottom: '1.5rem',
                      background: 'rgba(0,0,0,0.15)',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      flexWrap: 'nowrap',
                      overflowX: 'auto',
                      fontSize: '0.8rem'
                    }}>
                      <div style={{ whiteSpace: 'nowrap' }}>
                        1st Goal: <strong style={{ color: 'var(--primary)' }}>{renderChoiceAbbreviation(match.actualResults.firstGoal, match.homeTeam, match.awayTeam)}</strong>
                      </div>
                      <div style={{ whiteSpace: 'nowrap' }}>
                        Possession: <strong style={{ color: 'var(--primary)' }}>{renderChoiceAbbreviation(match.actualResults.possession, match.homeTeam, match.awayTeam)}</strong>
                      </div>
                      <div style={{ whiteSpace: 'nowrap' }}>
                        Yellow Cards: <strong style={{ color: 'var(--primary)' }}>{match.actualResults.yellowCards !== null && match.actualResults.yellowCards !== undefined ? match.actualResults.yellowCards : '-'}</strong>
                      </div>
                      <div style={{ whiteSpace: 'nowrap' }}>
                        Offsides: <strong style={{ color: 'var(--primary)' }}>{match.actualResults.offsides !== null && match.actualResults.offsides !== undefined ? match.actualResults.offsides : '-'}</strong>
                      </div>
                      <div style={{ whiteSpace: 'nowrap' }}>
                        Corners: <strong style={{ color: 'var(--primary)' }}>{match.actualResults.corners !== null && match.actualResults.corners !== undefined ? match.actualResults.corners : '-'}</strong>
                      </div>
                      <div style={{ whiteSpace: 'nowrap' }}>
                        Total Shots: <strong style={{ color: 'var(--primary)' }}>{match.actualResults.shots !== null && match.actualResults.shots !== undefined ? match.actualResults.shots : '-'}</strong>
                      </div>
                    </div>
                  )}

                  {/* PLAYERS DETAIL PREDICTIONS GRID (Spreadsheet Heatmap Layout) */}
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ whiteSpace: 'nowrap', minWidth: '120px' }}>Player</th>
                          <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Match Result</th>
                          <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Scoreline (Safe Bet)</th>
                          <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>1st Goal</th>
                          <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Possession</th>
                          <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Wild Prediction</th>
                          <th style={{ textAlign: 'center', color: 'var(--primary)', fontWeight: 700, whiteSpace: 'nowrap' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submittedPredictions.map((predDoc) => {
                          const matchPred = predDoc.predictions.find(p => p.matchId.toString() === mId);
                          if (!matchPred) return null;

                          const act = match.actualResults;
                          const dist = distribution[mId] || {
                            result: { Home: 0, Away: 0, Draw: 0 },
                            firstGoal: { Home: 0, Away: 0, 'No goal': 0 },
                            possession: { Home: 0, Away: 0, Equal: 0 }
                          };

                          // Calculate Category Points
                          const ptsResult = getGeneralCategoryPoints(matchPred.result, act.result, dist.result, totalSubPlayers);
                          const ptsFirstGoal = getGeneralCategoryPoints(matchPred.firstGoal, act.firstGoal, dist.firstGoal, totalSubPlayers);
                          const ptsPossession = getGeneralCategoryPoints(matchPred.possession, act.possession, dist.possession, totalSubPlayers);
                          const ptsScoreline = getScorelinePoints(matchPred.homeScore, matchPred.awayScore, matchPred.safeBet, act.homeScore, act.awayScore);

                          const isWildCorrect = act.wildPredictionCorrectUsers && act.wildPredictionCorrectUsers.some(
                            id => id.toString() === predDoc.userId?._id?.toString()
                          );
                          const ptsWild = isWildCorrect ? 100 : 0;

                          let correctCats = 0;
                          if (ptsResult > 0) correctCats++;
                          if (ptsScoreline > 0) correctCats++;
                          if (ptsFirstGoal > 0) correctCats++;
                          if (ptsPossession > 0) correctCats++;
                          if (ptsWild > 0) correctCats++;

                          const gotBonus = correctCats >= 4;
                          const bonusPoints = gotBonus ? 50 : 0;

                          // Check Multipliers & Powerups
                          const isCaptain = predDoc.captainMatchId && predDoc.captainMatchId.toString() === mId;
                          const powerUp = predDoc.marketPowerUps?.find(pu => pu.matchId.toString() === mId);
                          const hasShield = predDoc.marketPowerUps?.some(pu => pu.matchId.toString() === mId && pu.type === 'Shield');

                          let matchGamblePoints = 0;
                          const isGamble = predDoc.gamble?.active && predDoc.gamble.matchId?.toString() === mId;
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

                          // Multipliers
                          const captainMult = isCaptain ? 2 : 1;
                          let doubleMult = 1;
                          let tripleMult = 1;
                          if (powerUp) {
                            if (powerUp.type === 'Double') doubleMult = 2;
                            if (powerUp.type === 'Triple') tripleMult = 3;
                          }
                          const totalMultiplier = captainMult * doubleMult * tripleMult;

                          const categoriesSum = ptsResult + ptsScoreline + ptsFirstGoal + ptsPossession + ptsWild;
                          let matchTotal = (categoriesSum + bonusPoints + matchGamblePoints) * totalMultiplier;

                          // Render labels
                          let nameLabel = predDoc.userId?.username || 'Unknown';
                          const tags = [];
                          if (isCaptain) tags.push(<span key="cap" className="badge badge-info" style={{ fontSize: '0.55rem', padding: '0.05rem 0.25rem', color: '#000000', backgroundColor: 'rgba(0,0,0,0.08)', borderColor: 'rgba(0,0,0,0.25)', fontWeight: 800 }}>C</span>);
                          if (powerUp) tags.push(<span key="pu" className="badge badge-success" style={{ fontSize: '0.55rem', padding: '0.05rem 0.25rem', color: '#000000', backgroundColor: 'rgba(0,0,0,0.08)', borderColor: 'rgba(0,0,0,0.25)', fontWeight: 800 }}>{powerUp.type}</span>);
                          
                          if (isGamble) {
                            tags.push(<span key="gam" className="badge badge-warning" style={{ fontSize: '0.55rem', padding: '0.05rem 0.25rem', color: '#000000', backgroundColor: 'rgba(0,0,0,0.08)', borderColor: 'rgba(0,0,0,0.25)', fontWeight: 800 }}>Gamble {predDoc.gamble.points}</span>);
                            if (hasScore && correctCats < 3 && hasShield) {
                              tags.push(<span key="shi" className="badge badge-info" style={{ fontSize: '0.55rem', padding: '0.05rem 0.25rem', color: '#000000', backgroundColor: 'rgba(0,0,0,0.08)', borderColor: 'rgba(0,0,0,0.25)', fontWeight: 800 }}>🛡️ Shielded</span>);
                            }
                          }

                          return (
                            <tr key={predDoc._id} style={{
                              background: predDoc.userId?._id?.toString() === user.id ? 'rgba(56, 189, 248, 0.03)' : 'transparent'
                            }}>
                              {/* NAME COLUMN */}
                              <td style={{ 
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                ...getNameCellStyle(isCaptain, powerUp, isGamble, predDoc.marketPowerUps?.some(pu => pu.matchId.toString() === mId && pu.type === 'Shield'))
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                  <span>{nameLabel}</span>
                                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'nowrap' }}>
                                    {tags}
                                  </div>
                                </div>
                              </td>

                              {/* MATCH RESULT */}
                              <td style={{
                                ...getTemperatureStyle(ptsResult, hasScore),
                                textAlign: 'center',
                                padding: '0.5rem',
                                whiteSpace: 'nowrap'
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                    {renderChoiceAbbreviation(matchPred.result, match.homeTeam, match.awayTeam)}
                                  </span>
                                  {hasScore && (
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.9, marginTop: '2px' }}>
                                      +{ptsResult}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* SCORELINE & SAFE BET */}
                              <td style={{
                                ...getTemperatureStyle(ptsScoreline, hasScore),
                                textAlign: 'center',
                                padding: '0.5rem',
                                whiteSpace: 'nowrap'
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                    {matchPred.homeScore}-{matchPred.awayScore} ({renderChoiceAbbreviation(matchPred.safeBet, match.homeTeam, match.awayTeam)})
                                  </span>
                                  {hasScore && (
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.9, marginTop: '2px' }}>
                                      +{ptsScoreline}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 1ST GOAL */}
                              <td style={{
                                ...getTemperatureStyle(ptsFirstGoal, hasScore),
                                textAlign: 'center',
                                padding: '0.5rem',
                                whiteSpace: 'nowrap'
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                    {renderChoiceAbbreviation(matchPred.firstGoal, match.homeTeam, match.awayTeam)}
                                  </span>
                                  {hasScore && (
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.9, marginTop: '2px' }}>
                                      +{ptsFirstGoal}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* POSSESSION */}
                              <td style={{
                                ...getTemperatureStyle(ptsPossession, hasScore),
                                textAlign: 'center',
                                padding: '0.5rem',
                                whiteSpace: 'nowrap'
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                    {renderChoiceAbbreviation(matchPred.possession, match.homeTeam, match.awayTeam)}
                                  </span>
                                  {hasScore && (
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.9, marginTop: '2px' }}>
                                      +{ptsPossession}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* WILD PREDICTION */}
                              <td style={{
                                ...getTemperatureStyle(ptsWild, hasScore),
                                textAlign: 'center',
                                padding: '0.5rem',
                                whiteSpace: 'nowrap'
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>
                                    {matchPred.wildPredictionCategory !== 'None' ? `${matchPred.wildPredictionCategory}: ${matchPred.wildPredictionValue}` : '-'}
                                  </span>
                                  {hasScore && matchPred.wildPredictionCategory !== 'None' && (
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.9, marginTop: '2px' }}>
                                      +{ptsWild}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* TOTAL MATCH POINTS (TOTAL COLUMN) */}
                              <td style={{
                                ...getTotalTemperatureStyle(matchTotal, hasScore),
                                textAlign: 'center',
                                padding: '0.5rem',
                                whiteSpace: 'nowrap'
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <span style={{ fontSize: '1rem', fontWeight: 800 }}>
                                    {hasScore ? (matchTotal >= 0 ? `+${matchTotal}` : `${matchTotal}`) : 'Pending'}
                                  </span>
                                  {hasScore && totalMultiplier > 1 && (
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.9 }}>
                                      ({totalMultiplier}x)
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                </div>
              );
            })}
          </div>
        </>
      )}

    </div>
  );
}

export default Live;
