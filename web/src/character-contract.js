export const REQUIRED_BONES = [
  'hips', 'spine', 'head',
  'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
];

export function expressionValue(value) {
  if (!Number.isFinite(value)) throw new TypeError('Expression weight must be finite');
  return Math.min(1, Math.max(0, value));
}

export function inspectCharacter(vrm) {
  if (!vrm?.humanoid?.getNormalizedBoneNode) throw new Error('This file has no VRM humanoid skeleton. Convert the character to VRM first.');
  const missing = REQUIRED_BONES.filter(name => !vrm.humanoid.getNormalizedBoneNode(name));
  if (missing.length) throw new Error(`Missing required humanoid bones: ${missing.join(', ')}`);
  const expression = name => !!vrm.expressionManager?.getExpression(name);
  return {
    requiredBones: [...REQUIRED_BONES],
    capabilities: {blink:expression('blink'), smile:expression('happy'), mouth:expression('aa'),
      fingers:['leftIndexProximal','rightIndexProximal','leftThumbProximal','rightThumbProximal']
        .every(name => !!vrm.humanoid.getNormalizedBoneNode(name))},
  };
}
