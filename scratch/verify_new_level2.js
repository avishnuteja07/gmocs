const fs = require('fs');
const content = JSON.parse(fs.readFileSync('content.json', 'utf8'));
const { level2TestCaseResults, answerIsCorrect } = require('../server.js');

console.log('================ LEVEL 1 (BUG SMASH - 20 QUESTIONS) ================');
const l1Tests = [
  { id: 'c-1', fix: 'count++;' },
  { id: 'c-2', fix: '#define DOUBLE(x) ((x)*4)' },
  { id: 'c-3', fix: 'min = a[0];' },
  { id: 'c-4', fix: 'char s[6] = "world";' },
  { id: 'c-5', fix: 'void addTwo(int *x) { *x += 2; } addTwo(&a);' },

  { id: 'dsa-1', fix: 'for (i = 0; i < n / 2; i++)' },
  { id: 'dsa-2', fix: 'if (a[j] > a[j + 1]) swap(&a[j], &a[j + 1]);' },
  { id: 'dsa-3', fix: 'low = mid + 1; high = mid - 1;' },
  { id: 'dsa-4', fix: 'if (top == -1) printf("Underflow");' },
  { id: 'dsa-5', fix: 'next = cur->next; cur->next = prev; prev = cur; cur = next;' },

  { id: 'python-1', fix: 'b = a.copy()' },
  { id: 'python-2', fix: 'grid = [[1] * 2 for _ in range(3)]' },
  { id: 'python-3', fix: 'if n % 2 == 0:' },
  { id: 'python-4', fix: 'global points\npoints = points + 5' },
  { id: 'python-5', fix: 'marks[name] = 60 + i * 10' },

  { id: 'dbms-1', fix: 'SELECT dept, COUNT(*) FROM employees GROUP BY dept;' },
  { id: 'dbms-2', fix: 'SELECT name FROM employees WHERE salary < (SELECT AVG(salary) FROM employees);' },
  { id: 'dbms-3', fix: 'SELECT name, salary FROM employees WHERE salary > 45000;' },
  { id: 'dbms-4', fix: 'SELECT * FROM employees WHERE email IS NULL;' },
  { id: 'dbms-5', fix: 'SELECT dept, AVG(salary) FROM employees GROUP BY dept HAVING AVG(salary) > 50000;' }
];

let l1PassCount = 0;
for (const t of l1Tests) {
  const ok = answerIsCorrect(t.id, t.fix);
  if (ok) {
    l1PassCount++;
    console.log(`[PASS] ${t.id}`);
  } else {
    console.error(`[FAIL] ${t.id}`);
  }
}
console.log(`Level 1 Total: ${l1PassCount} / ${l1Tests.length} PASSED.\n`);

console.log('================ LEVEL 2 (CODE RESCUE - 3 TASKS) ================');

// Task 1: Jordan CSS Profile Card
const cssStarter = content.level2Tasks[0].questions[0].code;
const cssSolved = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; }
    .container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .card {
      width: 280px;
      padding: 24px;
      text-align: center;
      border: 2px solid #444;
      border-radius: 12px;
    }
    .title {
      color: #673ab7;
    }
    .role {
      color: #555;
      font-style: italic;
    }
    .btn {
      background-color: #673ab7;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h2 class="title">Jordan</h2>
      <p class="role">UI Designer</p>
      <button class="btn">Connect</button>
    </div>
  </div>
</body>
</html>
`;
const cssStarterRes = level2TestCaseResults('css-1', cssStarter);
const cssSolvedRes = level2TestCaseResults('css-1', cssSolved);
console.log('Task 1 · CSS Profile Card:');
console.log('  Starter cases:', cssStarterRes, `(${cssStarterRes.filter(Boolean).length}/5)`);
console.log('  Solved cases :', cssSolvedRes, `(${cssSolvedRes.filter(Boolean).length}/5)`);

// Task 2: CSS Notification Banner (HTML + CSS only)
const bannerStarter = content.level2Tasks[1].questions[0].code;
const bannerSolved = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 20px; font-family: Arial, sans-serif; }
    .banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #e0f2fe;
      padding: 14px 20px;
      border: 2px solid #0284c7;
      border-radius: 8px;
    }
    .badge {
      background: #0284c7;
      color: white;
      padding: 4px 10px;
      border-radius: 4px;
      font-weight: bold;
    }
    .text {
      color: #0369a1;
      font-size: 16px;
      margin: 0;
    }
    .btn {
      background: #0369a1;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
    }
  </style>
</head>
<body>
  <div class="banner">
    <span class="badge">ALERT</span>
    <p class="text">Coding challenge has officially started!</p>
    <button class="btn">View Details</button>
  </div>
</body>
</html>
`;
const bannerStarterRes = level2TestCaseResults('banner-1', bannerStarter);
const bannerSolvedRes = level2TestCaseResults('banner-1', bannerSolved);
console.log('\nTask 2 · CSS Notification Banner (HTML + CSS Only):');
console.log('  Starter cases:', bannerStarterRes, `(${bannerStarterRes.filter(Boolean).length}/5)`);
console.log('  Solved cases :', bannerSolvedRes, `(${bannerSolvedRes.filter(Boolean).length}/5)`);

// Task 3: Smart Light Bulb (HTML, CSS + Simple JS)
const bulbStarter = content.level2Tasks[2].questions[0].code;
const bulbSolved = bulbStarter
  .replace(
    '// Write JavaScript here',
    `document.getElementById("bulb").style.backgroundColor = "gold";
     document.getElementById("status").innerHTML = "Light is ON";`
  )
  .replace(
    '// Write JavaScript here',
    `document.getElementById("bulb").style.backgroundColor = "gray";
     document.getElementById("status").innerHTML = "Light is OFF";`
  );
const bulbStarterRes = level2TestCaseResults('bulb-1', bulbStarter);
const bulbSolvedRes = level2TestCaseResults('bulb-1', bulbSolved);
console.log('\nTask 3 · Smart Light Bulb (Simple JS Logic):');
console.log('  Starter cases:', bulbStarterRes, `(${bulbStarterRes.filter(Boolean).length}/5)`);
console.log('  Solved cases :', bulbSolvedRes, `(${bulbSolvedRes.filter(Boolean).length}/5)`);
