const fs = require('fs');

const original = JSON.parse(fs.readFileSync('content.json', 'utf8'));

const tasks = [
  {
    id: "c",
    title: "Task 1 · C",
    questions: [
      {
        id: "c-1",
        prompt: "The program should count the digits in 5082 (expected 4), but prints an incorrect result. Fix it?",
        code: "int n = 5082, count = 0;\nwhile (n > 0) {\n    count = n % 10;\n    n = n / 10;\n}\nprintf(\"%d\", count);"
      },
      {
        id: "c-2",
        prompt: "Expected output is 36, but the program prints 18. Find and fix the operator error.",
        code: "#define DOUBLE(x) x+x\nprintf(\"%d\", DOUBLE(9));"
      },
      {
        id: "c-3",
        prompt: "The program should print the smallest element (-7), but prints 0.",
        code: "int a[5] = {4, -2, -7, 8, 1}, min = 0;\nfor (int i = 0; i < 5; i++)\n    if (a[i] < min) min = a[i];\nprintf(\"%d\", min);"
      },
      {
        id: "c-4",
        prompt: "This program should safely store and print the word \"world\". Fix the array size.",
        code: "char s[5] = \"world\";\nprintf(\"%s\", s);"
      },
      {
        id: "c-5",
        prompt: "Expected output is 12, but it prints 10. Fix the function so the original variable changes.",
        code: "void addTwo(int x) { x += 2; }\nint main() {\n    int a = 10;\n    addTwo(a);\n    printf(\"%d\", a);\n}"
      }
    ]
  },
  {
    id: "dsa",
    title: "Task 2 · DSA Using C",
    questions: [
      {
        id: "dsa-1",
        prompt: "The function should reverse the array exactly once. Fix the loop boundary.",
        code: "for (i = 0; i < n; i++) {\n    t = a[i];\n    a[i] = a[n - 1 - i];\n    a[n - 1 - i] = t;\n}"
      },
      {
        id: "dsa-2",
        prompt: "This bubble sort should sort in ascending order, but the comparison is incorrect.",
        code: "for (i = 0; i < n - 1; i++) {\n    for (j = 0; j < n - 1 - i; j++)\n        if (a[j] < a[j + 1])\n            swap(&a[j], &a[j + 1]);\n}"
      },
      {
        id: "dsa-3",
        prompt: "For a sorted array, binary search may loop forever when key is missing. Fix the bounds.",
        code: "low = 0; high = n - 1;\nwhile (low <= high) {\n    mid = (low + high) / 2;\n    if (a[mid] == key) return mid;\n    else if (a[mid] < key) low = mid;\n    else high = mid;\n}\nreturn -1;"
      },
      {
        id: "dsa-4",
        prompt: "With MAX = 5 and top = -1, this pop function allows popping an empty stack. Fix it.",
        code: "int pop(void) {\n    if (top < -1)\n        printf(\"Underflow\");\n    else\n        return stack[top--];\n}"
      },
      {
        id: "dsa-5",
        prompt: "Reversing this linked list loses the remaining nodes. Correct the pointer updates.",
        code: "struct Node *prev = NULL, *cur = head, *next;\nwhile (cur) {\n    cur->next = prev;\n    prev = cur;\n    cur = cur->next;\n}\nhead = prev;"
      }
    ]
  },
  {
    id: "python",
    title: "Task 3 · Python",
    questions: [
      {
        id: "python-1",
        prompt: "Create an independent copy, but changing b also changes a. Fix it.",
        code: "a = [4, 5, 6]\nb = a\nb[0] = 99\nprint(a)"
      },
      {
        id: "python-2",
        prompt: "Only one row should change, but all rows change. Fix the initialization.",
        code: "grid = [[1] * 2] * 3\ngrid[1][0] = 9\nprint(grid)"
      },
      {
        id: "python-3",
        prompt: "count_even([1, 2, 4, 5]) should return 2, but returns an incorrect count.",
        code: "def count_even(nums):\n    count = 0\n    for n in nums:\n        if n % 2 != 0:\n            count += 1\n    return count"
      },
      {
        id: "python-4",
        prompt: "Calling increase() raises UnboundLocalError. Fix it so points becomes 25.",
        code: "points = 20\ndef increase():\n    points = points + 5\nincrease()"
      },
      {
        id: "python-5",
        prompt: "The dictionary should map each student's name to their mark, but entries are overwritten.",
        code: "students = [\"Asha\", \"Dev\", \"Mia\"]\nmarks = {}\nfor i, name in enumerate(students):\n    marks[60 + i * 10] = name\nprint(marks)"
      }
    ]
  },
  {
    id: "dbms",
    title: "Task 4 · DBMS",
    questions: [
      {
        id: "dbms-1",
        prompt: "List each department with its employee count, but the query throws an error.",
        code: "SELECT name, dept, COUNT(*)\nFROM employees\nGROUP BY dept;"
      },
      {
        id: "dbms-2",
        prompt: "List employees earning less than average salary. Fix the aggregate usage.",
        code: "SELECT name FROM employees WHERE salary < AVG(salary);"
      },
      {
        id: "dbms-3",
        prompt: "Display names and salaries above 45000, but there is a syntax error.",
        code: "SELECT name salary\nFROM employees\nWHERE salary > 45000;"
      },
      {
        id: "dbms-4",
        prompt: "Find employees whose email is missing, but the query returns no results.",
        code: "SELECT * FROM employees WHERE email = NULL;"
      },
      {
        id: "dbms-5",
        prompt: "Show departments whose average salary exceeds 50000, but the query uses the wrong clause.",
        code: "SELECT dept, AVG(salary)\nFROM employees\nWHERE AVG(salary) > 50000\nGROUP BY dept;"
      }
    ]
  }
];

