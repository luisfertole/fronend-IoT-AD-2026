import test from 'node:test';import assert from 'node:assert/strict';
import {recordingIssue} from '../src/features/voice/microphone.js';
test('grabaciones sin señal o demasiado cortas se explican antes de enviar',()=>{
 assert.match(recordingIssue({durationMs:100,measured:true,peak:0.5}),/corta/);
 assert.match(recordingIssue({durationMs:1500,measured:true,peak:0}),/señal/);
 assert.equal(recordingIssue({durationMs:1500,measured:true,peak:0.02}),'');
});
test('sin medición no supone silencio ni bloquea el audio',()=>{
 assert.equal(recordingIssue(null),'');assert.equal(recordingIssue({durationMs:1500,measured:false,peak:0}),'');
});
