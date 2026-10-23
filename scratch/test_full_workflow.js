const fs = require('fs');
const content = JSON.parse(fs.readFileSync('content.json', 'utf8'));

// Fix c-5 in content.json
content.answerPatterns['c-5'] = [
  "voidaddtwo\\(int\\*x\\)",
  "addtwo\\(&a\\)"
];
fs.writeFileSync('content.json', JSON.stringify(content, null, 2), 'utf8');

function normalizeAnswer(answer) {
  return typeof answer === 'string' ? answer.toLowerCase().replace(/\s+/g, '') : '';
}

const testCasesL1 = [
  // Task 1: C
  { id: 'c-1', fix: 'count++;' },
  { id: 'c-2', fix: '#define DOUBLE(x) ((x)*4)' },
  { id: 'c-3', fix: 'min = a[0];' },
  { id: 'c-4', fix: 'char s[6] = "world";' },
  { id: 'c-5', fix: 'void addTwo(int *x) { *x += 2; } addTwo(&a);' },

  // Task 2: DSA
  { id: 'dsa-1', fix: 'for (i = 0; i < n / 2; i++)' },
  { id: 'dsa-2', fix: 'if (a[j] > a[j + 1]) swap(&a[j], &a[j + 1]);' },
  { id: 'dsa-3', fix: 'low = mid + 1; high = mid - 1;' },
  { id: 'dsa-4', fix: 'if (top == -1) printf("Underflow");' },
  { id: 'dsa-5', fix: 'next = cur->next; cur->next = prev; prev = cur; cur = next;' },

  // Task 3: Python
  { id: 'python-1', fix: 'b = a.copy()' },
  { id: 'python-2', fix: 'grid = [[1] * 2 for _ in range(3)]' },
  { id: 'python-3', fix: 'if n % 2 == 0:' },
  { id: 'python-4', fix: 'global points\npoints = points + 5' },
  { id: 'python-5', fix: 'marks[name] = 60 + i * 10' },

  // Task 4: DBMS
  { id: 'dbms-1', fix: 'SELECT dept, COUNT(*) FROM employees GROUP BY dept;' },
  { id: 'dbms-2', fix: 'SELECT name FROM employees WHERE salary < (SELECT AVG(salary) FROM employees);' },
  { id: 'dbms-3', fix: 'SELECT name, salary FROM employees WHERE salary > 45000;' },
  { id: 'dbms-4', fix: 'SELECT * FROM employees WHERE email IS NULL;' },
  { id: 'dbms-5', fix: 'SELECT dept, AVG(salary) FROM employees GROUP BY dept HAVING AVG(salary) > 50000;' }
];

console.log('--- Testing Level 1 (20 Questions) ---');
let l1Passed = 0;
for (const tc of testCasesL1) {
  const patterns = content.answerPatterns[tc.id] || [];
  const norm = normalizeAnswer(tc.fix);
  let ok = false;
  if (tc.id === 'c-5') {
    const changesValue = ["\\*x\\+\\+", "\\+\\+\\(\\*x\\)", "\\*x\\+=1", "\\*x=\\*x\\+1", "\\*x\\+=2", "\\*x=\\*x\\+2"].some((pattern) => new RegExp(pattern).test(norm));
    ok = patterns.every((p) => new RegExp(p).test(norm)) && changesValue;
  } else if (tc.id === 'dsa-3') {
    ok = patterns.every((p) => new RegExp(p).test(norm));
  } else if (tc.id === 'dsa-5') {
    const positions = ["next=cur->next", "cur->next=prev", "cur=next"].map((p) => norm.indexOf(p));
    ok = Math.min(...positions) >= 0 && positions.every((p, idx) => idx === 0 || positions[idx - 1] <= p);
  } else if (tc.id === 'python-4') {
    ok = /globalpoints/.test(norm);
  } else {
    ok = patterns.some((p) => new RegExp(p).test(norm));
  }

  if (ok) {
    l1Passed++;
  } else {
    console.error(`FAILED L1 test for ${tc.id}: fix "${tc.fix}"`);
  }
}
console.log(`Level 1 results: ${l1Passed}/20 passed.`);

// 2. Test Level 2 Questions
console.log('\n--- Testing Level 2 (3 Questions) ---');
// CSS-1
const cssModel = `
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
`;
const cssPatterns = content.level2Patterns['css-1'];
const cssGroups = [[0, 1, 2, 3], [4, 5, 6], [7, 8], [9, 10, 11], [12, 13, 14, 15, 16]];
const cssNorm = normalizeAnswer(cssModel);
const cssResults = cssGroups.map((g) => g.every((idx) => new RegExp(cssPatterns[idx]).test(cssNorm)));
console.log('CSS-1 Model result:', cssResults);

const vm = require('vm');

