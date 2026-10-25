"use client";

import { useCallback, useState } from "react";
import { Clock3, LoaderCircle, Pause, Play, Power, RefreshCw, Shirt, Smartphone } from "lucide-react";

type ApiResult<T> = { ok: boolean; data?: T; message?: string };
type Home = { homegroupId: string | number; name?: string };
type Device = { applianceCode: string; name?: string; type?: string | number };
type DryerState = { power: boolean; workStatus: number | string; dryingStatus: number | string; program: number | string; remaining: number | string; appointment: number | string };

const programs = [{ value: 2, label: "混合 · 100 分钟" }, { value: 42, label: "小件烘 · 50 分钟" }, { value: 43, label: "大件烘 · 150 分钟" }, { value: 26, label: "定时烘 · 30 分钟" }];

async function api<T>(operation: string, init?: RequestInit) {
  const response = await fetch(`/api/v1/dryer/${operation}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const payload = await response.json() as ApiResult<T>;
  if (!response.ok || !payload.ok) throw new Error(payload.message || "请求失败");
  return payload.data as T;
}

function mapProperties(raw: unknown) {
  const value = raw as { properties?: Array<{ code?: string; propertyCode?: string; value: unknown }>; data?: { properties?: Array<{ code?: string; propertyCode?: string; value: unknown }> } };
  const list = value?.properties || value?.data?.properties;
  if (!Array.isArray(list)) return (raw || {}) as Record<string, unknown>;
  return Object.fromEntries(list.map((item) => [item.code || item.propertyCode || "", item.value]));
}

export function DryerApp() {
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [state, setState] = useState<DryerState | null>(null);
  const [program, setProgram] = useState(43);
  const [appointment, setAppointment] = useState(60);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("通过授权适配器连接美居设备");

  const refresh = useCallback(async (id = deviceId) => {
    if (!id) return;
    const raw = await api<unknown>(`status?deviceId=${encodeURIComponent(id)}`);
    const p = mapProperties(raw);
    const next = { power: p["dryer.power"] === true || p["dryer.power"] === 1, workStatus: String(p["dryer.workStatus"] ?? "—"), dryingStatus: String(p["dryer.dryingStatus"] ?? "—"), program: String(p["dryer.currentDryingProgramId"] ?? "—"), remaining: String(p["dryer.remainingRunningTime"] ?? "—"), appointment: String(p["dryer.appointmentLeftTime"] ?? "0") };
    setState(next); setProgram(Number(next.program) || 43); setMessage("状态已更新");
  }, [deviceId]);

  async function loadDevices(nextHomeId: string) {
    const raw = await api<{ homeList?: Array<{ roomList?: Array<{ applianceList?: Device[] }> }> }>(`devices?homeId=${encodeURIComponent(nextHomeId)}`);
    const next = (raw.homeList || []).flatMap((home) => (home.roomList || []).flatMap((room) => room.applianceList || [])).filter((device) => String(device.type).toLowerCase() === "0xdc");
    setDevices(next); const first = next[0]?.applianceCode || ""; setDeviceId(first); if (first) await refresh(first); else setMessage("当前家庭没有干衣机");
  }

  async function finishLogin() {
    setBusy("login");
    try {
      await api("login", { method: "POST", body: JSON.stringify({ mobile, code }) });
      const raw = await api<{ homeList?: Home[] }>("homes");
      const next = raw.homeList || []; setHomes(next); const first = String(next[0]?.homegroupId || ""); setHomeId(first); setLoggedIn(true); setMobile(""); setCode("");
      if (first) await loadDevices(first); setMessage("连接成功");
    } catch (error) { setMessage(error instanceof Error ? error.message : "登录失败"); }
    finally { setBusy(null); }
  }

  async function sendSms() {
    if (!/^1\d{10}$/.test(mobile)) return setMessage("请输入正确手机号");
    setBusy("sms"); try { await api("sms", { method: "POST", body: JSON.stringify({ mobile }) }); setMessage("验证码已发送"); } catch (error) { setMessage(error instanceof Error ? error.message : "发送失败"); } finally { setBusy(null); }
  }

  async function command(name: string, operation: string, body: Record<string, unknown>) {
    if (!deviceId) return;
    setBusy(name); try { await api(operation, { method: "POST", body: JSON.stringify({ deviceId, ...body }) }); await new Promise((resolve) => setTimeout(resolve, 900)); await refresh(); setMessage(`${name}已执行`); } catch (error) { setMessage(error instanceof Error ? error.message : `${name}失败`); } finally { setBusy(null); }
  }

  async function cancelAppointment() {
    if (!deviceId) return;
    setBusy("取消预约");
    try {
      await api("action", { method: "POST", body: JSON.stringify({ deviceId, action: "cancelAppointmentDrying", data: { controlCommand: JSON.stringify({ "dryer.currentDryingProgramId": Number(state?.program || program) }) } }) });
      await api("power", { method: "POST", body: JSON.stringify({ deviceId, power: false }) });
      await new Promise((resolve) => setTimeout(resolve, 900)); await refresh(); setMessage("预约已取消，设备已关机");
    } catch (error) { setMessage(error instanceof Error ? error.message : "取消预约失败"); } finally { setBusy(null); }
  }

  return <main className="px-4 py-6 sm:py-10"><section className="mx-auto w-full max-w-[520px] space-y-5">
    <header className="flex items-center gap-3 px-1"><span className="grid h-10 w-10 place-items-center rounded-[10px] bg-[#2f4f46] text-white"><Shirt size={21} /></span><div><h1 className="text-[19px] font-semibold leading-none">干衣机</h1><span className="mt-1.5 block text-[10px] tracking-[.08em] text-[#85827a]">美居授权适配器</span></div></header>
    {!loggedIn ? <section className="rounded-[18px] border border-[#dedbd3] bg-[#fbfaf7] p-6 sm:p-8"><Smartphone className="mb-5 text-[#2f4f46]" /><h2 className="font-display text-[30px] font-medium">连接美居</h2><p className="mt-2 text-sm text-[#77736b]">凭据只提交给服务端适配器</p><div className="mt-7 space-y-3"><input aria-label="美居手机号" value={mobile} onChange={(event) => setMobile(event.target.value.replace(/\D/g, ""))} maxLength={11} placeholder="手机号" className="h-14 w-full rounded-[10px] border border-[#d8d4cb] bg-white px-4 outline-none focus:border-[#2f4f46]" /><div className="flex gap-2.5"><input aria-label="美居验证码" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} maxLength={6} placeholder="6位验证码" className="h-14 min-w-0 flex-1 rounded-[10px] border border-[#d8d4cb] bg-white px-4 outline-none focus:border-[#2f4f46]" /><button type="button" onClick={sendSms} disabled={busy !== null} className="min-w-28 rounded-[10px] bg-[#2f4f46] px-3 text-sm font-semibold text-white disabled:opacity-40">{busy === "sms" ? <LoaderCircle className="mx-auto animate-spin" size={18} /> : "获取验证码"}</button></div><button type="button" onClick={finishLogin} disabled={busy !== null || code.length !== 6} className="h-12 w-full rounded-[10px] bg-[#d97757] font-semibold text-white disabled:opacity-40">连接设备</button></div></section> : <>
      <section className="grid grid-cols-2 gap-3"><label className="rounded-[14px] border border-[#dedbd3] bg-[#fbfaf7] p-3 text-xs text-[#77736b]">家庭<select value={homeId} onChange={(event) => { setHomeId(event.target.value); void loadDevices(event.target.value); }} className="mt-2 h-10 w-full rounded-[8px] border border-[#d8d4cb] bg-white px-2 text-sm text-[#2d2d2a]">{homes.map((home) => <option key={home.homegroupId} value={home.homegroupId}>{home.name || "家庭"}</option>)}</select></label><label className="rounded-[14px] border border-[#dedbd3] bg-[#fbfaf7] p-3 text-xs text-[#77736b]">设备<select value={deviceId} onChange={(event) => { setDeviceId(event.target.value); void refresh(event.target.value); }} className="mt-2 h-10 w-full rounded-[8px] border border-[#d8d4cb] bg-white px-2 text-sm text-[#2d2d2a]">{devices.map((device) => <option key={device.applianceCode} value={device.applianceCode}>{device.name || "干衣机"}</option>)}</select></label></section>
      <section className="rounded-[18px] bg-[#2f4f46] p-5 text-white"><div className="flex items-start justify-between"><div><p className="text-xs text-white/60">实时状态</p><h2 className="mt-2 font-display text-[34px]">{state?.power ? "已开机" : "已关机"}</h2></div><button onClick={() => refresh()} disabled={busy !== null} aria-label="刷新干衣机" className="grid h-10 w-10 place-items-center rounded-[10px] bg-white/10"><RefreshCw size={17} /></button></div><div className="mt-6 grid grid-cols-4 gap-2 text-center"><div><b className="block text-lg">{state?.workStatus ?? "—"}</b><span className="text-[10px] text-white/55">状态</span></div><div><b className="block text-lg">{state?.program ?? "—"}</b><span className="text-[10px] text-white/55">程序</span></div><div><b className="block text-lg">{state?.remaining ?? "—"}</b><span className="text-[10px] text-white/55">剩余</span></div><div><b className="block text-lg">{state?.appointment ?? "0"}</b><span className="text-[10px] text-white/55">预约</span></div></div></section>
      <section className="rounded-[18px] border border-[#dedbd3] bg-[#fbfaf7] p-5"><h2 className="font-display text-[24px]">程序与操作</h2><select value={program} onChange={(event) => setProgram(Number(event.target.value))} className="mt-4 h-12 w-full rounded-[10px] border border-[#d8d4cb] bg-white px-3">{programs.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button onClick={() => command("程序", "program", { programId: program })} className="mt-2 h-11 w-full rounded-[10px] bg-[#ece8e0] text-sm font-semibold">设定程序</button><div className="mt-4 grid grid-cols-4 gap-2">{[{ label: "开机", icon: Power, run: () => command("开机", "power", { power: true }) }, { label: "启动", icon: Play, run: () => command("启动", "action", { action: "startDrying", data: {} }) }, { label: "暂停", icon: Pause, run: () => command("暂停", "action", { action: "pauseDrying", data: {} }) }, { label: "关机", icon: Power, run: () => command("关机", "power", { power: false }) }].map((item) => <button key={item.label} onClick={item.run} disabled={busy !== null} className="grid min-h-20 place-items-center rounded-[12px] bg-[#f0e6df] text-xs font-semibold text-[#704b3e] disabled:opacity-40"><span><item.icon className="mx-auto mb-1.5" size={19} />{item.label}</span></button>)}</div></section>
      <section className="rounded-[18px] border border-[#dedbd3] bg-[#fbfaf7] p-5"><div className="flex items-center gap-2"><Clock3 size={18} className="text-[#d97757]" /><h2 className="font-display text-[24px]">预约</h2></div><label className="mt-4 block text-xs text-[#77736b]">延后分钟数<input type="number" min={1} max={1440} value={appointment} onChange={(event) => setAppointment(Number(event.target.value))} className="mt-2 h-12 w-full rounded-[10px] border border-[#d8d4cb] bg-white px-3 text-base text-[#2d2d2a]" /></label><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => command("预约", "action", { action: "appointmentDrying", data: { appointmentTime: appointment } })} className="h-11 rounded-[10px] bg-[#d97757] text-sm font-semibold text-white">创建预约</button><button onClick={cancelAppointment} className="h-11 rounded-[10px] bg-[#ece8e0] text-sm font-semibold">取消并关机</button></div></section>
    </>}
    <p role="status" className="px-1 text-center text-xs text-[#77736b]">{message}</p>
  </section></main>;
}
