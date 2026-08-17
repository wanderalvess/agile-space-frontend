'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Calculator, 
  Square, 
  Circle, 
  Triangle, 
  ArrowLeft,
  Divide,
  Minus,
  Plus,
  X,
  Equal,
  RotateCcw,
  Maximize2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

export default function CalculatorsPage() {
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);

  // Geometric States
  const [squareSide, setSquareSide] = useState('');
  const [circleRadius, setCircleRadius] = useState('');
  const [triBase, setTriBase] = useState('');
  const [triHeight, setTriHeight] = useState('');
  const [rectWidth, setRectWidth] = useState('');
  const [rectHeight, setRectHeight] = useState('');

  // --- Calculator Logic ---
  const handleDigit = (digit: string) => {
    setCalcDisplay(prev => prev === '0' ? digit : prev + digit);
  };

  const handleOp = (op: string) => {
    setPrevValue(parseFloat(calcDisplay));
    setOperation(op);
    setCalcDisplay('0');
  };

  const calculate = () => {
    if (prevValue === null || operation === null) return;
    const current = parseFloat(calcDisplay);
    let res = 0;
    switch (operation) {
      case '+': res = prevValue + current; break;
      case '-': res = prevValue - current; break;
      case '*': res = prevValue * current; break;
      case '/': res = prevValue / current; break;
    }
    setCalcDisplay(String(res));
    setPrevValue(null);
    setOperation(null);
  };

  const clearCalc = () => {
    setCalcDisplay('0');
    setPrevValue(null);
    setOperation(null);
  };

  return (
    <div className="flex flex-col h-screen bg-[#FDFDFD] font-sans overflow-hidden">
      {/* Header */}
      <header className="px-8 py-5 border-b bg-white/60 backdrop-blur-xl flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Link href="/devtools">
            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-slate-400 hover:text-slate-900 transition-all">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex flex-col">
            <h1 className="text-lg font-black italic uppercase tracking-tighter text-slate-800">
              Nexus <span className="text-blue-600">Calculators</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Cálculos de Engenharia e Geometria</p>
          </div>
        </div>
        <Badge variant="outline" className="h-6 px-3 text-[9px] font-black uppercase tracking-widest border-blue-200 text-blue-600 bg-blue-50">
          Matemática
        </Badge>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col items-center">
        <Tabs defaultValue="geometry" className="w-full max-w-5xl space-y-10">
          <TabsList className="bg-slate-100/50 p-1 rounded-2xl w-fit mx-auto h-12 shadow-inner">
            <TabsTrigger value="geometry" className="px-8 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-md transition-all">Geometria</TabsTrigger>
            <TabsTrigger value="standard" className="px-8 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-md transition-all">Calculadora Standard</TabsTrigger>
          </TabsList>

          <TabsContent value="geometry" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Square */}
              <ShapeCard title="Quadrado" icon={Square} formula="Área = L²">
                <InputItem label="Lado (L)" value={squareSide} onChange={setSquareSide} />
                <ResultItem value={squareSide ? Math.pow(parseFloat(squareSide), 2).toFixed(2) : '0'} />
              </ShapeCard>

              {/* Rectangle */}
              <ShapeCard title="Retângulo" icon={Maximize2} formula="Área = B × H">
                <div className="grid grid-cols-2 gap-2">
                  <InputItem label="Base (B)" value={rectWidth} onChange={setRectWidth} />
                  <InputItem label="Altura (H)" value={rectHeight} onChange={setRectHeight} />
                </div>
                <ResultItem value={(rectWidth && rectHeight) ? (parseFloat(rectWidth) * parseFloat(rectHeight)).toFixed(2) : '0'} />
              </ShapeCard>

              {/* Circle */}
              <ShapeCard title="Círculo" icon={Circle} formula="Área = π × r²">
                <InputItem label="Raio (r)" value={circleRadius} onChange={setCircleRadius} />
                <ResultItem value={circleRadius ? (Math.PI * Math.pow(parseFloat(circleRadius), 2)).toFixed(2) : '0'} />
              </ShapeCard>

              {/* Triangle */}
              <ShapeCard title="Triângulo" icon={Triangle} formula="Área = (B × H) / 2">
                <div className="grid grid-cols-2 gap-2">
                  <InputItem label="Base (B)" value={triBase} onChange={setTriBase} />
                  <InputItem label="Altura (H)" value={triHeight} onChange={setTriHeight} />
                </div>
                <ResultItem value={(triBase && triHeight) ? ((parseFloat(triBase) * parseFloat(triHeight)) / 2).toFixed(2) : '0'} />
              </ShapeCard>

            </div>
          </TabsContent>

          <TabsContent value="standard" className="flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Card className="w-[340px] bg-slate-900 border-none rounded-[3rem] p-6 shadow-2xl shadow-blue-500/10">
              <div className="h-24 flex items-end justify-end mb-6 px-4">
                <span className="text-4xl font-light text-white tracking-tight truncate">{calcDisplay}</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <CalcBtn label="AC" onClick={clearCalc} variant="secondary" />
                <CalcBtn label="+/-" onClick={() => setCalcDisplay(p => p.startsWith('-') ? p.slice(1) : '-' + p)} variant="secondary" />
                <CalcBtn label="%" onClick={() => setCalcDisplay(p => String(parseFloat(p) / 100))} variant="secondary" />
                <CalcBtn label="÷" onClick={() => handleOp('/')} variant="primary" />
                
                <CalcBtn label="7" onClick={() => handleDigit('7')} />
                <CalcBtn label="8" onClick={() => handleDigit('8')} />
                <CalcBtn label="9" onClick={() => handleDigit('9')} />
                <CalcBtn label="×" onClick={() => handleOp('*')} variant="primary" />

                <CalcBtn label="4" onClick={() => handleDigit('4')} />
                <CalcBtn label="5" onClick={() => handleDigit('5')} />
                <CalcBtn label="6" onClick={() => handleDigit('6')} />
                <CalcBtn label="-" onClick={() => handleOp('-')} variant="primary" />

                <CalcBtn label="1" onClick={() => handleDigit('1')} />
                <CalcBtn label="2" onClick={() => handleDigit('2')} />
                <CalcBtn label="3" onClick={() => handleDigit('3')} />
                <CalcBtn label="+" onClick={() => handleOp('+')} variant="primary" />

                <CalcBtn label="0" onClick={() => handleDigit('0')} colSpan={2} />
                <CalcBtn label="." onClick={() => handleDigit('.')} />
                <CalcBtn label="=" onClick={calculate} variant="primary" />
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function ShapeCard({ title, icon: Icon, formula, children }: { title: string, icon: any, formula: string, children: React.ReactNode }) {
  return (
    <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white/80 backdrop-blur-md group hover:shadow-2xl transition-all border border-blue-50/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="p-2 bg-blue-50 rounded-xl text-blue-600 group-hover:scale-110 transition-transform">
            <Icon className="h-5 w-5" />
          </div>
          <Badge variant="ghost" className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{formula}</Badge>
        </div>
        <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
      </CardContent>
    </Card>
  );
}

