const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const STORAGE_KEY = 'galactus-pwa-foundation-conversations-v1';
let messages = loadMessages();
let attachment = null;
let deferredInstallPrompt = null;
function loadMessages(){ try { const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); return Array.isArray(value)?value:[]; } catch { return []; } }
function saveMessages(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { alert('Browser storage is full or unavailable. Export your conversations before continuing.'); } }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function renderMessages(){ const root=$('#messages'); root.innerHTML=messages.map(m=>`<div class="message ${m.role==='user'?'user':'assistant'}">${m.role==='assistant'?'<div class="avatar">G</div>':''}<div class="bubble">${escapeHtml(m.text)}</div>${m.role==='user'?'<div class="avatar">U</div>':''}</div>`).join(''); $('#welcome').style.display=messages.length?'none':''; $('#chatScroll').scrollTop=$('#chatScroll').scrollHeight; }
function addMessage(role,text){ messages.push({role,text,at:new Date().toISOString()}); saveMessages(); renderMessages(); }
function navigate(view){ $$('.view').forEach(el=>el.classList.toggle('active',el.id===`view-${view}`)); $$('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.view===view)); const titles={chat:'Conversation',models:'Model manager',memory:'Memory manager',security:'Security & privacy',diagnostics:'Diagnostics'}; $('#topTitle').textContent=titles[view]||'GALACTUS'; $('#sidebar').classList.remove('open'); }
$$('.nav-item').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));
$('#menuToggle').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
$('#newChat').addEventListener('click',()=>{messages=[];saveMessages();renderMessages();navigate('chat');$('#promptInput').focus();});
let requestInFlight = false;
async function submitPrompt(text){
  const clean=text.trim(); if((!clean&&!attachment)||requestInFlight)return;
  let body=clean; if(attachment)body+=(body?'\n\n':'')+'[Selected image: '+attachment.name+']';
  addMessage('user',body); attachment=null; $('#attachmentPreview').hidden=true; $('#attachmentPreview').textContent=''; $('#promptInput').value=''; resizeInput();
  const history = messages.filter(m=>m.role==='user'||m.role==='assistant').map(m=>({role:m.role,content:m.text}));
  const pending={role:'assistant',text:'Connecting to the configured AI backend…',at:new Date().toISOString(),pending:true};
  messages.push(pending); saveMessages(); renderMessages(); requestInFlight=true; $('#voiceStatus').textContent='AI request in progress…';
  try { const reply=await window.GalactusRuntime.chat(history,'auto'); const index=messages.indexOf(pending); if(index>=0)messages[index]={role:'assistant',text:reply,at:new Date().toISOString()}; }
  catch(error){ const index=messages.indexOf(pending); const message='AI request failed: '+error.message+' No answer was fabricated.'; if(index>=0)messages[index]={role:'assistant',text:message,at:new Date().toISOString()}; }
  finally { requestInFlight=false; saveMessages(); renderMessages(); $('#voiceStatus').textContent='Enter to send · Shift+Enter for a new line'; }
}
$('#chatForm').addEventListener('submit',e=>{e.preventDefault();submitPrompt($('#promptInput').value);});
$('#promptInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#chatForm').requestSubmit();}});
$('#promptInput').addEventListener('input',resizeInput);
function resizeInput(){const el=$('#promptInput');el.style.height='auto';el.style.height=Math.min(el.scrollHeight,160)+'px';}
$$('.suggestion').forEach(b=>b.addEventListener('click',()=>{navigate('chat');$('#promptInput').value=b.dataset.prompt;resizeInput();$('#promptInput').focus();}));
$('#attachBtn').addEventListener('click',()=>$('#imageInput').click());
$('#imageInput').addEventListener('change',e=>{const file=e.target.files&&e.target.files[0];if(!file)return;attachment={name:file.name,type:file.type};$('#attachmentPreview').textContent=`Selected: ${file.name} — image analysis is not connected.`;$('#attachmentPreview').hidden=false;e.target.value='';});
$('#voiceBtn').addEventListener('click',()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){$('#voiceStatus').textContent='Speech recognition is not supported by this browser.';return;}try{const rec=new SR();rec.lang=navigator.language||'en-US';rec.interimResults=false;$('#voiceStatus').textContent='Listening… grant microphone permission if asked.';rec.onresult=e=>{$('#promptInput').value=e.results[0][0].transcript;resizeInput();$('#voiceStatus').textContent='Speech captured. Review before sending.';};rec.onerror=e=>{$('#voiceStatus').textContent='Voice input unavailable: '+e.error;};rec.onend=()=>{if($('#voiceStatus').textContent==='Listening… grant microphone permission if asked.')$('#voiceStatus').textContent='Enter to send · Shift+Enter for a new line';};rec.start();}catch{$('#voiceStatus').textContent='Could not start speech recognition in this browser.';}});
$('#exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),messages},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='galactus-pwa-conversations.json';a.click();URL.revokeObjectURL(url);});
$('#clearBtn').addEventListener('click',()=>{if(confirm('Delete all locally saved GALACTUS PWA conversation history from this browser?')){messages=[];saveMessages();renderMessages();}});
function setRuntimeStatus(text, good=false){const el=$('#runtimeStatus');if(el){el.textContent=text;el.classList.toggle('good',good);}}
const backendInput=$('#backendUrl');
if(backendInput){backendInput.value=window.GalactusRuntime.readBaseUrl();}
$('#saveBackendBtn')?.addEventListener('click',()=>{try{const value=window.GalactusRuntime.saveBaseUrl(backendInput.value);backendInput.value=value;setRuntimeStatus(value?'Backend URL saved in this browser. Connection is not yet verified.':'Backend URL cleared. AI requests are disabled.',false);}catch(error){setRuntimeStatus(error.message,false);}});
$('#testBackendBtn')?.addEventListener('click',async()=>{try{setRuntimeStatus('Testing /api/health…');const result=await window.GalactusRuntime.health();setRuntimeStatus('Connected. Backend health check passed'+(result.name?' ('+result.name+')':'')+'.',true);}catch(error){setRuntimeStatus('Connection failed: '+error.message,false);}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;$('#installBtn').hidden=false;});
$('#installBtn').addEventListener('click',async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$('#installBtn').hidden=true;});
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
renderMessages();


