"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, LoaderCircle, LogOut, Pause, Play, Power, RefreshCw, Smartphone } from "lucide-react";

type ApiResult<T> = { ok: boolean; data?: T; message?: string };
type Home = { homegroupId: string | number };
type Device = { applianceCode: string; name?: string; type?: string | number };
type DryerState = { power: boolean; workStatus: string; program: string; remaining: string; appointment: string };
type Toast = { text: string; kind: "success" | "error" | "info" };
const programs = [{ value: 2, label: "混合 · 100 分钟" }, { value: 42, label: "小件烘 · 50 分钟" }, { value: 43, label: "大件烘 · 150 分钟" }, { value: 26, label: "定时烘 · 30 分钟" }];

async function api<T>(operation: string, init?: RequestInit) {
  const response = await fetch(`/api/v1/dryer/${operation}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const payload = await response.json() as ApiResult<T>;
  if (!response.ok || !payload.ok) throw new Error(payload.message || "请求失败");
  return payload.data as T;
}
function properties(raw: unknown) {
  const value = raw as { properties?: Array<{ code?: string; propertyCode?: string; value: unknown }>; data?: { properties?: Array<{ code?: string; propertyCode?: string; value: unknown }> } };
  const list = value?.properties || value?.data?.properties;
  return Array.isArray(list) ? Object.fromEntries(list.map((item) => [item.code || item.propertyCode || "", item.value])) : (raw || {}) as Record<string, unknown>;
}
function programName(value?: string) { return value === undefined || value === "—" ? "—" : programs.find((item) => item.value === Number(value))?.label.split(" · ")[0] || `程序 ${value}`; }
function statusName(value?: string, power?: boolean) { return !power ? "待机" : ({ "1": "待机", "2": "烘干中", "3": "已暂停", "4": "已预约" }[String(value)] || "状态未知"); }
function minutes(value?: string) { const number = Number(value); return Number.isFinite(number) && number > 0 ? `${number} 分钟` : "—"; }

export function DryerApp() {
  const [mobile, setMobile] = useState(""); const [code, setCode] = useState("");
  const [initialized, setInitialized] = useState(false); const [loggedIn, setLoggedIn] = useState(false);
  const [deviceId, setDeviceId] = useState(""); const [deviceName, setDeviceName] = useState("干衣机");
  const [state, setState] = useState<DryerState | null>(null); const [program, setProgram] = useState(43);
  const [appointment, setAppointment] = useState(60); const [busy, setBusy] = useState<string | null>(null); const [toast, setToast] = useState<Toast | null>(null); const [countdown, setCountdown] = useState(0);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 2600); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => { if (countdown <= 0) return; const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000); return () => window.clearInterval(timer); }, [countdown]);
  const notify = useCallback((text: string, kind: Toast["kind"] = "info") => setToast({ text, kind }), []);
  const refresh = useCallback(async (id = deviceId) => {
    if (!id) return; const p = properties(await api<unknown>(`status?deviceId=${encodeURIComponent(id)}`));
    const next = { power: p["dryer.power"] === true || p["dryer.power"] === 1, workStatus: String(p["dryer.workStatus"] ?? "—"), program: String(p["dryer.currentDryingProgramId"] ?? "—"), remaining: String(p["dryer.remainingRunningTime"] ?? "—"), appointment: String(p["dryer.appointmentLeftTime"] ?? "0") };
    setState(next); if (Number.isFinite(Number(next.program))) setProgram(Number(next.program));
  }, [deviceId]);
  const findDryer = useCallback(async (homes: Home[]) => {
    for (const home of homes) {
      const raw = await api<{ homeList?: Array<{ roomList?: Array<{ applianceList?: Device[] }> }> }>(`devices?homeId=${encodeURIComponent(home.homegroupId)}`);
      const dryer = (raw.homeList || []).flatMap((item) => (item.roomList || []).flatMap((room) => room.applianceList || [])).find((item) => String(item.type).toLowerCase() === "0xdc");
      if (dryer) { setDeviceId(dryer.applianceCode); setDeviceName(dryer.name || "干衣机"); await refresh(dryer.applianceCode); return true; }
    } return false;
  }, [refresh]);
  useEffect(() => { api<{ homeList?: Home[] }>("homes").then(async (raw) => { if (await findDryer(raw.homeList || [])) setLoggedIn(true); }).catch(() => undefined).finally(() => setInitialized(true)); }, [findDryer]);
  async function finishLogin(smsCode = code) { if (busy) return; setBusy("login"); try { await api("login", { method: "POST", body: JSON.stringify({ mobile, code: smsCode }) }); const raw = await api<{ homeList?: Home[] }>("homes"); if (!await findDryer(raw.homeList || [])) throw new Error("没有找到干衣机"); setLoggedIn(true); setMobile(""); setCode(""); setCountdown(0); notify("登录成功", "success"); } catch (error) { notify(error instanceof Error ? error.message : "登录失败", "error"); } finally { setBusy(null); setInitialized(true); } }
  async function sendSms() { if (!/^1\d{10}$/.test(mobile)) return notify("请输入正确手机号", "error"); setBusy("sms"); try { await api("sms", { method: "POST", body: JSON.stringify({ mobile }) }); setCountdown(60); notify("验证码已发送", "success"); } catch (error) { notify(error instanceof Error ? error.message : "发送失败", "error"); } finally { setBusy(null); } }
  async function logout() { setBusy("logout"); try { await api("logout", { method: "POST" }); setLoggedIn(false); setDeviceId(""); setState(null); notify("已退出", "success"); } catch (error) { notify(error instanceof Error ? error.message : "退出失败", "error"); } finally { setBusy(null); } }
  async function command(name: string, operation: string, body: Record<string, unknown>) { if (!deviceId) return; setBusy(name); try { await api(operation, { method: "POST", body: JSON.stringify({ deviceId, ...body }) }); await new Promise((resolve) => setTimeout(resolve, 900)); await refresh(); notify(`${name}成功`, "success"); } catch (error) { notify(error instanceof Error ? error.message : `${name}失败`, "error"); } finally { setBusy(null); } }
  async function cancelAppointment() { if (!deviceId) return; setBusy("取消预约"); try { await api("action", { method: "POST", body: JSON.stringify({ deviceId, action: "cancelAppointmentDrying", data: { controlCommand: JSON.stringify({ "dryer.currentDryingProgramId": Number(state?.program || program) }) } }) }); await api("power", { method: "POST", body: JSON.stringify({ deviceId, power: false }) }); await new Promise((resolve) => setTimeout(resolve, 900)); await refresh(); notify("预约已取消", "success"); } catch (error) { notify(error instanceof Error ? error.message : "取消预约失败", "error"); } finally { setBusy(null); } }
  const choices = programs.some((item) => item.value === program) ? programs : [{ value: program, label: `程序 ${program} · 当前` }, ...programs];

  return <main className="px-4 py-6 sm:py-10">{toast && <div role="status" className={`fixed left-1/2 top-5 z-50 max-w-[calc(100%-32px)] -translate-x-1/2 rounded-[12px] border px-4 py-2.5 text-sm font-medium shadow-lg ${toast.kind === "error" ? "border-[#e7b8aa] bg-[#fff8f5] text-[#9b4d38]" : "border-[#dfc5b9] bg-[#fffaf7] text-[#7d4938]"}`}>{toast.text}</div>}<section className="mx-auto w-full max-w-[520px] space-y-5">
    {!initialized ? <div className="grid h-64 place-items-center"><LoaderCircle className="animate-spin text-[#2f4f46]" /></div> : !loggedIn ? <section className="rounded-[18px] border border-[#dedbd3] bg-[#fbfaf7] p-6 sm:p-8"><Smartphone className="mb-5 text-[#2f4f46]" /><h2 className="font-display text-[30px] font-medium">登录</h2><p className="mt-2 text-sm text-[#77736b]">使用短信验证码登录</p><div className="mt-7 space-y-3"><input aria-label="手机号" inputMode="numeric" autoComplete="tel" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))} maxLength={11} placeholder="手机号" className="h-14 w-full rounded-[10px] border border-[#d8d4cb] bg-white px-4 outline-none" /><div className="flex gap-2.5"><input aria-label="验证码" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => { const next = e.target.value.replace(/\D/g, ""); setCode(next); if (next.length === 6) void finishLogin(next); }} maxLength={6} placeholder="6位验证码" className="h-14 min-w-0 flex-1 rounded-[10px] border border-[#d8d4cb] bg-white px-4 outline-none" /><button onClick={sendSms} disabled={busy !== null || countdown > 0} className="min-w-28 rounded-[10px] bg-[#2f4f46] px-3 text-sm font-semibold text-white disabled:opacity-40">{busy === "sms" ? <LoaderCircle className="mx-auto animate-spin" size={18} /> : countdown > 0 ? `${countdown}s` : "获取验证码"}</button></div>{busy === "login" && <div className="flex h-8 items-center justify-center"><LoaderCircle className="animate-spin text-[#d97757]" size={20} /></div>}</div></section> : <>
      <section className="flex items-center rounded-[14px] border border-[#dedbd3] bg-[#fbfaf7] p-2.5"><span className="min-w-0 flex-1 truncate px-2 text-sm font-medium">{deviceName}</span><button onClick={logout} disabled={busy !== null} aria-label="退出 OpenDevice" className="grid h-10 w-10 place-items-center rounded-[10px] text-[#a65d48] disabled:opacity-40"><LogOut size={17} /></button></section>
      <section className="rounded-[18px] bg-[#2f4f46] p-5 text-white"><div className="flex items-start justify-between"><div><p className="text-xs text-white/60">{deviceName}</p><h2 className="mt-2 font-display text-[34px]">{statusName(state?.workStatus, state?.power)}</h2></div><button onClick={() => void refresh().then(() => notify("已刷新", "success")).catch((e) => notify(e instanceof Error ? e.message : "刷新失败", "error"))} disabled={busy !== null} aria-label="刷新" className="grid h-10 w-10 place-items-center rounded-[10px] bg-white/10"><RefreshCw size={17} /></button></div><div className="mt-6 grid grid-cols-3 gap-2 text-center"><div><b className="block truncate text-base">{programName(state?.program)}</b><span className="text-[10px] text-white/55">程序</span></div><div><b className="block truncate text-base">{minutes(state?.remaining)}</b><span className="text-[10px] text-white/55">剩余</span></div><div><b className="block truncate text-base">{minutes(state?.appointment)}</b><span className="text-[10px] text-white/55">预约</span></div></div></section>
      <section className="rounded-[18px] border border-[#dedbd3] bg-[#fbfaf7] p-5"><h2 className="font-display text-[24px]">程序</h2><select value={program} onChange={(e) => setProgram(Number(e.target.value))} className="mt-4 h-12 w-full rounded-[10px] border border-[#d8d4cb] bg-white px-3">{choices.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button onClick={() => command("程序设定", "program", { programId: program })} disabled={busy !== null} className="mt-2 h-11 w-full rounded-[10px] bg-[#ece8e0] text-sm font-semibold disabled:opacity-40">设定</button><div className="mt-4 grid grid-cols-4 gap-2">{[{ label: "开机", icon: Power, run: () => command("开机", "power", { power: true }) }, { label: "启动", icon: Play, run: () => command("启动", "action", { action: "startDrying", data: {} }) }, { label: "暂停", icon: Pause, run: () => command("暂停", "action", { action: "pauseDrying", data: {} }) }, { label: "关机", icon: Power, run: () => command("关机", "power", { power: false }) }].map((item) => <button key={item.label} onClick={item.run} disabled={busy !== null} className="grid min-h-20 place-items-center rounded-[12px] bg-[#f0e6df] text-xs font-semibold text-[#704b3e] disabled:opacity-40"><span><item.icon className="mx-auto mb-1.5" size={19} />{item.label}</span></button>)}</div></section>
      <section className="rounded-[18px] border border-[#dedbd3] bg-[#fbfaf7] p-5"><div className="flex items-center gap-2"><Clock3 size={18} className="text-[#d97757]" /><h2 className="font-display text-[24px]">预约</h2></div><div className="mt-4 flex gap-2"><input aria-label="预约分钟" type="number" min={1} max={1440} value={appointment} onChange={(e) => setAppointment(Number(e.target.value))} className="h-12 min-w-0 flex-1 rounded-[10px] border border-[#d8d4cb] bg-white px-3" /><span className="grid place-items-center text-sm text-[#77736b]">分钟后</span></div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => command("预约", "action", { action: "appointmentDrying", data: { appointmentTime: appointment } })} disabled={busy !== null} className="h-11 rounded-[10px] bg-[#d97757] text-sm font-semibold text-white disabled:opacity-40">预约</button><button onClick={cancelAppointment} disabled={busy !== null} className="h-11 rounded-[10px] bg-[#ece8e0] text-sm font-semibold disabled:opacity-40">取消预约</button></div></section>
    </>}
  </section></main>;
}
