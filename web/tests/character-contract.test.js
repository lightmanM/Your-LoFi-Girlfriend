import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectCharacter, expressionValue, REQUIRED_BONES } from '../src/character-contract.js';

function humanoid(missing = []) {
  return {getNormalizedBoneNode: name => REQUIRED_BONES.includes(name) && !missing.includes(name) ? {name} : null};
}

test('rejects a non-humanoid before replacing the current character', () => {
  assert.throws(() => inspectCharacter({}), /humanoid/i);
  assert.throws(() => inspectCharacter({humanoid: humanoid(['hips'])}), /hips/);
});

test('missing optional expressions disable features without rejecting a valid body', () => {
  const report = inspectCharacter({humanoid: humanoid(), expressionManager:{getExpression:()=>null}});
  assert.equal(report.capabilities.smile, false);
  assert.equal(report.capabilities.blink, false);
  assert.equal(report.requiredBones.length, REQUIRED_BONES.length);
});

test('semantic expression support is read from the imported character', () => {
  const report = inspectCharacter({humanoid:humanoid(), expressionManager:{getExpression:n=>['happy','blink','aa'].includes(n)?{}:null}});
  assert.equal(report.capabilities.smile,true);
  assert.equal(report.capabilities.blink,true);
  assert.equal(report.capabilities.mouth,true);
});

test('expression weights clamp and reject non-finite input', () => {
  assert.equal(expressionValue(5),1);
  assert.equal(expressionValue(-2),0);
  assert.equal(expressionValue(.4),.4);
  assert.throws(()=>expressionValue(NaN), /finite/);
});
