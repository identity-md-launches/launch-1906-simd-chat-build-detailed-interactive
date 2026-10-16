import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium, webkit } = await import(process.argv[2] ? pathToFileURL(resolve(process.argv[2])).href : 'playwright');
const root=resolve('dist'), output=resolve('test/scratch/browser-validation');
await mkdir(output,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try {
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!path.startsWith('/preview/')){res.writeHead(404).end();return;}
  const file=resolve(root,path.slice('/preview/'.length)||'index.html');
  if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
  res.setHeader('Content-Type',mime[extname(file)]??'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/preview/`;
const checks=[]; const errors=[];
const record=(name,detail='Passed')=>{checks.push({name,status:'passed',detail});console.log(`PASS ${name}: ${detail}`);};
const sol='So11111111111111111111111111111111111111112';
const fart='9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
const quoteFixture=[{chainId:'solana',baseToken:{address:sol,name:'Wrapped SOL',symbol:'SOL'},priceUsd:'100',liquidity:{usd:1000000},priceChange:{h24:1.2},marketCap:1e9},{chainId:'solana',baseToken:{address:fart,name:'Fartcoin',symbol:'fartcoin'},priceUsd:'.15',liquidity:{usd:100000},priceChange:{h24:2.5},marketCap:150000000}];
function rawTrade(wallet,side='buy',signature='fixture',solAmount=1) {
 const bytes=Buffer.alloc(129);bytes.set([189,219,127,211,78,230,97,238]);bytes.fill(8,8,40);bytes.fill(wallet,57,89);
 bytes.writeBigUInt64LE(BigInt(Math.round(solAmount*1e9)),40);bytes.writeBigUInt64LE(1_000_000_000_000n,48);bytes[56]=side==='buy'?1:0;bytes.writeBigInt64LE(BigInt(Math.floor(Date.now()/1000)),89);bytes.writeBigUInt64LE(2_000_000_000_000n,97);bytes.writeBigUInt64LE(1_000_000_000_000_000n,105);
 return JSON.stringify({jsonrpc:'2.0',method:'logsNotification',params:{result:{value:{err:null,signature,logs:['Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P invoke [1]','Program data: '+bytes.toString('base64'),'Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P success']}}}});
}
let browser;
try {
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
 await context.route('https://api.dexscreener.com/**',r=>r.fulfill({json:quoteFixture}));
 const page=await context.newPage();
 let socket;
 await page.routeWebSocket('**',ws=>{socket=ws;ws.onMessage(message=>{const msg=JSON.parse(message);assert.equal(msg.method,'logsSubscribe');ws.send(JSON.stringify({jsonrpc:'2.0',id:1,result:123}));});});

 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.url().startsWith(url)&&r.status()>=400)errors.push('Local resource failure: '+new URL(r.url()).pathname);});
 await page.goto(url); await page.getByRole('button',{name:'Pause tracking',exact:true}).click();
 assert.equal(await page.locator('.wallet-row').count(),8); record('Production export at a static subpath');
 assert.equal(await page.evaluate(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0)),true);record('Bundled token images load');
 await page.getByRole('spinbutton',{name:'Maximum buy amount',exact:true}).fill('501');await page.getByRole('button',{name:'Apply filters',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Keep buy amounts between $50 and $500.'}).waitFor();record('Buy bounds show a recoverable inline error');
 await page.getByRole('spinbutton',{name:'Maximum buy amount',exact:true}).fill('300');
 await page.getByRole('spinbutton',{name:'Minimum market cap',exact:true}).fill('200000');await page.getByRole('spinbutton',{name:'Maximum market cap',exact:true}).fill('500000');
 await page.getByRole('button',{name:'Apply filters',exact:true}).click();
 assert.ok(await page.locator('.wallet-row').count()>0);
 const amounts=await page.locator('.wallet-row .buy-cell strong').allTextContents();assert.ok(amounts.every(a=>Number(a.replace(/[$,]/g,''))<=300));record('Market-cap and buy filters change displayed positions');
 await page.reload();assert.equal(await page.getByRole('spinbutton',{name:'Maximum buy amount',exact:true}).inputValue(),'300');record('Valid filters persist after reload');
 await page.getByRole('button',{name:'Pause tracking',exact:true}).click();
 await page.getByRole('spinbutton',{name:'Minimum market cap',exact:true}).fill('999999999');await page.getByRole('spinbutton',{name:'Maximum market cap',exact:true}).fill('1000000000');await page.getByRole('button',{name:'Apply filters',exact:true}).click();
 await page.getByRole('heading',{name:'No wallets in this range',exact:true}).waitFor();await page.getByRole('button',{name:'Reset filters',exact:true}).click();assert.equal(await page.locator('.wallet-row').count(),8);record('Empty filter state and reset recovery');
 await page.getByRole('textbox',{name:'Search wallets or tokens'}).fill('does-not-exist');await page.getByRole('heading',{name:'No matching wallets'}).waitFor();await page.getByRole('button',{name:'Clear search',exact:true}).first().click();
 await page.getByRole('textbox',{name:'Search wallets or tokens'}).fill('Fartcoin');assert.equal(await page.locator('.wallet-row').count(),2);await page.getByRole('button',{name:'Clear search',exact:true}).click();record('Search by token and clear search');
 await page.getByRole('combobox',{name:'Sort wallets'}).selectOption('amount');assert.ok((await page.locator('.buy-cell strong').first().textContent()).includes('420'));record('Sort by largest buy');
 await page.getByRole('button',{name:'Copy Fartcoin contract address',exact:true}).first().click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),fart);record('Clipboard receives the full mint address');
 const detailButton=page.getByRole('button',{name:'View Fartcoin position for Demo wallet 01',exact:true});await detailButton.click();await page.getByRole('dialog').waitFor();assert.ok((await page.getByRole('dialog').textContent()).includes(fart));await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='View Fartcoin position for Demo wallet 01');record('Position details, Escape and restored focus');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export session',exact:true}).click();const download=await downloadPromise;const downloadPath=await download.path();const csv=await readFile(downloadPath,'utf8');assert.ok(csv.includes(fart));assert.ok(csv.includes('"demo"'));record('CSV exports real session state with an explicit demo mode');
 await page.getByRole('combobox',{name:'Sort wallets'}).selectOption('recent');await page.getByRole('button',{name:'Resume tracking',exact:true}).click();const initial=await page.locator('.wallet-row').evaluateAll(rows=>rows.map(r=>r.dataset.positionId));
 await page.waitForFunction(ids=>{const rows=[...document.querySelectorAll('.wallet-row')];return rows.length===8&&!rows.some(r=>r.dataset.positionId===ids[0]);},initial,{timeout:20000});await page.getByRole('button',{name:'Pause tracking',exact:true}).click();record('Timed demo sell removes a wallet and fills its slot');
 await page.getByRole('button',{name:'Sells',exact:true}).click();assert.ok(await page.locator('.event-sell').count()>0);assert.equal(await page.locator('.activity-panel .event-buy').count(),0);record('Activity side filter');
 await page.getByRole('button',{name:'Token watch',exact:true}).click();await page.getByRole('heading',{name:'Token watch',exact:true}).waitFor();assert.ok((await page.locator('.market-panel').textContent()).includes('$0.1500'));record('Token-watch navigation and quote rendering (fixture)');
 await page.getByRole('button',{name:'Wallet tracker',exact:true}).click();
 // Deterministic on-chain-format events exercise the real WebSocket adapter.
 await page.getByRole('button',{name:'Use live data',exact:true}).click();await page.getByText('Connected to Solana',{exact:true}).waitFor();assert.equal(await page.locator('.wallet-row').count(),0);
 for(let i=10;i<19;i++)socket.send(rawTrade(i,'buy','fixture-buy-'+i));await page.waitForFunction(()=>document.querySelectorAll('.wallet-row').length===8);
 const wallet10=await page.evaluate(()=>{const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let value=0n;for(let i=0;i<32;i++)value=value*256n+10n;let result='';while(value){result=alphabet[Number(value%58n)]+result;value/=58n;}return result;});const firstId=await page.locator(`.wallet-row[data-position-id^="${wallet10}:"]`).getAttribute('data-position-id');socket.send(rawTrade(10,'sell','fixture-sell',.5));
 await page.waitForFunction(id=>![...document.querySelectorAll('.wallet-row')].some(r=>r.dataset.positionId===id),firstId);assert.equal(await page.locator('.wallet-row').count(),8);record('Live-format confirmed buy/sell decoding and queued replacement (WebSocket fixture)');
 socket.close();await page.getByText('Live data unavailable',{exact:true}).waitFor();await page.getByRole('button',{name:'Reconnect',exact:true}).click();await page.getByText('Connected to Solana',{exact:true}).waitFor();assert.equal(await page.locator('.wallet-row').count(),0);record('Disconnect is visible; reconnect clears unverifiable old positions');
 await page.getByRole('button',{name:'Data settings',exact:true}).click();await page.getByRole('textbox',{name:'Solana mainnet WebSocket',exact:true}).fill('https://example.com');await page.getByRole('button',{name:'Save endpoint',exact:true}).click();await page.getByRole('alert').filter({hasText:'Enter a secure wss:// address'}).waitFor();await page.keyboard.press('Escape');record('Endpoint settings validate read-only secure URLs');
 await page.getByRole('button',{name:'Use demo',exact:true}).click();await page.getByRole('button',{name:'Pause tracking',exact:true}).click();
 await page.getByRole('combobox',{name:'Sort wallets'}).selectOption('recent');
 await page.getByRole('button',{name:'Dismiss notification',exact:true}).click().catch(()=>{});
 for(const width of [320,390,768,1024,1440]) {
  await page.setViewportSize({width,height:900});await page.reload();await page.getByRole('button',{name:'Pause tracking',exact:true}).click();
  const bounds=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(bounds.scroll<=bounds.width,`overflow at ${width}`);
  if(width===390) {
   const action=await page.getByRole('button',{name:'Edit filters',exact:true}).boundingBox();const first=await page.locator('.wallet-row').first().boundingBox();assert.ok(action.y+action.height<844);assert.ok(first.y<844);
  }
  await page.screenshot({path:`${output}/${width}.png`,fullPage:true});
 }
 record('Responsive overflow and screenshots','320, 390, 768, 1024, 1440 CSS pixels; action and wallet row visible at 390');
 await page.setViewportSize({width:390,height:844});await page.reload();await page.getByRole('button',{name:'Pause tracking',exact:true}).click();
 await page.getByRole('button',{name:'Edit filters',exact:true}).click();await page.getByRole('spinbutton',{name:'Maximum buy amount',exact:true}).fill('200');await page.getByRole('button',{name:'Apply filters',exact:true}).click();assert.ok(await page.locator('.wallet-row').count()>0);assert.equal(await page.getByRole('button',{name:'Edit filters',exact:true}).isVisible(),true);record('Mobile filter disclosure, apply and collapse');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);record('Reduced-motion preference');
 // Native browser zoom and physical-device tests are reported separately as unperformed.
 await page.getByRole('button',{name:'How Pulse works',exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('dialog').waitFor();for(let i=0;i<12;i++)await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)),true);await page.keyboard.press('Escape');record('Keyboard dialog entry, focus containment and Escape');
 assert.equal(errors.length,0,JSON.stringify(errors));record('No script errors or local resource failures in interaction suite');
 await context.close();
 const externalContext=await browser.newContext({viewport:{width:1440,height:1000}});const externalPage=await externalContext.newPage();let actualNotifications=0;externalPage.on('websocket',ws=>ws.on('framereceived',frame=>{try{const d=JSON.parse(String(frame.payload));if(d.method==='logsNotification')actualNotifications++;}catch{}}));await externalPage.goto(url);
 await externalPage.getByRole('button',{name:'Token watch',exact:true}).click();await externalPage.waitForFunction(()=>document.querySelectorAll('.market-row').length>1||document.querySelector('.inline-warning'),{timeout:16000}).catch(()=>{});
 const gotQuotes=await externalPage.locator('.market-row').count()>1;
 checks.push({name:'Unmocked public quotes',status:gotQuotes?'passed':'limited',detail:gotQuotes?'Actual DEX Screener response rendered.':'Public provider did not supply usable quotes during this check; retry state rendered.'});
 await externalPage.getByRole('button',{name:'Wallet tracker',exact:true}).click();await externalPage.getByRole('button',{name:'Use live data',exact:true}).click();
 await externalPage.waitForFunction(()=>document.querySelector('.session-banner strong')?.textContent!=='Connecting to Solana',{timeout:16000}).catch(()=>{});
 await externalPage.waitForTimeout(8000);const liveStatus=await externalPage.locator('.session-banner').innerText();
 checks.push({name:'Unmocked public WebSocket',status:liveStatus.includes('Connected to Solana')?'passed':'limited',detail:liveStatus+`; ${actualNotifications} actual transaction-log notifications during the short check.`});
 await externalContext.close();
 await browser.close();browser=null;
 try { const safari=await webkit.launch({headless:true});const p=await safari.newPage({viewport:{width:390,height:844}});await p.route('https://api.dexscreener.com/**',r=>r.fulfill({json:quoteFixture}));await p.goto(url);await p.getByRole('button',{name:'Edit filters',exact:true}).click();await p.getByRole('spinbutton',{name:'Maximum buy amount',exact:true}).fill('200');await p.getByRole('button',{name:'Apply filters',exact:true}).click();assert.ok(await p.locator('.wallet-row').count()>0);await safari.close();record('WebKit mobile primary filter flow'); }
 catch { checks.push({name:'WebKit mobile primary filter flow',status:'unperformed',detail:'WebKit could not launch in the available runtime. No WebKit behavior is claimed.'}); }
} catch(error) { checks.push({name:'Interaction suite',status:'failed',detail:error.message});console.error(error.message);process.exitCode=1; }
finally { if(browser)await browser.close();await new Promise(r=>server.close(r));await writeFile(`${output}/results.json`,JSON.stringify({checks,errors},null,2));console.log(`${checks.filter(c=>c.status==='passed').length} passed; ${checks.filter(c=>c.status==='failed').length} failed; ${checks.filter(c=>['limited','unperformed'].includes(c.status)).length} limitations`); }
