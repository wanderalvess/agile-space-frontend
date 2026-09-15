import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, ShieldCheck, Lock, Database, Key } from 'lucide-react';
import { ManualHero } from '../components/ManualHero';
import { getTopicById } from '../data/topics';

export function GovernanceTopic() {
  const meta = getTopicById('governance')!;

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <ManualHero
        title={meta.title}
        subtitle={meta.subtitle}
        description={meta.description}
        icon={meta.icon}
        color={meta.color}
        badgeBg={meta.badgeBg}
        badgeBorder={meta.badgeBorder}
        badgeText={meta.badgeText}
        actionUrl={meta.actionUrl}
        actionLabel={meta.actionLabel}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="p-8 bg-emerald-600 rounded-[2.5rem] text-white shadow-2xl shadow-emerald-500/20 space-y-4">
            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100">
              <ShieldCheck className="h-4 w-4" /> Compliance Ativo
            </h4>
            <p className="text-xs text-emerald-100/90 leading-relaxed font-medium italic">
              &quot;O Espaço Ágil utiliza isolamento multi-tenant por UID e autenticação OAuth2 padrão Google. Seus dados e registros nunca são cruzados com outros usuários ou squads.&quot;
            </p>
          </div>
        </div>

        <div className="lg:col-span-8">
          <Card className="border-none bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <CardHeader className="p-8 pb-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                Políticas & Transparência Técnica
              </CardTitle>
              <CardDescription className="text-xs font-medium">
                Entenda como sua privacidade e as informações da sua organização são protegidas.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-emerald-600" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                      Privacidade dos Dados
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    Não armazenamos senhas diretamente: toda a autenticação é delegada via OAuth2 seguro. Suas anotações, boards e snippets são protegidos por Firestore Security Rules com validação estrita de token.
                  </p>
                </div>

                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-emerald-600" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                      Processamento de IA
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    As chaves de API (Gemini Studio, etc.) configuradas no Knowledge Hub residem apenas no LocalStorage do usuário. Nenhuma requisição transfere suas credenciais privadas para servidores de terceiros.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
