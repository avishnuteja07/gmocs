const fs = require('fs');
const content = JSON.parse(fs.readFileSync('content.json', 'utf8'));

content.level2Tasks = [
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
    id: "banner",
    title: "Task 2 · CSS Notification Banner",
    questions: [
      {
        id: "banner-1",
        prompt: "Write CSS in the blank style block to pass all five checks: style .banner with flex, space-between, center items, background #e0f2fe, and 14px 20px padding; give .banner a 2px solid #0284c7 border and 8px radius; style .badge with background #0284c7, white text, 4px 10px padding, 4px radius, and bold font; make .text #0369a1 color and 16px font-size; style .btn with background #0369a1, white text, no border, 8px 16px padding, and 6px radius.",
        code: "<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    body { margin: 20px; font-family: Arial, sans-serif; }\n    /* WRITE YOUR CSS HERE */\n  </style>\n</head>\n<body>\n  <div class=\"banner\">\n    <span class=\"badge\">ALERT</span>\n    <p class=\"text\">Coding challenge has officially started!</p>\n    <button class=\"btn\">View Details</button>\n  </div>\n</body>\n</html>"
      }
    ]
  },
  {
    id: "smart-bulb",
    title: "Task 3 · Smart Light Bulb",
    questions: [
      {
        id: "bulb-1",
        prompt: "Complete the JavaScript functions turnOn() and turnOff() to control the light bulb. In turnOn(), set the bulb (#bulb) background color to gold (or yellow) and change status (#status) text to 'Light is ON'. In turnOff(), set the bulb background color back to gray and change status text to 'Light is OFF'.",
        code: "<!DOCTYPE html>\n<html>\n<head>\n    <title>Smart Light Bulb</title>\n    <style>\n        body {\n            text-align: center;\n            font-family: Arial, sans-serif;\n            margin: 0;\n            padding: 24px 16px;\n            background: #f8fafc;\n        }\n        .bulb-card {\n            max-width: 280px;\n            margin: 0 auto;\n            padding: 24px 20px;\n            background: #ffffff;\n            border: 2px solid #e2e8f0;\n            border-radius: 14px;\n            box-shadow: 0 4px 12px rgba(0,0,0,0.06);\n        }\n        h2 {\n            font-size: 20px;\n            margin: 0 0 16px;\n            color: #1e293b;\n        }\n        .bulb {\n            width: 80px;\n            height: 80px;\n            border-radius: 50%;\n            background-color: gray;\n            margin: 0 auto 16px;\n            box-shadow: inset 0 2px 6px rgba(0,0,0,0.25);\n            transition: background-color 0.2s ease, box-shadow 0.2s ease;\n        }\n        #status {\n            font-size: 16px;\n            font-weight: bold;\n            margin: 0 0 16px;\n            color: #475569;\n        }\n        .btn-group {\n            display: flex;\n            gap: 12px;\n            justify-content: center;\n        }\n        button {\n            padding: 10px 18px;\n            font-size: 14px;\n            font-weight: 600;\n            border-radius: 6px;\n            border: none;\n            cursor: pointer;\n        }\n        .btn-on {\n            background-color: #eab308;\n            color: #1e293b;\n        }\n        .btn-off {\n            background-color: #64748b;\n            color: #ffffff;\n        }\n        /* Write CSS here */\n    </style>\n</head>\n<body>\n\n    <div class=\"bulb-card\">\n        <h2>Smart Light Bulb</h2>\n\n        <div id=\"bulb\" class=\"bulb\"></div>\n\n        <p id=\"status\">Light is OFF</p>\n\n        <div class=\"btn-group\">\n            <button class=\"btn-on\" onclick=\"turnOn()\">Turn ON</button>\n            <button class=\"btn-off\" onclick=\"turnOff()\">Turn OFF</button>\n        </div>\n    </div>\n\n    <script>\n        function turnOn() {\n            // Write JavaScript here\n            // 1. Change #bulb background-color to gold or yellow\n            // 2. Change #status text to \"Light is ON\"\n        }\n\n        function turnOff() {\n            // Write JavaScript here\n            // 1. Change #bulb background-color to gray\n            // 2. Change #status text to \"Light is OFF\"\n        }\n    </script>\n\n</body>\n</html>"
      }
    ]
  }
];

content.level2AnswerText = {
  "css-1": "Center container with flex and min-height: 100vh; set card 280px, padding 24px, 2px solid #444, radius 12px; title #673ab7, role #555 italic; button purple #673ab7, white text, no border, radius 6px, padding 10px.",
  "banner-1": "Style .banner with flex, space-between, center items, background #e0f2fe, padding 14px 20px, 2px solid #0284c7 border, 8px radius; .badge with background #0284c7, white text, padding 4px 10px, radius 4px, font-weight bold; .text with color #0369a1, 16px font-size; .btn with background #0369a1, white text, no border, padding 8px 16px, radius 6px.",
  "bulb-1": "In turnOn(), document.getElementById('bulb').style.backgroundColor = 'gold'; and document.getElementById('status').innerHTML = 'Light is ON';. In turnOff(), document.getElementById('bulb').style.backgroundColor = 'gray'; and document.getElementById('status').innerHTML = 'Light is OFF';"
};

content.level2Patterns = {
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
  ],
  "banner-1": [
    "\\.banner\\{[^}]*display:flex",
    "justify-content:space-between",
    "align-items:center",
    "background(?:-color)?:#e0f2fe",
    "padding:14px20px",
    "(?:border:[^;}]*2px[^;}]*solid[^;}]*#0284c7|border-width:2px|border:2pxsolid|border:solid2px)",
    "border(?:-top-left)?-radius:8px",
    "\\.badge\\{[^}]*background(?:-color)?:#0284c7",
    "color:white",
    "padding:4px10px",
    "border(?:-top-left)?-radius:4px",
    "font-weight:bold",
    "\\.text\\{[^}]*color:#0369a1",
    "font-size:16px",
    "\\.btn\\{[^}]*background(?:-color)?:#0369a1",
    "color:white",
    "border:(?:none|0)",
    "padding:8px16px",
    "border(?:-top-left)?-radius:6px"
  ],
  "bulb-1": [
    "turnon",
    "turnoff",
    "id=[\"']?bulb",
    "id=[\"']?status",
    "(?:gold|yellow|#ffd700|#eab308|#facc15)",
    "(?:gray|grey|#808080|#64748b)",
    "lightison",
    "lightisoff"
  ]
};

fs.writeFileSync('content.json', JSON.stringify(content, null, 2), 'utf8');
console.log('Successfully updated content.json with Task 2 (Banner) and Task 3 (Bulb)!');
