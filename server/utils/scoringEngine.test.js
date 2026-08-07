const {
  getGeneralCategoryPoints,
  getScorelinePoints,
  scoreUserPrediction,
  scoreMatchweek
} = require('./scoringEngine');

describe('Scoring Engine - General Categories', () => {
  const dist = { Home: 5, Away: 3, Draw: 2 }; // Total 10

  test('Unique correct choice (only 1 person correct)', () => {
    // If only 1 player predicted Draw and Draw is correct
    const singleDist = { Home: 9, Away: 0, Draw: 1 };
    expect(getGeneralCategoryPoints('Draw', 'Draw', singleDist, 10)).toBe(100);
  });

  test('Same correct choice (everyone correct)', () => {
    const sameDist = { Home: 10, Away: 0, Draw: 0 };
    expect(getGeneralCategoryPoints('Home', 'Home', sameDist, 10)).toBe(10);
  });

  test('Majority correct choice (largest group correct)', () => {
    // Home is correct, size 5 is the largest (5 > 3 > 2)
    expect(getGeneralCategoryPoints('Home', 'Home', dist, 10)).toBe(20);
  });

  test('Minority correct choice (smaller group correct)', () => {
    // Away is correct, size 3 is smaller than Home (5) but greater than 1
    expect(getGeneralCategoryPoints('Away', 'Away', dist, 10)).toBe(50);
  });

  test('Incorrect prediction', () => {
    expect(getGeneralCategoryPoints('Home', 'Away', dist, 10)).toBe(0);
  });
});

describe('Scoring Engine - Scoreline', () => {
  test('Exactly Correct Scoreline', () => {
    expect(getScorelinePoints(3, 2, 'Home', 3, 2)).toBe(100);
  });

  test('Safe Bet Correct (Home win, Safe bet: Home, predicted Home goals match actual)', () => {
    // Predicted 3-2 Home, Actual 3-0. Safe bet Home. Actual winner Home.
    // Safe bet matches actual winner AND Home goals (3) match.
    expect(getScorelinePoints(3, 2, 'Home', 3, 0)).toBe(50);
  });

  test('Safe Bet Correct (Away win, Safe bet: Away, predicted Away goals match actual)', () => {
    // Predicted 1-2 Away, Actual 0-2. Safe bet Away. Actual winner Away.
    // Safe bet matches actual winner AND Away goals (2) match.
    expect(getScorelinePoints(1, 2, 'Away', 0, 2)).toBe(50);
  });

  test('Safe Bet Incorrect (Match is Draw, Safe bet cannot be Draw)', () => {
    // Predicted 3-2 Home, Actual 3-3. Safe bet Home. Result is Draw.
    // Result does not match Safe bet (Home). Away goal doesn't match (2 vs 3).
    // Home goal matches (3 vs 3). Gets Home Goal Correct (10 pts).
    expect(getScorelinePoints(3, 2, 'Home', 3, 3)).toBe(10);
  });

  test('Safe Bet Incorrect (Winner is Home, Safe bet is Home, but Home goals do not match)', () => {
    // Predicted 3-2, actual 2-1. Safe bet Home. Winner Home.
    // But actual Home goals is 2, predicted is 3 (no match).
    // Actual Away goals is 1, predicted is 2 (no match).
    // Total points should be 0.
    expect(getScorelinePoints(3, 2, 'Home', 2, 1)).toBe(0);
  });

  test('Away Goal Correct only', () => {
    // Predicted 3-2 Home, Actual 1-2 Away. Safe bet Home. Winner Away.
    // Safe bet doesn't match. Home goals don't match. Away goals match (2 vs 2).
    expect(getScorelinePoints(3, 2, 'Home', 1, 2)).toBe(20);
  });

  test('Home Goal Correct only', () => {
    // Predicted 3-2 Home, Actual 3-4 Away. Safe bet Home. Winner Away.
    // Safe bet doesn't match. Away goals don't match. Home goals match (3 vs 3).
    expect(getScorelinePoints(3, 2, 'Home', 3, 4)).toBe(10);
  });

  test('Incorrect completely', () => {
    expect(getScorelinePoints(3, 2, 'Home', 1, 0)).toBe(0);
  });
});
