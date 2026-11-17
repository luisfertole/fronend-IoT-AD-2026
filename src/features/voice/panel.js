import { isStop,stopIntent,intentSteps,describeAction,activeDemos,MAX_RECORDING_SECONDS } from './contract.js';
import { executeIntent } from './executor.js';
import { monitorMicrophone, recordingIssue } from './microphone.js';
export function mountVoice(ctl,{canMove,notify=()=>{},getDemos=()=>[],getSelectedDemo=()=>null}) {
  const $=id=>document.getElementById(id),dialog=$('voice-dialog');
  let ready=false,busy=false,opening=false,sequence=0,capture=null,request,execution,previewUrl;
  const status=(text,error=false)=>{$('voice-result').textContent=text;$('voice-result').classList.toggle('err',error);};
  const clearTranscript=()=>{$('voice-transcript').textContent='';$('voice-plan').replaceChildren();$('voice-plan').hidden=true;};
  function renderPlan(intent,demos){
    const list=$('voice-plan');list.replaceChildren();list.hidden=!['sequence','demo'].includes(intent.kind);
    if(list.hidden)return;
    intentSteps(intent).forEach(action=>{const row=document.createElement('li');row.textContent=describeAction(action,demos);list.append(row);});
  }
  function cancelPlan(){for(const row of $('voice-plan').children)if(row.dataset.state!=='done')row.dataset.state='cancelled';}
  function buttons(){
    $('voice-send').disabled=busy||opening||Boolean(capture)||!ready;
    $('voice-record').disabled=busy||opening||!ready;
    $('voice-record').textContent=capture?'■ Terminar y enviar':opening?'Abriendo micrófono…':'● Grabar voz';
    $('voice-record').classList.toggle('recording',Boolean(capture));
    $('voice-mic').disabled=busy||opening||Boolean(capture);
  }
  function clearPreview(){const audio=$('voice-playback');audio.pause();audio.removeAttribute('src');audio.hidden=true;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;}
  function preview(blob){clearPreview();previewUrl=URL.createObjectURL(blob);$('voice-playback').src=previewUrl;$('voice-playback').hidden=false;}
  async function microphones(){
    if(!navigator.mediaDevices?.enumerateDevices)return;
    try {
      const selected=$('voice-mic').value,devices=await navigator.mediaDevices.enumerateDevices();
      const inputs=devices.filter(device=>device.kind==='audioinput'&&device.deviceId&&device.deviceId!=='default');
      $('voice-mic').replaceChildren(new Option('Micrófono predeterminado',''));
      inputs.forEach((device,i)=>$('voice-mic').add(new Option(device.label||'Micrófono '+(i+1),device.deviceId)));
      if(inputs.some(device=>device.deviceId===selected))$('voice-mic').value=selected;
    }catch{/* La entrada predeterminada sigue disponible. */}
  }
  function release(item){
    if(!item)return null;clearTimeout(item.timer);const stats=item.monitor?.stop();item.stream.getTracks().forEach(track=>track.stop());
    if(capture===item)capture=null;
    $('voice-level').value=0;return stats;
  }
  function cancel(){
    if(busy||opening||capture)status('Solicitud cancelada.');sequence++;request?.abort();execution?.abort();cancelPlan();opening=false;busy=false;
    const item=capture;if(item?.recorder.state==='recording')item.recorder.stop();release(item);$('voice-level-text').textContent='Micrófono en reposo';buttons();
  }
  async function remote(body,signal){
    const response=await fetch('/api/voice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,selected_demo_id:Number(getSelectedDemo())||null}),signal,cache:'no-store'});
    const data=await response.json().catch(()=>null);
    if(!response.ok){const error=Error(data?.detail||'No se pudo interpretar la instrucción.');error.transcript=data?.transcript;throw error;}
    return data;
  }
  async function submit(body){
    if(busy)return;busy=true;clearTranscript();buttons();
    const id=++sequence,epoch=ctl.paradas,intention=ctl.intencion;
    request=new AbortController();let heard='';const timeout=setTimeout(()=>request.abort(),26000);status(body.audio?'Transcribiendo tu grabación…':'Interpretando tu instrucción…');
    try {
      const data=body.text&&isStop(body.text)?{transcript:body.text,intent:stopIntent()}:await remote(body,request.signal);
      clearTimeout(timeout);if(id!==sequence)return;
      if(epoch!==ctl.paradas||intention!==ctl.intencion){status('Se descartó la instrucción porque usaste otro control.');return;}
      heard=data.transcript||'';$('voice-transcript').textContent='Entendido: '+heard;
      const demos=activeDemos(getDemos());renderPlan(data.intent,demos);execution=new AbortController();
      const result=await executeIntent(ctl,data.intent,canMove,{signal:execution.signal,demos,onProgress:({index,total,action,state})=>{
        if(id!==sequence)return;const row=$('voice-plan').children[index];if(row)row.dataset.state=state;
        if(data.intent.kind==='sequence')status('Paso '+(index+1)+' de '+total+' · '+describeAction(action,demos)+(state==='done'?' · completado':''));
      }});
      if(id===sequence){status(result);notify(data.intent.kind==='none'?'evento':'aceptado',result);}
    }catch(error){if(id===sequence){cancelPlan();$('voice-transcript').textContent=(error.transcript||heard)?'Entendido: '+(error.transcript||heard):'';status(error.name==='AbortError'?'La solicitud se canceló o agotó el tiempo de espera.':error.message,true);}}
    finally{clearTimeout(timeout);if(id===sequence){busy=false;buttons();}}
  }
  async function record(){
    if(capture){if(capture.recorder.state==='recording')capture.recorder.stop();return;}
    if(opening||busy)return;
    if(!navigator.mediaDevices?.getUserMedia||!globalThis.MediaRecorder){status('Este navegador no permite grabar audio. Puedes escribir la instrucción.',true);return;}
    const id=++sequence;opening=true;clearTranscript();clearPreview();buttons();status('Solicitando acceso al micrófono… Espera para hablar.');
    let item;
    try {
      const deviceId=$('voice-mic').value;
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,...(deviceId?{deviceId:{exact:deviceId}}:{})}});
      if(id!==sequence){stream.getTracks().forEach(track=>track.stop());return;}
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus','audio/webm'].find(type=>MediaRecorder.isTypeSupported(type));
      item={stream,recorder:null,monitor:null,timer:null};capture=item;
      const recorder=new MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:96000}:{});item.recorder=recorder;
      item.monitor=await monitorMicrophone(stream,({level,seconds})=>{if(capture!==item)return;$('voice-level').value=level;$('voice-level-text').textContent=(level>15?'Recibiendo audio':'Esperando voz')+' · '+seconds.toFixed(1)+' / '+MAX_RECORDING_SECONDS+' s';});
      if(id!==sequence){release(item);return;}
      $('voice-input-name').textContent=stream.getAudioTracks()[0]?.label||'Entrada de audio predeterminada';microphones();
      const chunks=[];let size=0;
      recorder.ondataavailable=event=>{if(event.data.size){chunks.push(event.data);size+=event.data.size;if(size>768*1024&&recorder.state==='recording')recorder.stop();}};
      recorder.onerror=()=>{if(id!==sequence)return;cancel();status('No se pudo grabar el audio. Revisa la entrada o escribe la orden.',true);};
      recorder.onstop=async()=>{
        const stats=release(item);buttons();if(id!==sequence)return;
        $('voice-level-text').textContent='Grabación finalizada';
        if(size>768*1024){status('La grabación es demasiado grande.',true);return;}
        try {
          const blob=new Blob(chunks,{type:recorder.mimeType||mime||'audio/webm'});
          if(!blob.size){status('No se recibió audio. Intenta de nuevo.',true);return;}
          preview(blob);const issue=recordingIssue(stats);if(issue){status(issue,true);return;}
          const reader=new FileReader();const audio=await new Promise((resolve,reject)=>{reader.onerror=reject;reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(blob);});
          if(id===sequence)await submit({audio,mime:blob.type});
        }catch{if(id===sequence)status('No se pudo preparar la grabación.',true);}
      };
      recorder.start(200);opening=false;buttons();status('Escuchando. Habla ahora y pulsa Terminar cuando acabes.');
      item.timer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},MAX_RECORDING_SECONDS*1000);
    }catch(error){release(item);if(id===sequence){opening=false;buttons();status(error.name==='NotAllowedError'?'No se autorizó el micrófono. Puedes escribir la instrucción.':error.name==='NotFoundError'||error.name==='OverconstrainedError'?'No se encontró ese micrófono. Selecciona otra entrada.':'No se pudo abrir el micrófono.',true);}}
  }
  $('voice-open').addEventListener('click',async()=>{
    if(!dialog.open)dialog.show();microphones();
    const demos=activeDemos(getDemos());$('voice-demos').textContent=demos.length?'Demos: '+demos.slice(0,3).map(d=>d.id_demo+' · '+d.nombre).join(' / ')+(demos.length>3?' y más en el selector de la consola.':''):'Las demos aparecerán al cargar el catálogo de la consola.';
    try{const response=await fetch('/api/voice',{cache:'no-store'});const data=await response.json();ready=response.ok&&data.ready===true;status(ready?'Selecciona el micrófono y pulsa Grabar voz. Habla cuando aparezca «Escuchando».':'El servicio de voz aún no está disponible. Consulta la configuración del proyecto.',!ready);}
    catch{ready=false;status('No se pudo conectar con el servicio de voz.',true);}buttons();
  });
  $('voice-form').addEventListener('submit',event=>{event.preventDefault();const text=$('voice-text').value.trim();if(text)submit({text});});
  $('voice-record').addEventListener('click',record);
  $('voice-stop').addEventListener('click',()=>{cancel();ctl.detener();status('DETENER solicitado.');});
  const close=()=>{cancel();clearPreview();dialog.close();if(ctl.ocupado)ctl.detener();};
  $('voice-close').addEventListener('click',close);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&dialog.open){event.preventDefault();close();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});window.addEventListener('pagehide',()=>{cancel();clearPreview();});
  buttons();return {cancel};
}
