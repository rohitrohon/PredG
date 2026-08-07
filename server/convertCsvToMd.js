const fs = require('fs');
const path = require('path');

// Helper to parse simple CSV line
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function csvToMarkdownTable(csvContent, title = '') {
  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length === 0) return '';

  let markdown = '';
  if (title) {
    markdown += `### ${title}\n\n`;
  }

  // Find headers and rows
  const parsedLines = lines.map(parseCsvLine);
  
  // Determine max columns
  const maxCols = Math.max(...parsedLines.map(row => row.length));
  
  // Pad rows to max columns
  const paddedLines = parsedLines.map(row => {
    while (row.length < maxCols) row.push('');
    return row.map(cell => cell.replace(/\|/g, '\\|')); // escape pipes
  });

  if (paddedLines.length === 0) return '';

  // Header row
  markdown += `| ${paddedLines[0].join(' | ')} |\n`;
  // Divider
  markdown += `| ${paddedLines[0].map(() => '---').join(' | ')} |\n`;
  // Data rows
  for (let i = 1; i < paddedLines.length; i++) {
    markdown += `| ${paddedLines[i].join(' | ')} |\n`;
  }
  markdown += '\n';
  return markdown;
}

function run() {
  const workspaceRoot = '/Users/rohit.rohon01gmail.com/Documents/PredG';
  
  // 1. Predictions CSV
  const predictionsCsvPath = path.join(workspaceRoot, 'Prediction Game 2.0 - Predictions.csv');
  const predictionsCsv = fs.readFileSync(predictionsCsvPath, 'utf-8');
  
  // 2. Battle CSV
  const battleCsvPath = path.join(workspaceRoot, 'Prediction Game 2.0 - Battle.csv');
  const battleCsv = fs.readFileSync(battleCsvPath, 'utf-8');
  
  // 3. Rankings CSV
  const rankingsCsvPath = path.join(workspaceRoot, 'Prediction Game 2.0 - Rankings.csv');
  const rankingsCsv = fs.readFileSync(rankingsCsvPath, 'utf-8');

  let outputMd = '# Prediction Game 2.0 Historical Data\n\n';
  outputMd += 'This document compiles the historical records from the 3 CSV data sheets: Predictions, Battle, and Rankings.\n\n';

  // --- PREDICTIONS SECTION ---
  outputMd += '## 1. Predictions Details (Matchweek 37)\n\n';
  
  // We can write a custom parser for Predictions.csv because it has multiple blocks separated by empty rows
  const predLines = predictionsCsv.split('\n').map(l => l.trim());
  let currentBlock = [];
  let currentBlockTitle = '';
  
  for (let line of predLines) {
    if (line.startsWith('Matchweek')) {
      outputMd += `**Active Week**: ${line}\n\n`;
      continue;
    }
    if (line.includes('Aston Villa vs') || line.includes('Chelsea FC vs') || line.includes('Brentford vs') || line.includes('Arsenal FC vs') || line.includes('Crystal Palace vs') || line.includes('CURRENT MATCHWEEK POINTS')) {
      // If we have an existing block, write it
      if (currentBlock.length > 0) {
        outputMd += csvToMarkdownTable(currentBlock.join('\n'), currentBlockTitle);
        currentBlock = [];
      }
      currentBlockTitle = line.replace(/,/g, ' ').trim();
      continue;
    }
    // Skip empty lines
    if (line.replace(/,/g, '').trim() === '') {
      continue;
    }
    currentBlock.push(line);
  }
  if (currentBlock.length > 0) {
    outputMd += csvToMarkdownTable(currentBlock.join('\n'), currentBlockTitle);
  }

  // --- BATTLES SECTION ---
  outputMd += '## 2. Battles Details\n\n';
  // Let's write the raw battle details from Battle.csv
  // We can extract columns A-B (Standings/Name-Battle Points) and D-N (Matches details)
  const battleLines = battleCsv.split('\n').map(l => l.trim()).filter(l => l.replace(/,/g, '').trim() !== '');
  outputMd += '### Matchweek 37 Battles Overview\n\n';
  
  // Let's just output the battle lines formatted as simple text/tables
  // Since it contains multiple misaligned sub-tables, we can write it as is or do a clean split.
  // Let's print out the first 25 lines of Battle CSV as a raw table or format it
  outputMd += csvToMarkdownTable(battleLines.join('\n'));

  // --- RANKINGS SECTION ---
  outputMd += '## 3. Rankings & Progressions\n\n';
  
  // Rankings has overall rankings first (lines 1-9)
  const rankingLines = rankingsCsv.split('\n').map(l => l.trim()).filter(l => l.replace(/,/g, '').trim() !== '');
  const overallRankingsLines = rankingLines.slice(0, 9);
  outputMd += csvToMarkdownTable(overallRankingsLines.join('\n'), 'Overall Season Standings');

  // Progression matrix (line 11 onwards)
  const progressionLines = rankingLines.slice(9);
  outputMd += csvToMarkdownTable(progressionLines.join('\n'), 'Weekly Progression Matrix');

  fs.writeFileSync(path.join(workspaceRoot, 'PREDG_DATA.md'), outputMd);
  console.log('Markdown successfully generated at PREDG_DATA.md');
}

run();
