import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
export const runtime = 'nodejs';
export async function GET(){
 if(process.env.NODE_ENV !== 'development') return new Response('Not found',{status:404});
 const html=await readFile(join(process.cwd(),'reference','v40-original.html'));
 return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex,nofollow','content-security-policy':"frame-ancestors 'none'"}});
}