function InputItem({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">{label}</span>
      <Input 
        type="number" 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="h-10 bg-slate-50 border-none rounded-xl font-bold text-slate-700"
      />
    </div>
  );
}

function ResultItem({ value }: { value: string }) {
  return (
    <div className="pt-4 border-t border-slate-50">
      <div className="bg-blue-600 rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg shadow-blue-500/20">
         <span className="text-[9px] font-black uppercase text-blue-100 tracking-widest">Área Estimada</span>
         <span className="text-xl font-black text-white italic">{value}</span>
      </div>
    </div>
  );
}

function CalcBtn({ label, onClick, variant = 'default', colSpan = 1 }: { label: string, onClick: () => void, variant?: 'default' | 'primary' | 'secondary', colSpan?: number }) {
  const styles = {
    default: 'bg-slate-800 text-white hover:bg-slate-700',
    primary: 'bg-orange-500 text-white hover:bg-orange-600',
    secondary: 'bg-slate-400 text-slate-900 hover:bg-slate-300'
  };
  return (
    <button 
      onClick={onClick} 
      className={`h-14 rounded-full font-bold text-lg transition-all active:scale-95 ${styles[variant]} ${colSpan === 2 ? 'col-span-2 text-left px-8' : ''}`}
    >
      {label}
    </button>
  );
}
