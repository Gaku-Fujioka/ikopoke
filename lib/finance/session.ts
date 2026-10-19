import {redirect} from 'next/navigation';
import {connection} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {hasEnvVars} from '@/lib/utils';
import {FinanceError} from '@/lib/finance/repository';
export async function financeSession(path='/app/finance'){
 // Personal pages must start after a request, including builds without provider settings.
 await connection();
 if(!hasEnvVars)throw new FinanceError('PGRST202');
 const client=await createClient(),auth=await client.auth.getClaims();
 if(auth.error||!auth.data?.claims?.sub)redirect('/auth/login?next='+encodeURIComponent(path));return client;
}
