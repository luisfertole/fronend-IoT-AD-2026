import { controlGateway } from '../server/control-gateway.mjs';
export default function handler(req, res) { return controlGateway(req, res); }