// Canteen-1
const canteenStarter = content.level2Tasks[1].questions[0].code;
const canteenSolved = canteenStarter.replace(/function bill\(\) \{[\s\S]*?\}/, `function bill() {
    let price = document.getElementById("item").value;
    let qty = document.getElementById("qty").value;
    let total = price * qty;
    document.getElementById("result").innerHTML = "Total Bill: ₹" + total;
}`);

function evaluateCanteenCode(html) {
  const scriptMatch = String(html || "").match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  if (!scriptMatch) return [false, false, false, false, false];
  const js = scriptMatch[1];
  const elements = {
    item: { id: "item", value: "40" },
    qty: { id: "qty", value: "1" },
    result: { id: "result", textContent: "", innerHTML: "", innerText: "" }
  };
  const sandbox = {
    document: {
      getElementById: (id) => elements[id] || null,
      querySelector: (sel) => typeof sel === "string" && sel.startsWith("#") ? elements[sel.slice(1)] || null : null
    },
    parseInt, parseFloat, Number, console: { log: () => {} }
  };
  vm.createContext(sandbox);
  vm.runInContext(js, sandbox, { timeout: 1000 });
  const tc1 = Boolean(elements.item && elements.qty && elements.result);
  if (typeof sandbox.bill !== "function") return [tc1, false, false, false, false];
  const getRes = () => String(elements.result.textContent || elements.result.innerHTML || elements.result.innerText || "");

  elements.item.value = "40"; elements.qty.value = "1";
  sandbox.bill();
  const tc2 = getRes().includes("40");

  elements.item.value = "40"; elements.qty.value = "2";
  sandbox.bill();
  const tc3 = getRes().includes("80");

  elements.item.value = "25"; elements.qty.value = "3";
  sandbox.bill();
  const tc4 = getRes().includes("75");

  elements.item.value = "15"; elements.qty.value = "4";
  sandbox.bill();
  const tc5 = getRes().includes("60");

  return [tc1, tc2, tc3, tc4, tc5];
}

console.log('Canteen Starter result:', evaluateCanteenCode(canteenStarter));
console.log('Canteen Solved result:', evaluateCanteenCode(canteenSolved));

// Event-1
const eventStarter = content.level2Tasks[2].questions[0].code;
const eventSolved = eventStarter
  .replace(/function register\(\) \{[\s\S]*?\}/, `function register() {
    if (count < 5) {
        count++;
    }
    document.getElementById("count").innerHTML = count;
    if (count == 5) {
        document.getElementById("message").innerHTML = "Registration full!";
    }
}`)
  .replace(/function cancel\(\) \{[\s\S]*?\}/, `function cancel() {
    if (count > 0) {
        count--;
    }
    document.getElementById("count").innerHTML = count;
    if (count < 5) {
        document.getElementById("message").innerHTML = "Registration is open";
    }
}`);

function evaluateEventCode(html) {
  const scriptMatch = String(html || "").match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  if (!scriptMatch) return [false, false, false, false, false];
  const js = scriptMatch[1];
  const elements = {
    count: { id: "count", textContent: "0", innerHTML: "0", innerText: "0" },
    message: { id: "message", textContent: "Registration is open", innerHTML: "Registration is open", innerText: "Registration is open" }
  };
  const sandbox = {
    document: {
      getElementById: (id) => elements[id] || null,
      querySelector: (sel) => typeof sel === "string" && sel.startsWith("#") ? elements[sel.slice(1)] || null : null
    },
    parseInt, parseFloat, Number, console: { log: () => {} }
  };
  vm.createContext(sandbox);
  vm.runInContext(js, sandbox, { timeout: 1000 });
  const getCount = () => {
    const val = elements.count.textContent ?? elements.count.innerText ?? elements.count.innerHTML;
    const num = parseInt(String(val).trim(), 10);
    return isNaN(num) ? -1 : num;
  };
  const getMsg = () => String(elements.message.textContent || elements.message.innerHTML || elements.message.innerText || "").toLowerCase();

  const tc1 = getCount() === 0 && (getMsg().includes("open") || getMsg().length === 0);
  if (typeof sandbox.register !== "function" || typeof sandbox.cancel !== "function") return [tc1, false, false, false, false];

  sandbox.register();
  const tc2 = getCount() === 1;

  sandbox.register(); sandbox.register(); sandbox.register(); sandbox.register();
  const tc3 = getCount() === 5 && getMsg().includes("full");

  sandbox.register();
  const tc4 = getCount() === 5;

  sandbox.cancel();
  const cancelWorked = getCount() === 4 && getMsg().includes("open");
  for (let i = 0; i < 10; i++) sandbox.cancel();
  const minCapped = getCount() === 0;
  const tc5 = cancelWorked && minCapped;

  return [tc1, tc2, tc3, tc4, tc5];
}

console.log('Event Starter result:', evaluateEventCode(eventStarter));
console.log('Event Solved result:', evaluateEventCode(eventSolved));