const runDiagnosticsBtn=$('#runDiagnosticsBtn');
runDiagnosticsBtn?.addEventListener('click',async()=>{
  const results=$('#diagnosticsResults'); const summary=$('#diagnosticsSummary');
  if(!results||!summary)return;
  runDiagnosticsBtn.disabled=true; runDiagnosticsBtn.textContent='Running…';
  results.innerHTML=''; summary.textContent='Running browser-side checks…';
  const checks=[];
  const add=(name,ok,detail)=>checks.push({name,ok:!!ok,detail:String(detail)});
  try {
    const response=await fetch('./manifest.webmanifest',{cache:'no-store'});
    if(!response.ok) throw new Error('HTTP '+response.status);
    const manifest=await response.json();
    add('Manifest loads',!!manifest.start_url&&manifest.display==='standalone','display='+String(manifest.display||'missing'));
  } catch(e) { add('Manifest loads',false,e.message||'Unable to load manifest'); }
  try {
    const key='galactus-pwa-diagnostic-test'; localStorage.setItem(key,'ok');
    const ok=localStorage.getItem(key)==='ok'; localStorage.removeItem(key);
    add('Local storage',ok,ok?'Temporary test value saved and removed':'Storage read-back failed');
  } catch(e) { add('Local storage',false,e.message||'Storage unavailable'); }
  add('Secure context',window.isSecureContext===true,window.isSecureContext?'HTTPS/secure context':'Browser does not report a secure context');
  if(!('serviceWorker' in navigator)) add('Service worker support',false,'This browser does not expose service workers');
  else {
    try {
      const registration=await navigator.serviceWorker.getRegistration();
      add('Service worker registered',!!registration,registration?'Registration found':'No registration found yet; reload after first visit');
      if('caches' in window) {
        const cacheNames=await caches.keys();
        // The service worker was bumped to 0.8.1, so do not look only for the old 0.8 name.
        const appCaches=cacheNames.filter(n=>n.startsWith('galactus-pwa-build-'));
        let shell=false;
        let matchedCache='';
        for (const cacheName of appCaches) {
          const cache=await caches.open(cacheName);
          const cachedIndex=await cache.match('./index.html') || await cache.match(new URL('./index.html', document.baseURI).href) || await cache.match(new URL('./', document.baseURI).href);
          if(cachedIndex){shell=true;matchedCache=cacheName;break;}
        }
        add('App shell cache',shell,shell?`App shell found in ${matchedCache}`:appCaches.length?'App cache exists, but index.html was not found. Keep the page online, reload once, then rerun.':'No GALACTUS app cache found. Keep the page online and reload once to activate caching.');
      } else add('Cache API',false,'Cache API unavailable');
    } catch(e) { add('Service worker/cache',false,e.message||'Unable to inspect service worker'); }
  }
  const baseUrl=window.GalactusRuntime?.readBaseUrl?.()||'';
  add('AI backend configured',!!baseUrl,baseUrl?'A backend URL is saved; connection must be tested separately':'No backend URL saved; real AI chat is not connected');
  results.innerHTML=checks.map(c=>`<div class="diagnostic-row"><span class="diagnostic-badge ${c.ok?'pass':'fail'}">${c.ok?'PASS':'CHECK'}</span><div><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.detail)}</small></div></div>`).join('');
  const passed=checks.filter(c=>c.ok).length;
  summary.textContent=`${passed}/${checks.length} checks passed. CHECK items need review; this is not a real-model inference test.`;
  summary.classList.toggle('good',passed===checks.length);
  runDiagnosticsBtn.disabled=false; runDiagnosticsBtn.textContent='Run self-tests again';
});
