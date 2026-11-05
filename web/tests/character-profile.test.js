import test from 'node:test';
import assert from 'node:assert/strict';
import {applySeatedProfile} from '../src/companion/character-profile.js';

test('Vivi seated calibration pins only her skirt springs, preserving hair and sleeve simulation',()=>{
 const skirt={bone:{name:'J_Sec_L_SkirtFront1'}},hair={bone:{name:'HairJoint-1'}},sleeve={bone:{name:'J_Sec_L_LowerSleeve'}};
 const manager={joints:new Set([skirt,hair,sleeve]),deleteJoint(j){this.joints.delete(j);}};
 applySeatedProfile({springBoneManager:manager},'vivi');
 assert.deepEqual([...manager.joints],[hair,sleeve]);
});
test('unknown character profiles never apply Vivi-specific bone adjustments',()=>{
 const manager={joints:new Set([{bone:{name:'J_Sec_L_SkirtFront1'}}]),deleteJoint(j){this.joints.delete(j);}};
 applySeatedProfile({springBoneManager:manager},'generic');assert.equal(manager.joints.size,1);
});
