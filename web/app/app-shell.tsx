import { DoorOpen, HousePlug } from "lucide-react";
import { DoorApp } from "./door-app";
import { DryerApp } from "./dryer-app";

type Feature = "gate" | "dryer";

const features = [
  { id: "gate" as const, label: "门禁", detail: "OpenGate", icon: DoorOpen },
  { id: "dryer" as const, label: "干衣机", detail: "美居设备", icon: HousePlug },
];

export function AppShell({ feature }: { feature: Feature }) {

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#2d2d2a]">
      <nav aria-label="功能切换" className="sticky top-0 z-30 border-b border-[#dedbd3]/90 bg-[#f7f6f2]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto mb-3 flex w-full max-w-[520px] items-end justify-between px-1"><div><strong className="font-display text-[22px] font-medium tracking-[-.03em]">OpenHome</strong><span className="ml-2 text-[10px] tracking-[.08em] text-[#969188]">家庭控制中枢</span></div><span className="text-[10px] text-[#aaa59c]">2 个功能</span></div>
        <div className="mx-auto flex w-full max-w-[520px] gap-2 rounded-[14px] border border-[#dedbd3] bg-[#fbfaf7] p-1.5 shadow-[0_8px_28px_rgba(45,45,42,.04)]">
          {features.map((item) => {
            const Icon = item.icon;
            const active = feature === item.id;
            return <a key={item.id} href={item.id === "gate" ? "/" : "/?feature=dryer"} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-1 items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition ${active ? "bg-[#2f4f46] text-white shadow-sm" : "text-[#69665f] hover:bg-[#f0ede7]"}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[9px] ${active ? "bg-white/12" : "bg-[#ece8e0]"}`}><Icon size={18} /></span><span className="min-w-0"><strong className="block text-sm font-semibold">{item.label}</strong><span className={`block truncate text-[10px] ${active ? "text-white/65" : "text-[#9a968d]"}`}>{item.detail}</span></span></a>;
          })}
        </div>
      </nav>
      {feature === "gate" ? <DoorApp /> : <DryerApp />}
    </div>
  );
}
