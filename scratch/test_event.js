const vm = require('vm');
const elements = {
  count: { id: 'count', textContent: '0', innerHTML: '0', innerText: '0' },
  message: { id: 'message', textContent: 'Registration is open', innerHTML: 'Registration is open', innerText: 'Registration is open' }
};
const sandbox = {
  document: {
    getElementById: (id) => elements[id] || null,
    querySelector: (sel) => typeof sel === 'string' && sel.startsWith('#') ? elements[sel.slice(1)] || null : null
  },
  parseInt, parseFloat, Number, console: { log: () => {} }
};
const js = `
let count = 0;
function register() {
    if (count < 5) count++;
    document.getElementById('count').innerHTML = count;
    if (count == 5) document.getElementById('message').innerHTML = 'Registration full!';
}
function cancel() {
    if (count > 0) count--;
    document.getElementById('count').innerHTML = count;
    if (count < 5) document.getElementById('message').innerHTML = 'Registration is open';
}
`;
vm.createContext(sandbox);
vm.runInContext(js, sandbox);

const getCount = () => {
  const val = elements.count.innerHTML;
  return parseInt(String(val).trim(), 10);
};
const getMsg = () => String(elements.message.innerHTML).toLowerCase();

console.log('Initial:', getCount(), getMsg());
sandbox.register();
console.log('After 1 reg:', getCount(), getMsg());
sandbox.register(); sandbox.register(); sandbox.register(); sandbox.register();
console.log('After 5 reg:', getCount(), getMsg());
sandbox.register();
console.log('After 6th reg (capped):', getCount(), getMsg());
sandbox.cancel();
console.log('After cancel:', getCount(), getMsg());
for (let i = 0; i < 10; i++) sandbox.cancel();
console.log('After 10 cancels (min 0):', getCount(), getMsg());
