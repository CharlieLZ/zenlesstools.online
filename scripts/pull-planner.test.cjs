const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function fixture({ privacy = false, trackerFails = false } = {}) {
  const elements = new Map();
  const events = [];
  const warnings = [];
  for (const [id, value] of Object.entries({poly:'14400',tapes:'0',pity:'0',target:'90',daysLeftInput:'0',dailyIncome:'0',guaranteed:'no',goalName:'Private goal'})) {
    elements.set(id, {value});
  }
  for (const id of ['calculateBtn','availablePulls','plannerTitle','plannerText','plannerChips']) {
    elements.set(id, {textContent:'',innerHTML:'',addEventListener(_name, fn) {this.click = fn;},appendChild() {}});
  }
  const context = vm.createContext({
    document: {getElementById: id => elements.get(id), addEventListener() {}, createElement: () => ({})},
    navigator: {doNotTrack: privacy === true ? '1' : '0',globalPrivacyControl: privacy === 'gpc'}, URLSearchParams,
    window: {location: {search:'?qa=1'}, gtag(...args) {if(trackerFails) throw new Error('tracker failed');events.push(args);}},
    console: {warn: (...args) => warnings.push(args)},
  });
  vm.runInContext(readFileSync(join(__dirname,'../assets/js/main.js'),'utf8'),context);
  context.initPullPlanner();
  return {elements,events,warnings,context,click:()=>elements.get('calculateBtn').click()};
}

test('enough for one attempt does not promise the featured agent', () => {
  const p=fixture(); p.click();
  assert.equal(p.elements.get('availablePulls').textContent,90);
  assert.doesNotMatch(p.elements.get('plannerTitle').textContent,/Ready for/);
  assert.match(p.elements.get('plannerText').textContent,/not guaranteed/i);
});

test('negative, fractional counters and invalid pity cannot produce a result event', () => {
  for (const [id,value] of [['poly','-160'],['tapes','1.5'],['pity','99'],['target','0'],['dailyIncome','Infinity'],['daysLeftInput','-1']]) {
    const p=fixture();p.elements.get(id).value=value;p.click();
    assert.equal(p.elements.get('availablePulls').textContent,'—',`${id}: hide invalid result`);
    assert.match(p.elements.get('plannerTitle').textContent,/inputs/i);
    assert.equal(p.events.length,0);
  }
});

test('initial rendering is not a completion; only explicit valid calculation is recorded', () => {
  const p=fixture();assert.equal(p.events.length,0);p.click();
  assert.equal(p.events.length,1);
  assert.equal(p.events[0][1],'calculator_complete');
  assert.equal(p.events[0][2].tool,'pull_planner');
  assert.equal(p.events[0][2].qa_internal,true);
  assert.doesNotMatch(JSON.stringify(p.events),/Private goal|14400/);
});

test('privacy and tracker failures cannot stop calculation', () => {
  for (const config of [{privacy:true},{privacy:'gpc'},{trackerFails:true}]) {
    const p=fixture(config);assert.doesNotThrow(()=>p.click());
    assert.equal(p.elements.get('availablePulls').textContent,90);
    assert.equal(p.events.length,0);
  }
});

test('a browser bad-input state cannot masquerade as blank savings', () => {
  const p=fixture();p.elements.get('poly').value='';p.elements.get('poly').validity={badInput:true};
  p.click();assert.equal(p.elements.get('availablePulls').textContent,'—');assert.equal(p.events.length,0);
});

test('zero days and blank savings are safe, with no fabricated future income', () => {
  const p=fixture();p.elements.get('poly').value='';p.elements.get('tapes').value='';
  p.elements.get('dailyIncome').value='0.8';p.click();
  assert.equal(p.elements.get('availablePulls').textContent,0);
});
