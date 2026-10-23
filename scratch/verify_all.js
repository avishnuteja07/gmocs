const fs = require('fs');
const content = JSON.parse(fs.readFileSync('content.json', 'utf8'));
const { level2TestCaseResults, answerIsCorrect } = require('../server.js');

console.log('================ LEVEL 1 VERIFICATION ================');
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
    console.error(`[FAIL] ${t.id} with fix: ${t.fix}`);
  }
}
console.log(`Level 1 Total: ${l1PassCount} / ${l1Tests.length} PASSED.\n`);

console.log('================ LEVEL 2 VERIFICATION ================');

// Task 1: Jordan CSS Card
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
console.log('Task 1 (CSS Profile Card):');
console.log('  Starter tests:', cssStarterRes, '(passed:', cssStarterRes.filter(Boolean).length, '/ 5)');
console.log('  Solved tests :', cssSolvedRes, '(passed:', cssSolvedRes.filter(Boolean).length, '/ 5)');

// Task 2: Campus Canteen Bill
const canteenStarter = content.level2Tasks[1].questions[0].code;
const canteenSolved = canteenStarter.replace(
  '// Write JavaScript here',
  `let price = document.getElementById("item").value;
  let qty = document.getElementById("qty").value;
  let total = price * qty;
  document.getElementById("result").innerHTML = "Total Bill: ₹" + total;`
);
const canteenStarterRes = level2TestCaseResults('canteen-1', canteenStarter);
const canteenSolvedRes = level2TestCaseResults('canteen-1', canteenSolved);
console.log('\nTask 2 (Canteen Bill):');
console.log('  Starter tests:', canteenStarterRes, '(passed:', canteenStarterRes.filter(Boolean).length, '/ 5)');
console.log('  Solved tests :', canteenSolvedRes, '(passed:', canteenSolvedRes.filter(Boolean).length, '/ 5)');

// Task 3: Event Registration Counter
const eventStarter = content.level2Tasks[2].questions[0].code;
const eventSolved = eventStarter
  .replace(
    '// Write JavaScript here',
    `if (count < 5) {
        count++;
    }
    document.getElementById("count").innerHTML = count;
    if (count == 5) {
        document.getElementById("message").innerHTML = "Registration full!";
    }`
  )
  .replace(
    '// Write JavaScript here',
    `if (count > 0) {
        count--;
    }
    document.getElementById("count").innerHTML = count;
    if (count < 5) {
        document.getElementById("message").innerHTML = "Registration is open";
    }`
  );
const eventStarterRes = level2TestCaseResults('event-1', eventStarter);
const eventSolvedRes = level2TestCaseResults('event-1', eventSolved);
console.log('\nTask 3 (Event Registration Counter):');
console.log('  Starter tests:', eventStarterRes, '(passed:', eventStarterRes.filter(Boolean).length, '/ 5)');
console.log('  Solved tests :', eventSolvedRes, '(passed:', eventSolvedRes.filter(Boolean).length, '/ 5)');
