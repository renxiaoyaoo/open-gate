import { DoorOpen, HousePlug } from "lucide-react";
import { DoorApp } from "./door-app";
import { DryerApp } from "./dryer-app";

type Feature = "gate" | "dryer";

const features = [
  { id: "gate" as const, label: "OpenGate", detail: "门禁", icon: DoorOpen },
  { id: "dryer" as const, label: "OpenDevice", detail: "智能家电", icon: HousePlug },
];

export function AppShell({ feature }: { feature: Feature }) {
  return (
    <div data-default={feature} className="openhome-shell min-h-screen bg-[#f7f6f2] text-[#2d2d2a]">
      <style>{`.openhome-shell .feature-panel{display:none}.openhome-shell[data-default=gate] .gate-panel,.openhome-shell[data-default=dryer] .dryer-panel{display:block}.openhome-shell:has(.feature-target:target) .feature-panel{display:none}.openhome-shell:has(#feature-gate-target:target) .gate-panel,.openhome-shell:has(#feature-dryer-target:target) .dryer-panel{display:block}.feature-tab.active{background:#2f4f46;color:white;box-shadow:0 1px 2px rgb(0 0 0/.08)}.openhome-shell:has(.feature-target:target) .feature-tab{background:transparent;color:#69665f;box-shadow:none}.openhome-shell:has(.feature-target:target) .feature-icon{background:#ece8e0}.openhome-shell:has(.feature-target:target) .feature-detail{color:#9a968d}.openhome-shell:has(#feature-gate-target:target) .gate-tab,.openhome-shell:has(#feature-dryer-target:target) .dryer-tab{background:#2f4f46;color:white;box-shadow:0 1px 2px rgb(0 0 0/.08)}.feature-tab.active .feature-icon,.openhome-shell:has(#feature-gate-target:target) .gate-tab .feature-icon,.openhome-shell:has(#feature-dryer-target:target) .dryer-tab .feature-icon{background:rgb(255 255 255/.12)}.feature-tab.active .feature-detail,.openhome-shell:has(#feature-gate-target:target) .gate-tab .feature-detail,.openhome-shell:has(#feature-dryer-target:target) .dryer-tab .feature-detail{color:rgb(255 255 255/.65)}`}</style>
      <span id="feature-gate-target" className="feature-target sr-only" />
      <span id="feature-dryer-target" className="feature-target sr-only" />
      <nav aria-label="功能切换" className="sticky top-0 z-30 border-b border-[#dedbd3]/90 bg-[#f7f6f2]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto mb-3 flex w-full max-w-[520px] items-end justify-between px-1"><div><strong className="font-display text-[22px] font-medium tracking-[-.03em]">OpenHome</strong><span className="ml-2 text-[10px] tracking-[.08em] text-[#969188]">家庭控制中枢</span></div><span className="text-[10px] text-[#aaa59c]">2 个功能</span></div>
        <div className="mx-auto flex w-full max-w-[520px] gap-2 rounded-[14px] border border-[#dedbd3] bg-[#fbfaf7] p-1.5 shadow-[0_8px_28px_rgba(45,45,42,.04)]">
          {features.map((item) => {
            const Icon = item.icon;
            const active = feature === item.id;
            return <a key={item.id} href={`#feature-${item.id}-target`} className={`feature-tab ${item.id}-tab ${active ? "active" : ""} flex min-w-0 flex-1 items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[#69665f] transition hover:bg-[#f0ede7]`}><span className="feature-icon grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-[#ece8e0]"><Icon size={18} /></span><span className="min-w-0"><strong className="block text-sm font-semibold">{item.label}</strong><span className="feature-detail block truncate text-[10px] text-[#9a968d]">{item.detail}</span></span></a>;
          })}
        </div>
      </nav>
      <div className="feature-panel gate-panel"><DoorApp /></div>
      <div className="feature-panel dryer-panel"><DryerApp /></div>
    </div>
  );
}
