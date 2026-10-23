const fs = require('fs');
const content = JSON.parse(fs.readFileSync('content.json', 'utf8'));
const patterns = content.level2Patterns['css-1'];
const groups = [[0, 1, 2, 3], [4, 5, 6], [7, 8], [9, 10, 11], [12, 13, 14, 15, 16]];

const starterCode = content.level2Tasks[0].questions[0].code;

function normalizeAnswer(answer) {
  return answer.toLowerCase().replace(/\s+/g, '');
}

const norm = normalizeAnswer(starterCode);
const res = groups.map((group) => group.every(idx => {
  const p = patterns[idx];
  return Boolean(p && new RegExp(p).test(norm));
}));
console.log('Starter code results:', res);
