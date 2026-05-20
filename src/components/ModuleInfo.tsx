import React from 'react';
import { Info } from 'lucide-react';

interface ModuleInfoProps {
  number: string;
  title: string;
  description: string;
}

export const ModuleInfo: React.FC<ModuleInfoProps> = ({ number, title, description }) => (
  <div className="flex items-start gap-3 border border-[#141414]/20 bg-white/50 px-4 py-3 rounded-none">
    <Info size={13} className="text-[#141414] opacity-40 shrink-0 mt-[1px]" />
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] opacity-40">{number}</span>
        <span className="font-mono font-black text-[11px] uppercase tracking-widest text-[#141414]">{title}</span>
      </div>
      <p className="font-mono text-[10px] text-[#141414] opacity-55 leading-relaxed">{description}</p>
    </div>
  </div>
);
