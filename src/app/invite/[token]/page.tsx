'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Mail, Users, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { inviteApi, type Invite } from '@/lib/invite-api';

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params.token);
  const { session, isLoading: authLoading } = useAuth();

  const [invite, setInvite] = useState<Invite | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (authLoading || !session) return;
    setIsFetching(true);
    inviteApi.getInvite(token)
      .then(setInvite)
      .catch((err: any) => setLoadError(err?.message || 'Convite não encontrado ou expirado.'))
      .finally(() => setIsFetching(false));
  }, [authLoading, session, token]);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await inviteApi.acceptInvite(token);
      setAccepted(true);
      setTimeout(() => router.push('/squad'), 1500);
    } catch (err: any) {
      setLoadError(err?.message || 'Não foi possível aceitar o convite.');
    } finally {
      setIsAccepting(false);
    }
  };

  if (authLoading) {
    return <div className="p-8 text-center text-xs font-bold text-slate-400">Carregando...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-[#fafafa] dark:bg-slate-950 p-4">
        <Card className="max-w-sm w-full rounded-3xl shadow-lg">
          <CardHeader className="text-center">
            <Mail className="h-10 w-10 text-indigo-500 mx-auto mb-2" />
            <CardTitle className="text-lg font-black uppercase tracking-tight">Você foi convidado</CardTitle>
            <CardDescription className="text-xs">
              Entre ou crie sua conta pra aceitar o convite e entrar no squad.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            <Button
              onClick={() => router.push(`/login?returnUrl=${encodeURIComponent(`/invite/${token}`)}`)}
              className="h-10 rounded-xl text-xs font-bold"
            >
              Entrar ou criar conta
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#fafafa] dark:bg-slate-950 p-4">
      <Card className="max-w-sm w-full rounded-3xl shadow-lg">
        <CardHeader className="text-center">
          {accepted ? (
            <>
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
              <CardTitle className="text-lg font-black uppercase tracking-tight">Convite aceito!</CardTitle>
              <CardDescription className="text-xs">Redirecionando pro seu squad...</CardDescription>
            </>
          ) : loadError ? (
            <>
              <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-2" />
              <CardTitle className="text-lg font-black uppercase tracking-tight">Convite inválido</CardTitle>
              <CardDescription className="text-xs">{loadError}</CardDescription>
            </>
          ) : isFetching || !invite ? (
            <>
              <Loader2 className="h-10 w-10 text-indigo-500 mx-auto mb-2 animate-spin" />
              <CardTitle className="text-lg font-black uppercase tracking-tight">Verificando convite...</CardTitle>
            </>
          ) : (
            <>
              <Users className="h-10 w-10 text-indigo-500 mx-auto mb-2" />
              <CardTitle className="text-lg font-black uppercase tracking-tight">Convite pro squad</CardTitle>
              <CardDescription className="text-xs">
                Você foi convidado pra entrar como <strong>{invite.roleName}</strong>.
              </CardDescription>
            </>
          )}
        </CardHeader>
        {invite && !loadError && !accepted && (
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-center gap-2">
              <Badge variant="outline" className="text-xs font-bold">Squad: {invite.squadId}</Badge>
              <Badge variant="outline" className="text-xs font-bold">Papel: {invite.roleName}</Badge>
            </div>
            <Button onClick={handleAccept} disabled={isAccepting} className="h-10 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white">
              {isAccepting ? 'Aceitando...' : 'Aceitar Convite'}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