const level2Tasks = [
  {
    id: "css",
    title: "Task 1 · CSS Profile Card",
    questions: [
      {
        id: "css-1",
        prompt: "Write CSS in the blank style block to pass all five checks: center .container with flex in both directions and full-screen height; make .card 280px wide with 24px padding and centered text; give the card a 2px solid #444 border and 12px radius; make .title purple #673ab7 and .role grey #555 italic; style .btn with purple background #673ab7, white text, no border, 6px radius and 10px padding.",
        code: "<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    body { margin: 0; }\n    /* ===== WRITE YOUR CSS HERE ===== */\n\n  </style>\n</head>\n<body>\n  <div class=\"container\">\n    <div class=\"card\">\n      <h2 class=\"title\">Jordan</h2>\n      <p class=\"role\">UI Designer</p>\n      <button class=\"btn\">Connect</button>\n    </div>\n  </div>\n</body>\n</html>"
      }
    ]
  },
  {
    id: "canteen-bill",
    title: "Task 2 · Campus Canteen Bill",
    questions: [
      {
        id: "canteen-1",
        prompt: "Complete the missing JavaScript function bill() to calculate and display the total canteen bill. Read the selected food item price from #item and the quantity from #qty. Calculate total = price * qty, and display 'Total Bill: ₹' + total inside #result.",
        code: "<!DOCTYPE html>\n<html>\n<head>\n    <title>Canteen Bill</title>\n    <style>\n        body {\n            text-align: center;\n            font-family: Arial, sans-serif;\n            margin: 0;\n            padding: 20px 16px;\n            background: #f8fafc;\n        }\n        .canteen-card {\n            max-width: 300px;\n            margin: 0 auto;\n            padding: 24px 20px;\n            background: #ffffff;\n            border: 2px solid #e2e8f0;\n            border-radius: 14px;\n            box-shadow: 0 4px 12px rgba(0,0,0,0.06);\n        }\n        h2 {\n            font-size: 20px;\n            margin: 0 0 16px;\n            color: #1e293b;\n        }\n        .canteen-icon {\n            font-size: 36px;\n            margin-bottom: 12px;\n        }\n        .form-group {\n            margin-bottom: 12px;\n            text-align: left;\n        }\n        label {\n            display: block;\n            font-size: 13px;\n            font-weight: 600;\n            color: #475569;\n            margin-bottom: 4px;\n        }\n        select, input {\n            width: 100%;\n            padding: 8px 12px;\n            font-size: 14px;\n            border: 1px solid #cbd5e1;\n            border-radius: 6px;\n            box-sizing: border-box;\n        }\n        button {\n            width: 100%;\n            padding: 10px 16px;\n            font-size: 14px;\n            font-weight: 600;\n            background-color: #2563eb;\n            color: #ffffff;\n            border: none;\n            border-radius: 6px;\n            cursor: pointer;\n            margin-top: 6px;\n        }\n        #result {\n            font-size: 18px;\n            font-weight: bold;\n            margin: 16px 0 0;\n            color: #16a34a;\n        }\n        /* Write CSS here */\n    </style>\n</head>\n<body>\n\n    <div class=\"canteen-card\">\n        <div class=\"canteen-icon\">🥪</div>\n        <h2>Campus Canteen</h2>\n\n        <div class=\"form-group\">\n            <label for=\"item\">Select Food Item:</label>\n            <select id=\"item\">\n                <option value=\"40\">Sandwich - ₹40</option>\n                <option value=\"25\">Juice - ₹25</option>\n                <option value=\"15\">Samosa - ₹15</option>\n            </select>\n        </div>\n\n        <div class=\"form-group\">\n            <label for=\"qty\">Quantity:</label>\n            <input type=\"number\" id=\"qty\" value=\"1\" min=\"1\">\n        </div>\n\n        <button onclick=\"bill()\">Calculate Bill</button>\n\n        <p id=\"result\">Total Bill: ₹0</p>\n    </div>\n\n    <script>\n        function bill() {\n            // Write JavaScript here\n            // 1. Get price from #item and quantity from #qty\n            // 2. Calculate total = price * quantity\n            // 3. Display \"Total Bill: ₹\" + total inside #result\n        }\n    </script>\n\n</body>\n</html>"
      }
    ]
  },
  {
    id: "event-registration",
    title: "Task 3 · Event Registration Counter",
    questions: [
      {
        id: "event-1",
        prompt: "Complete the missing JavaScript functions register() and cancel() to manage event registrations. Start count at 0. register() increments count up to 5, updates #count, and if count reaches 5 displays 'Registration full!' in #message. cancel() decrements count down to 0, updates #count, and if count is below 5 displays 'Registration is open' in #message.",
        code: "<!DOCTYPE html>\n<html>\n<head>\n    <title>Event Registration</title>\n    <style>\n        body {\n            text-align: center;\n            font-family: Arial, sans-serif;\n            margin: 0;\n            padding: 20px 16px;\n            background: #f8fafc;\n        }\n        .counter-card {\n            max-width: 280px;\n            margin: 0 auto;\n            padding: 24px 20px;\n            background: #ffffff;\n            border: 2px solid #e2e8f0;\n            border-radius: 14px;\n            box-shadow: 0 4px 12px rgba(0,0,0,0.06);\n        }\n        h2 {\n            font-size: 20px;\n            margin: 0 0 12px;\n            color: #1e293b;\n        }\n        .event-badge {\n            font-size: 36px;\n            margin-bottom: 8px;\n        }\n        .count-label {\n            font-size: 13px;\n            color: #64748b;\n            margin: 8px 0 2px;\n        }\n        #count {\n            font-size: 42px;\n            font-weight: bold;\n            margin: 4px 0 16px;\n            color: #2563eb;\n        }\n        .btn-group {\n            display: flex;\n            gap: 10px;\n            justify-content: center;\n            margin-bottom: 12px;\n        }\n        button {\n            padding: 8px 16px;\n            font-size: 14px;\n            font-weight: 600;\n            border-radius: 6px;\n            border: none;\n            cursor: pointer;\n        }\n        .btn-reg { background-color: #16a34a; color: white; }\n        .btn-cancel { background-color: #dc2626; color: white; }\n        #message {\n            font-size: 14px;\n            font-weight: 600;\n            margin-top: 10px;\n            color: #475569;\n        }\n        /* Write CSS here */\n    </style>\n</head>\n<body>\n\n    <div class=\"counter-card\">\n        <div class=\"event-badge\">🎟️</div>\n        <h2>Event Registration</h2>\n\n        <p class=\"count-label\">Registered Attendees:</p>\n        <h3 id=\"count\">0</h3>\n\n        <div class=\"btn-group\">\n            <button class=\"btn-reg\" onclick=\"register()\">Register</button>\n            <button class=\"btn-cancel\" onclick=\"cancel()\">Cancel</button>\n        </div>\n\n        <p id=\"message\">Registration is open</p>\n    </div>\n\n    <script>\n        let count = 0;\n\n        function register() {\n            // Write JavaScript here\n            // 1. If count < 5, increment count\n            // 2. Update #count text\n            // 3. If count reaches 5, display \"Registration full!\" in #message\n        }\n\n        function cancel() {\n            // Write JavaScript here\n            // 1. If count > 0, decrement count\n            // 2. Update #count text\n            // 3. If count < 5, display \"Registration is open\" in #message\n        }\n    </script>\n\n</body>\n</html>"
      }
    ]
  }
];

