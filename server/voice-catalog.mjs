import { activeDemos } from '../src/features/voice/contract.js';
export async function loadVoiceDemos({env=process.env,fetcher=fetch,signal}={}){
  try {
    const vehicle=Number(env.IOT_VEHICLE_ID||1),base=new URL(env.IOT_API_BASE||'https://iot-vehiculos.duckdns.org');
    if(!Number.isSafeInteger(vehicle)||vehicle<1||!['https:','http:'].includes(base.protocol)||base.username||base.password)return [];
    const timeout=AbortSignal.timeout(2500);
    const response=await fetcher(new URL('/vehiculos/'+vehicle+'/demos',base),{method:'GET',headers:{Accept:'application/json'},redirect:'error',signal:signal?AbortSignal.any([signal,timeout]):timeout});
    if(!response.ok)return [];
    return activeDemos(await response.json());
  }catch{return [];}
}
