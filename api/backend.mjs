import { backendGateway } from '../server/backend-gateway.mjs';
export default function handler(req, res) { return backendGateway(req, res); }
