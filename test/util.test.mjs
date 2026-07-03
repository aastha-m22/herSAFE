import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, isValidPhone, sanitizeText } from '../src/utils/util.js';

test('normalizePhone keeps a single leading + and strips junk', () => {
  assert.equal(normalizePhone('+91 (98765) 43210'), '+919876543210');
  assert.equal(normalizePhone('098-765-4321'), '0987654321');
  assert.equal(normalizePhone('++1+2+3'), '+123');
});

test('isValidPhone accepts 7–15 digit numbers, rejects junk', () => {
  assert.ok(isValidPhone('+919876543210'));
  assert.ok(isValidPhone('1234567'));
  assert.ok(!isValidPhone('12345'));        // too short
  assert.ok(!isValidPhone('abcdefg'));      // non-numeric
  assert.ok(!isValidPhone('+1234567890123456')); // too long
});

test('sanitizeText strips control chars, collapses whitespace, caps length', () => {
  assert.equal(sanitizeText('  hello   world  '), 'hello world');
  assert.equal(sanitizeText('a\u0000b\u001Fc'), 'abc');
  assert.equal(sanitizeText('x'.repeat(100), 10).length, 10);
});
