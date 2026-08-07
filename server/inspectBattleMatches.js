const fs = require('fs');
const path = require('path');

function run() {
  const csvPath = '/Users/rohit.rohon01gmail.com/Documents/PredG/Prediction Game 2.0 - Battle.csv';
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const lines = csv.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  lines.forEach((line, idx) => {
    if (line.includes('Battle Match')) {
      console.log(`Line ${idx + 1}:`, line);
    }
  });
}

run();
