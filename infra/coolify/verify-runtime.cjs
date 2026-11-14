const assert=require('node:assert/strict'), https=require('node:https'), crypto=require('node:crypto');
const base='http://127.0.0.1:3001';const origin=process.env.WEB_ORIGIN.split(',')[0].trim();
function cookies(response){const all=response.headers.getSetCookie().map(v=>v.split(';')[0]);return {all:all.join('; '),tool:all.filter(v=>v.startsWith('__Secure-admin_session=')).join('; ')};}
async function login(){const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})});assert.equal(r.status,200,'login');return cookies(r);}
const request=(host,path,cookie)=>new Promise((resolve,reject)=>{https.get({hostname:'nginx',servername:host,path,headers:{Host:host,Cookie:cookie}},res=>{let body='';res.on('data',v=>body+=v);res.on('end',()=>resolve({status:res.statusCode,body}));}).on('error',reject);});
async function ws(host,path,cookie){return new Promise((resolve,reject)=>{const req=https.request({hostname:'nginx',servername:host,path,headers:{Host:host,Origin:'https://'+host,Cookie:cookie,Upgrade:'websocket',Connection:'Upgrade','Sec-WebSocket-Version':'13','Sec-WebSocket-Key':crypto.randomBytes(16).toString('base64')}});req.setTimeout(10000,()=>req.destroy(Error('upgrade timeout')));req.on('upgrade',(res,socket)=>{socket.on('error',()=>{});assert.equal(res.statusCode,101);resolve(socket)});req.on('response',res=>{res.resume();reject(Error(host+' upgrade HTTP '+res.statusCode));});req.on('error',reject);req.end();});}
async function chat(c){const page=await request('chat.vitorsierro.com','/',c.tool);assert.equal(page.status,200,'dashboard');const token=JSON.parse(page.body.match(/window\.__HERMES_SESSION_TOKEN__\s*=\s*("[^"]+")/)[1]);return ws('chat.vitorsierro.com','/api/events?channel=logout-smoke&token='+encodeURIComponent(token),c.tool);}
const logout=c=>fetch(base+'/auth/logout',{method:'POST',headers:{Origin:origin,Cookie:c.all}});
const closed=socket=>new Promise((resolve,reject)=>{if(socket.destroyed)return resolve();const timer=setTimeout(()=>reject(Error('socket permaneceu aberto após logout')),1500);socket.once('close',()=>{clearTimeout(timer);resolve();});});
(async()=>{let a,b;const sockets=[];let timer;try{
 a=await login();b=await login();
 const first=await chat(a), draw=await ws('draw.vitorsierro.com','/socket.io/?EIO=4&transport=websocket',a.tool), other=await chat(b);sockets.push(first,draw,other);
 let traffic=0;first.on('data',()=>traffic++);const ping=Buffer.from([0x89,0x80,1,2,3,4]);timer=setInterval(()=>{for(const s of sockets)if(!s.destroyed)s.write(ping)},40);
 await new Promise(r=>setTimeout(r,150));assert.ok(traffic>0,'canal ativo');
 const refresh=await fetch(base+'/auth/refresh',{method:'POST',headers:{Origin:origin,Cookie:a.all}});assert.equal(refresh.status,200);a=cookies(refresh);
 await new Promise(r=>setTimeout(r,650));assert.equal(first.destroyed,false,'refresh preserva o socket');
 const finished=Promise.all([closed(first),closed(draw)]);const started=Date.now();assert.equal((await logout(a)).status,200);await finished;
 assert.equal(other.destroyed,false,'outra sessão permanece conectada');
 console.log('PASS: logout encerrou Hermes e colaboração ativos em '+(Date.now()-started)+' ms; refresh e outra sessão preservados');
 assert.equal((await request('api.vitorsierro.com','/auth/socket-events','')).status,404,'stream não publicado');
 for(const p of ['jest','@nestjs/cli','deepmerge']){let found=false;try{require.resolve(p);found=true;}catch{}assert.equal(found,false,p+' fora do runtime');}
 console.log('PASS: ferramentas de desenvolvimento ausentes da imagem de produção');
 }finally{clearInterval(timer);for(const s of sockets)s.destroy();if(a)await logout(a);if(b)await logout(b);}
})().catch(error=>{console.error(error.message);process.exitCode=1});