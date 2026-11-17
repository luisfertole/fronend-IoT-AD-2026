export function recordingIssue(stats) {
  if(!stats)return '';
  if(stats.durationMs<350)return 'La grabación fue demasiado corta. Espera a ver «Escuchando», di la orden y pulsa Terminar.';
  if(stats.measured && stats.peak<0.001)return 'No se detectó señal del micrófono. Selecciona otra entrada o revisa si está silenciado. Puedes escuchar la grabación.';
  return '';
}
export async function monitorMicrophone(stream,paint=()=>{}) {
  const started=performance.now();let context,source,analyser,frame,peak=0,measured=false,stopped=false;
  try {
    const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(Audio){
      context=new Audio();await context.resume();
      source=context.createMediaStreamSource(stream);analyser=context.createAnalyser();analyser.fftSize=2048;source.connect(analyser);
      const values=new Float32Array(analyser.fftSize);
      function tick(){
        if(stopped)return;
        analyser.getFloatTimeDomainData(values);let sum=0;
        for(const value of values){peak=Math.max(peak,Math.abs(value));sum+=value*value;}
        const rms=Math.sqrt(sum/values.length),level=Math.max(0,Math.min(100,(20*Math.log10(rms||1e-8)+60)/60*100));
        measured=context.state==='running';paint({level,seconds:(performance.now()-started)/1000});frame=requestAnimationFrame(tick);
      }
      tick();
    }
  }catch{source?.disconnect();analyser?.disconnect();if(context&&context.state!=='closed')context.close().catch(()=>{});context=null;}
  return {stop(){
    if(!stopped){stopped=true;cancelAnimationFrame(frame);source?.disconnect();analyser?.disconnect();if(context&&context.state!=='closed')context.close().catch(()=>{});}
    return {peak,measured,durationMs:performance.now()-started};
  }};
}
