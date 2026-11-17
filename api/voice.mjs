import { voiceGateway } from '../server/voice-gateway.mjs';
export default function handler(req,res){return voiceGateway(req,res);}
