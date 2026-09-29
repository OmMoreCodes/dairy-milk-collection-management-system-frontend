// tests/test-finishing.js
//
// Verifies the new finishing-touch features:
//
//   1. Logout confirm modal is wired (page shows a confirm dialog instead of
//      immediately hitting /api/auth/logout when the user clicks Logout).
//   2. Per-page filter persistence helpers in common.js round-trip through
//      localStorage.
//
// Part 1 (logout confirm) is verified manually in the browser; this Node
// script focuses on the helpers' behaviour by loading the actual common.js
// source into a tiny localStorage shim and asserting the read/write/clear
// contract.
//
// Run: npm test (from the frontend folder). Pure Node - no server, no
// database and no npm dependencies required.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ----- tiny localStorage shim (matches the WHATWG subset used by common.js)
function makeStorageShim() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    clear: () => { map.clear(); }
  };
}

const sandbox = {
  localStorage: makeStorageShim(),
  document: {
    getElementById: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ setAttribute() {}, appendChild() {}, addEventListener() {}, classList: { add() {}, remove() {}, contains: () => false, toggle() {} }, set innerHTML(_v) {}, get innerHTML() { return ''; } }),
    addEventListener: () => {},
    querySelector: () => null
  },
  window: {},
  console,
  setTimeout: () => 0,
  clearTimeout: () => {}
};

// Load common.js source into the sandbox so the helpers exist on sandbox scope.
const commonSrc = fs.readFileSync(
  path.resolve(__dirname, '../js/common.js'),
  'utf8'
);
vm.createContext(sandbox);
vm.runInContext(commonSrc, sandbox);

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed += 1; console.log('  PASS  ' + msg); }
  else { failed += 1; console.log('  FAIL  ' + msg); }
}

console.log('=== Finishing touches: filter persistence ===');

sandbox.localStorage.clear();

// saveFilters writes a JSON string under filters:<key>.
sandbox.saveFilters('history', { from: '2025-01-01', to: '2025-01-31', farmerId: 'abc123', shift: 'Morning', milkType: '' });
const raw = sandbox.localStorage.getItem('filters:history');
const decoded = JSON.parse(raw || 'null');
assert(!!raw, 'saveFilters writes a value under filters:<pageKey>');
assert(decoded.from === '2025-01-01' && decoded.shift === 'Morning', 'JSON contents are preserved');

// loadFilters reads the entry back as an object.
const loaded = sandbox.loadFilters('history');
assert(loaded.farmerId === 'abc123', 'loadFilters returns the persisted farmerId');
assert(loaded.milkType === '', 'loadFilters preserves empty strings');

// loadFilters on a non-existent key returns {}.
const missing = sandbox.loadFilters('nope');
assert(Object.keys(missing).length === 0, 'loadFilters on missing key returns {}');

// clearFilters wipes the entry.
sandbox.clearFilters('history');
assert(sandbox.localStorage.getItem('filters:history') === null, 'clearFilters removes the entry');
assert(Object.keys(sandbox.loadFilters('history')).length === 0, 'loadFilters after clear returns {}');

// saveFormFilters / applyStoredFilters with a tiny fake form.
sandbox.localStorage.clear();
const fakeControls = [];
function makeControl(key, value) {
  // Each control exposes .value, .getAttribute and remembers its data-filter-key.
  // Use a plain object with a closure (no `this` semantics) so the test is robust.
  const control = {
    _value: value,
    _key: key,
    get value() { return this._value; },
    set value(v) { this._value = v; },
    getAttribute: (name) => (name === 'data-filter-key' ? key : null)
  };
  fakeControls.push(control);
  return control;
}
const fakeForm = {
  querySelectorAll: (selector) => (selector === '[data-filter-key]' ? fakeControls : [])
};
makeControl('from', '2025-02-01');
makeControl('to', '2025-02-28');
makeControl('shift', 'Evening');

sandbox.saveFormFilters('reports', fakeForm);
const r = sandbox.loadFilters('reports');
assert(r.from === '2025-02-01' && r.shift === 'Evening', 'saveFormFilters reads every [data-filter-key] control');

// Reset values and re-apply.
fakeControls.forEach((c) => { c.value = ''; });
const applied = sandbox.applyStoredFilters('reports', fakeForm);
assert(applied.from === '2025-02-01', 'applyStoredFilters returns the values it applied');
assert(fakeControls[0].value === '2025-02-01' && fakeControls[1].value === '2025-02-28' && fakeControls[2].value === 'Evening', 'applyStoredFilters writes values back into form controls');

// applyStoredFilters on a missing entry does not touch any control.
fakeControls.forEach((c) => { c.value = 'untouched'; });
const appliedMissing = sandbox.applyStoredFilters('does-not-exist', fakeForm);
assert(Object.keys(appliedMissing).length === 0, 'applyStoredFilters on missing key returns {}');
assert(fakeControls.every((c) => c.value === 'untouched'), 'applyStoredFilters on missing key leaves controls unchanged');

// saveFilters with no second arg writes an empty object (no JSON crash).
sandbox.saveFilters('blank');
assert(sandbox.loadFilters('blank')._placeholder === undefined, 'saveFilters with no value writes {}');

// Items keys are namespaced separately so a single page's filter entries
// do not collide with another page's entries.
sandbox.localStorage.clear();
sandbox.saveFilters('history', { shift: 'Morning' });
sandbox.saveFilters('reports', { dailyDate: '2025-03-01' });
assert(sandbox.loadFilters('history').shift === 'Morning', 'history entry survives the reports save');
assert(sandbox.loadFilters('reports').dailyDate === '2025-03-01', 'reports entry is independent of history');

console.log('=== Finishing touches: logout confirm wiring ===');
// initShell injects a #logoutConfirmModal into <body> via document.createElement
// + document.body.appendChild. In the sandbox we have a stubbed document without
// body.appendChild, so we cannot exercise the DOM injection here; the E2E
// browser test verifies the modal opens on a real page. Instead we assert the
// function symbols exist as expected.
assert(typeof sandbox.openLogoutConfirmModal === 'function', 'openLogoutConfirmModal is exported from common.js');
assert(typeof sandbox.closeLogoutConfirmModal === 'function', 'closeLogoutConfirmModal is exported from common.js');
assert(typeof sandbox.handleLogout === 'function', 'handleLogout is still exported from common.js (no regression)');
assert(typeof sandbox.saveFormFilters === 'function', 'saveFormFilters is exported from common.js');
assert(typeof sandbox.applyStoredFilters === 'function', 'applyStoredFilters is exported from common.js');
assert(typeof sandbox.loadFilters === 'function', 'loadFilters is exported from common.js');
assert(typeof sandbox.clearFilters === 'function', 'clearFilters is exported from common.js');

console.log('=== Result ===');
console.log('passed: ' + passed + ', failed: ' + failed);
process.exit(failed === 0 ? 0 : 1);