const answerText = {
  "c-1": "Use count++; (or count += 1;) inside the while loop so each digit increments the count.",
  "c-2": "Define #define DOUBLE(x) ((x)*4) (or call DOUBLE(18) / use x*4) so the result evaluates to 36.",
  "c-3": "Initialize min = a[0]; so the minimum tracks from an existing array element.",
  "c-4": "Use char s[6] = \"world\"; to leave room for the terminating null character '\\0'.",
  "c-5": "Pass by pointer: void addTwo(int *x) { *x += 2; } and invoke addTwo(&a);.",
  "dsa-1": "Change the loop boundary to i < n / 2 so elements are swapped only once.",
  "dsa-2": "Change the comparison to if (a[j] > a[j + 1]) to swap adjacent elements out of order.",
  "dsa-3": "Update bounds with low = mid + 1; and high = mid - 1; to avoid infinite loops when missing.",
  "dsa-4": "Check if (top == -1) (or top < 0) before popping to catch the Underflow condition.",
  "dsa-5": "Save next = cur->next; before reversing cur->next = prev;, then advance cur = next;.",
  "python-1": "Create an independent copy using b = a.copy() (or b = list(a) or b = a[:]).",
  "python-2": "Initialize independent sublists using a list comprehension: grid = [[1] * 2 for _ in range(3)].",
  "python-3": "Check for even numbers using if n % 2 == 0:.",
  "python-4": "Declare global points inside increase() to modify the outer variable.",
  "python-5": "Map student name to marks: marks[name] = 60 + i * 10.",
  "dbms-1": "Remove unaggregated column: SELECT dept, COUNT(*) FROM employees GROUP BY dept;.",
  "dbms-2": "Use a subquery: SELECT name FROM employees WHERE salary < (SELECT AVG(salary) FROM employees);.",
  "dbms-3": "Add the missing comma: SELECT name, salary FROM employees WHERE salary > 45000;.",
  "dbms-4": "Use IS NULL to find missing values: WHERE email IS NULL;.",
  "dbms-5": "Filter grouped aggregates with HAVING: GROUP BY dept HAVING AVG(salary) > 50000;."
};

