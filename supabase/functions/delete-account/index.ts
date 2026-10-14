import { createClient } from 'npm:@supabase/supabase-js@2';
import { deleteAccount, type DeleteAccountDeps } from '../_vendor/backend/src/account.ts';

const PAGE_SIZE = 1000;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return new Response('Unauthorized', { status: 401 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return new Response('Unauthorized', { status: 401 });

  const bucket = admin.storage.from('items');
  const deps: DeleteAccountDeps = {
    async listObjectPaths(prefix) {
      const walk = async (folder: string): Promise<string[]> => {
        const paths: string[] = [];
        for (let offset = 0; ; offset += PAGE_SIZE) {
          const page = await bucket.list(folder, { limit: PAGE_SIZE, offset });
          if (page.error) throw new Error(page.error.message);
          for (const entry of page.data) {
            const path = `${folder}/${entry.name}`;
            if (entry.id === null) paths.push(...(await walk(path)));
            else paths.push(path);
          }
          if (page.data.length < PAGE_SIZE) break;
        }
        return paths;
      };
      return walk(prefix.replace(/\/$/, ''));
    },
    async removeObjects(paths) {
      const { error: removeError } = await bucket.remove(paths);
      if (removeError) throw new Error(removeError.message);
    },
    async deleteAuthUser(userId) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      if (deleteError) throw new Error(deleteError.message);
    },
  };

  try {
    await deleteAccount(data.user.id, deps);
    return new Response(null, { status: 204 });
  } catch (e) {
    console.error('delete-account failed', e);
    return Response.json({ error: 'delete_failed' }, { status: 500 });
  }
});
