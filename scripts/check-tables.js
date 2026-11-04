import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const lines = fs.readFileSync(envPath,'utf8').split('\n');
for(const line of lines){
  const trimmed=line.trim();
  if(!trimmed||trimmed.startsWith('#')) continue;
  const eq=trimmed.indexOf('=');
  if(eq<0) continue;
  const key=trimmed.slice(0,eq).trim();
  let val=trimmed.slice(eq+1).trim();
  if(val.startsWith('"')&&val.endsWith('"')) val=val.slice(1,-1);
  if(!process.env[key]) process.env[key]=val;
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function check(){
  const {data, error}= await supabase.from('menu_categories').select('id', {limit:1});
  console.log('menu_categories check', error?error.message:'ok', data);
  const {data: d2, error: e2}= await supabase.from('restaurant_settings').select('id', {limit:1});
  console.log('restaurant_settings check', e2?e2.message:'ok', d2);
}
check();

