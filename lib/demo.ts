import { supabase } from '@/lib/supabase';

export type DemoRole = 'admin' | 'agent';

export async function fetchDemoEnabled() {
  const { data, error } = await supabase.from('app_settings').select('demo_enabled').eq('id', 1).maybeSingle();
  if (error) {
    console.error('demo setting load failed', error);
    return false;
  }
  return Boolean(data?.demo_enabled);
}

export async function demoSignIn(role: DemoRole) {
  const { data, error } = await supabase.functions.invoke('demo-access', { body: { role } });
  if (error || typeof data?.email !== 'string' || typeof data?.password !== 'string') {
    console.error('demo access failed', error, data);
    let message = 'Akses demo tidak dapat disediakan. Sila cuba lagi.';
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json().catch(() => null);
      if (typeof body?.error === 'string') message = body.error;
    }
    throw new Error(message);
  }
  await supabase.auth.signOut();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });
  if (signInError) {
    console.error('demo sign in failed', signInError);
    throw new Error('Tidak dapat log masuk ke akaun demo. Sila cuba lagi.');
  }
}
