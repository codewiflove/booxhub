'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth, homePathFor } from './auth-provider';
import type { Role } from '@/lib/types';

export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const allowed = !!profile && profile.status === 'approved' && roles.includes(profile.role);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/login');
    else if (!allowed) router.replace(homePathFor(profile));
  }, [loading, session, allowed, profile, router]);

  if (loading || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-ocean-600" />
      </div>
    );
  }
  return <>{children}</>;
}
