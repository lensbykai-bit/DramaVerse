import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const raw = await readFile(new URL('../js/pay.js',import.meta.url),'utf8');
const source = raw.replace(/^import QRCode[^;]+;\n/,'').replace(/import \{[\s\S]*?\} from '[^']+';\n/,'');
function run({hash='#order:token',status='paid',url='https://t.me/+invite',db=true}={}) {
 const nodes = new Map(); const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,style:{},classList:{values:new Set(),add(v){this.values.add(v)},remove(v){this.values.delete(v)}},addEventListener(){},removeAttribute(k){delete this[k]}}); return nodes.get(id)};
 const client={rpc:async()=>({data:{order_id:'order',status,watch_url:url,amount_khr:2000}}),from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null})})})})};
 vm.runInNewContext(source,{window:{dvSupabase:db?client:null},document:{getElementById:node},location:{hash},URL,Intl,Date,console,setInterval:()=>1,clearInterval(){},setTimeout(){},navigator:{clipboard:{writeText:async()=>{}}}});
 return {node,settle:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('missing backend shows error and hides checkout',()=>{const r=run({db:false});assert.equal(r.node('checkout').hidden,true);assert.match(r.node('errorBox').textContent,/Supabase/)});
test('malformed encoded payment token is handled',()=>{const r=run({hash:'#%ZZ'});assert.equal(r.node('checkout').hidden,true);assert.match(r.node('errorBox').textContent,/link/)});
test('paid order exposes only an https Telegram link',async()=>{const r=run();await r.settle();assert.equal(r.node('watchBtn').href,'https://t.me/+invite');assert.equal(r.node('watchBtn').classList.values.has('show'),true)});
test('paid order cannot expose javascript or unrelated URLs',async()=>{for(const url of ['javascript:alert(1)','https://example.com/invite','https://t.me.evil.example/invite']){const r=run({url});await r.settle();assert.equal(r.node('watchBtn').href,undefined);assert.equal(r.node('watchBtn').classList.values.has('show'),false)}});
test('pending order does not expose a Telegram link',async()=>{const r=run({status:'pending'});await r.settle();assert.equal(r.node('watchBtn').href,undefined)});