const level2AnswerText = {
  "css-1": "Center container with flex and min-height: 100vh; set card 280px, padding 24px, 2px solid #444, radius 12px; title #673ab7, role #555 italic; button purple #673ab7, white text, no border, radius 6px, padding 10px.",
  "canteen-1": "Read price = document.getElementById('item').value and qty = document.getElementById('qty').value; compute total = price * qty; set #result textContent to 'Total Bill: ₹' + total.",
  "event-1": "In register(), if (count < 5) count++; update #count; if (count == 5) #message = 'Registration full!'. In cancel(), if (count > 0) count--; update #count; if (count < 5) #message = 'Registration is open'."
};

const answerPatterns = {
  "c-1": [
    "count\\+\\+",
    "count\\+=1",
    "count=count\\+1",
    "n=n/10",
    "n/=10"
  ],
  "c-2": [
    "x\\*4",
    "\\(x\\)\\*4",
    "double\\(18\\)",
    "x<<2",
    "\\(x\\)<<2",
    "x\\+x\\+x\\+x",
    "36",
    "#definedouble"
  ],
  "c-3": [
    "min=a\\[0\\]",
    "min=int_max",
    "a\\[0\\]",
    "min=-7"
  ],
  "c-4": [
    "chars\\[6\\]",
    "chars\\[\\]",
    "s\\[6\\]",
    "s\\[\\]=\\\"world\\\""
  ],
  "c-5": [
    "voidaddtwo\\(int\\*x\\)",
    "addtwo\\(&a\\)",
    "\\*x\\+=2",
    "\\*x=\\*x\\+2"
  ],
  "dsa-1": [
    "i<n/2",
    "i<=n/2"
  ],
  "dsa-2": [
    "a\\[j\\]>a\\[j\\+1\\]",
    "if\\(a\\[j\\]>a\\[j\\+1\\]\\)"
  ],
  "dsa-3": [
    "low=mid\\+1",
    "high=mid-1"
  ],
  "dsa-4": [
    "top==-1",
    "top<0",
    "top<=-1"
  ],
  "dsa-5": [
    "next=cur->next",
    "cur->next=prev",
    "prev=cur",
    "cur=next"
  ],
  "python-1": [
    "b=a\\.copy\\(\\)",
    "b=list\\(a\\)",
    "b=a\\[:\\]"
  ],
  "python-2": [
    "\\[\\[1\\]\\*2for\\w+inrange\\(3\\)\\]",
    "\\[\\[1\\]\\*2for_inrange\\(3\\)\\]"
  ],
  "python-3": [
    "ifn%2==0",
    "n%2==0"
  ],
  "python-4": [
    "globalpoints",
    "points=points\\+5",
    "points\\+=5"
  ],
  "python-5": [
    "marks\\[name\\]=60\\+i\\*10",
    "marks\\[name\\]="
  ],
  "dbms-1": [
    "selectdept,count\\(\\*\\)fromemployeesgroupbydept",
    "selectdept,count\\(\\*\\)as\\w+fromemployeesgroupbydept"
  ],
  "dbms-2": [
    "salary<\\(selectavg\\(salary\\)fromemployees\\)"
  ],
  "dbms-3": [
    "selectname,salaryfromemployeeswhere"
  ],
  "dbms-4": [
    "emailisnull"
  ],
  "dbms-5": [
    "groupbydepthavingavg\\(salary\\)>50000"
  ]
};

