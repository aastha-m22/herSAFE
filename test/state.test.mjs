import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SafetyMachine } from '../src/state.js';
import { State } from '../src/config.js';
import { createEmitter } from '../src/emitter.js';

function make(settings = { armed: true, countdown: 8 }) {
  const bus = createEmitter();
  const events = [];
  bus.on('state:change', (e) => events.push(['change', e.next]));
  bus.on('state:countdown', (e) => events.push(['countdown', e.left, e.total]));
  bus.on('state:trigger', () => events.push(['trigger']));
  bus.on('state:standdown', () => events.push(['standdown']));
  const m = new SafetyMachine(bus, () => settings);
  return { m, events, settings };
}

test('starts idle and escalates to elevated when armed', () => {
  const { m, events } = make();
  assert.equal(m.value, State.IDLE);
  m.to(State.ELEVATED, 'test');
  assert.equal(m.value, State.ELEVATED);
  assert.deepEqual(events.at(-1), ['change', State.ELEVATED]);
});

test('passive elevation is blocked while disarmed', () => {
  const { m } = make({ armed: false, countdown: 8 });
  m.to(State.ELEVATED, 'shake');
  assert.equal(m.value, State.IDLE, 'should not escalate when protection is off');
});

test('entering confirming emits a countdown with the configured total', () => {
  const { m, events } = make({ armed: true, countdown: 5 });
  m.to(State.CONFIRMING, 'held');
  const cd = events.find((e) => e[0] === 'countdown');
  assert.ok(cd, 'countdown event fired');
  assert.equal(cd[2], 5, 'total equals configured countdown');
  m.cancel(); // stop the interval so the test process can exit
});

test('same-state transition is a no-op', () => {
  const { m, events } = make();
  m.to(State.IDLE, 'again');
  assert.ok(!events.some((e) => e[0] === 'change'), 'no change event for same state');
});

test('cancel from triggered returns to idle and emits standdown', () => {
  const { m, events } = make();
  m.to(State.TRIGGERED, 'manual');
  m.cancel('safe');
  assert.equal(m.value, State.IDLE);
  assert.ok(events.some((e) => e[0] === 'standdown'));
});