const level2Patterns = {
  "canteen-1": [
    "bill",
    "id=[\"']?item",
    "id=[\"']?qty",
    "id=[\"']?result",
    "total",
    "(?:price\\s*\\*\\s*qty|item\\.value\\s*\\*\\s*qty\\.value)",
    "(?:textcontent|innerhtml|innertext)"
  ],
  "event-1": [
    "register",
    "cancel",
    "id=[\"']?count",
    "id=[\"']?message",
    "count\\+\\+",
    "count--",
    "registrationfull",
    "registrationisopen"
  ],
  "css-1": [
    "\\.container\\{[^}]*display:flex",
    "justify-content:center",
    "align-items:center",
    "(?:min-height|height):100vh",
    "\\.card\\{[^}]*width:280px",
    "padding:24px",
    "text-align:center",
    "(?:border:[^;}]*2px[^;}]*solid[^;}]*#444|border:[^;}]*solid[^;}]*2px[^;}]*#444|border:[^;}]*2px[^;}]*#444[^;}]*solid|border-width:2px|border:2pxsolid|border:solid2px)",
    "border(?:-top-left)?-radius:12px",
    "\\.title\\{[^}]*color:#673ab7",
    "\\.role\\{[^}]*color:#555",
    "font-style:italic",
    "\\.btn\\{[^}]*background(?:-color)?:(?:#673ab7|purple|rgb\\(103,58,183\\))",
    "color:white",
    "border:(?:none|0)",
    "border-radius:6px",
    "padding:10px"
  ]
};

const output = {
  tasks,
  level2Tasks,
  answerText,
  level2AnswerText,
  level3Questions: original.level3Questions,
  answerPatterns,
  level2Patterns
};

fs.writeFileSync('content.json', JSON.stringify(output, null, 2), 'utf8');
console.log('Successfully updated content.json');
