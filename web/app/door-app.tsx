"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, DoorOpen, KeyRound, LoaderCircle, LogOut, Plus, RefreshCw, Smartphone, X } from "lucide-react";

type Door = { id: string; name: string; communityName?: string | null; passwordSupported?: boolean; refreshedAt: number };
type Account = { id: string; username: string };
type DoorPassword = { value: string; validUntil: number };
type Toast = { text: string; kind: "success" | "error" | "info" };
type ApiResult<T = unknown> = { ok: boolean; message?: string; data?: T; meta?: { failedAccountCount?: number } };

async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const payload = (await response.json().catch(() => ({}))) as ApiResult<T>;
  if (!response.ok || !payload.ok) throw Object.assign(new Error(payload.message || "请求失败"), { status: response.status });
  return payload;
}

function GateLogo() {
  return (
    <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#173f32] text-white shadow-[0_8px_22px_rgba(23,63,50,.2)]">
      <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M5 20V8.6C5 5.5 7.5 3 10.6 3h2.8C16.5 3 19 5.5 19 8.6V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M9 20V9.5h6V20M3.5 20.5h17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="14" r="1.25" fill="#b9e2c8" />
      </svg>
    </span>
  );
}

export function DoorApp() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showLogin, setShowLogin] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [busy, setBusy] = useState<"sms" | "login" | "doors" | string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [passwords, setPasswords] = useState<Record<string, DoorPassword>>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const [logoutTarget, setLogoutTarget] = useState<Account | null>(null);
  const openingRef = useRef(false);
  const accountIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = useCallback((text: string, kind: Toast["kind"] = "info") => { setToast({ text, kind }); }, []);

  const loadDoors = useCallback(async () => {
    setBusy("doors");
    try {
      const result = await request<Door[]>("/api/v1/doors");
      setDoors(result.data || []); setLoggedIn(true);
      if (result.meta?.failedAccountCount) notify(`${result.meta.failedAccountCount} 个账号刷新失败`, "error");
      else if (!result.data?.length) notify("没有可用门禁");
      else if (result.message) notify(result.message);
    } catch (error) {
      if (error instanceof Error && "status" in error && error.status === 401) { setLoggedIn(false); setDoors([]); }
      notify(error instanceof Error ? error.message : "门禁加载失败", "error");
    } finally { setBusy(null); }
  }, [notify]);

  async function loadAccounts() {
    const result = await request<Account[]>("/api/v1/accounts");
    const next = result.data || [];
    setAccounts(next); setLoggedIn(next.length > 0);
    return next;
  }

  useEffect(() => {
    request<Account[]>("/api/v1/accounts")
      .then((result) => {
        const next = result.data || [];
        setAccounts(next); setLoggedIn(next.length > 0); setShowLogin(next.length === 0);
        return next.length > 0 ? loadDoors() : undefined;
      })
      .catch((error) => { setShowLogin(true); notify(error instanceof Error ? error.message : "加载失败", "error"); })
      .finally(() => setInitialized(true));
  }, [loadDoors, notify]);

  async function sendSms() {
    if (!/^1\d{10}$/.test(phone)) { notify("请输入正确的手机号", "error"); return; }
    setBusy("sms");
    try {
      const result = await request(`/api/v1/accounts/${accountIdRef.current}/sms`, { method: "POST", body: JSON.stringify({ mobile: phone }) });
      setCountdown(60); notify(result.message || "验证码已发送", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "验证码发送失败", "error"); }
    finally { setBusy(null); }
  }

  async function login(smsCode = code) {
    if (!/^1\d{10}$/.test(phone) || !/^\d{6}$/.test(smsCode) || busy !== null) return;
    setBusy("login");
    try {
      await request(`/api/v1/accounts/${accountIdRef.current}/login`, { method: "POST", body: JSON.stringify({ mobile: phone, smsCode }) });
      accountIdRef.current = crypto.randomUUID(); setPhone(""); setCode(""); setCountdown(0); setShowLogin(false); setLoggedIn(true);
      await loadAccounts(); await loadDoors(); notify("登录成功", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "登录失败", "error"); setBusy(null); }
  }

  async function logoutAccount(account: Account) {
    setBusy(`logout:${account.id}`);
    try {
      const result = await request(`/api/v1/accounts/${account.id}`, { method: "DELETE" });
      const remaining = await loadAccounts();
      setLogoutTarget(null); notify(result.message || "已退出", "success");
      if (!remaining.length) {
        setDoors([]); setPasswords({}); setShowLogin(true); setPhone(""); setCode(""); setCountdown(0); accountIdRef.current = crypto.randomUUID();
      } else await loadDoors();
    } catch (error) { notify(error instanceof Error ? error.message : "退出失败", "error"); }
    finally { setBusy(null); }
  }

  async function openDoor(door: Door) {
    if (openingRef.current) return;
    openingRef.current = true; setBusy(door.id);
    try {
      const result = await request(`/api/v1/doors/${door.id}/open`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } });
      notify(result.message || `${door.name} 已开门`, "success");
    } catch (error) {
      if (error instanceof Error && "status" in error && error.status === 401) { setLoggedIn(false); setDoors([]); }
      notify(error instanceof Error ? error.message : "开门失败", "error");
    } finally { openingRef.current = false; setBusy(null); }
  }

  async function showPassword(door: Door) {
    setBusy(`password:${door.id}`);
    try {
      const result = await request<{ password: string; validUntil: string }>(`/api/v1/doors/${door.id}/password`);
      if (!result.data?.password) throw new Error("获取密码失败");
      const next = { value: result.data.password, validUntil: Date.parse(result.data.validUntil) };
      setPasswords((value) => ({ ...value, [door.id]: next }));
      await navigator.clipboard?.writeText(next.value);
      notify("密码已复制", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "获取密码失败", "error"); }
    finally { setBusy(null); }
  }

  function passwordLabel(doorId: string) {
    const item = passwords[doorId];
    if (!item) return "显示密码";
    const remaining = Math.max(0, Math.ceil((item.validUntil - now) / 1000));
    const minutes = Math.floor(remaining / 60).toString().padStart(2, "0");
    const seconds = (remaining % 60).toString().padStart(2, "0");
    return `${item.value}  ${minutes}:${seconds}`;
  }

  return (
    <main className="min-h-screen bg-[#f1f3ee] px-4 py-6 text-[#17241e] sm:py-10">
      {toast && <div role="status" className={`fixed left-1/2 top-5 z-50 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(20,32,26,.22)] ${toast.kind === "error" ? "bg-[#a33a32]" : toast.kind === "success" ? "bg-[#173f32]" : "bg-[#43534b]"}`}>{toast.text}</div>}

      <section className="mx-auto w-full max-w-[520px]">
        <header className="mb-7 flex items-center justify-between px-1">
          <div className="flex items-center gap-3"><GateLogo /><div><h1 className="text-[19px] font-extrabold leading-none tracking-[-.03em]">OpenGate</h1><span className="mt-1 block text-[10px] font-bold uppercase tracking-[.18em] text-[#7b8881]">Access, simplified</span></div></div>
          {loggedIn && !showLogin && <button onClick={loadDoors} disabled={busy !== null} aria-label="刷新门禁" className="grid h-10 w-10 place-items-center rounded-[14px] bg-white text-[#173f32] shadow-[0_6px_20px_rgba(30,48,39,.08)] disabled:opacity-40"><RefreshCw size={17} className={busy === "doors" ? "animate-spin" : ""} /></button>}
        </header>

        {!initialized ? <div className="grid h-64 place-items-center"><LoaderCircle className="animate-spin text-[#173f32]" size={26} /></div> : !loggedIn || showLogin ? (
          <form onSubmit={(event) => event.preventDefault()} className="overflow-hidden rounded-[30px] bg-white shadow-[0_24px_70px_rgba(25,48,37,.1)]">
            <div className="bg-[#173f32] px-6 pb-7 pt-8 text-white sm:px-8"><div className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-white/10"><Smartphone size={21} /></div><h2 className="text-[28px] font-bold tracking-[-.04em]">{loggedIn ? "添加账号" : "登录"}</h2><p className="mt-1 text-sm text-white/55">{loggedIn ? "连接另一个门禁账号" : "验证码登录，无需密码"}</p></div>
            <div className="space-y-3 p-5 sm:p-7">
              <input aria-label="手机号" autoComplete="tel" inputMode="numeric" maxLength={11} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} placeholder="手机号" className="h-14 w-full rounded-2xl border border-[#dfe5df] bg-[#f7f8f5] px-4 text-base outline-none transition focus:border-[#4d7b65] focus:ring-4 focus:ring-[#4d7b65]/10" />
              <div className="flex gap-2.5"><input aria-label="验证码" autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={code} onChange={(event) => { const next = event.target.value.replace(/\D/g, ""); setCode(next); if (next.length === 6) void login(next); }} placeholder="6位验证码" className="h-14 min-w-0 flex-1 rounded-2xl border border-[#dfe5df] bg-[#f7f8f5] px-4 text-base outline-none transition focus:border-[#4d7b65] focus:ring-4 focus:ring-[#4d7b65]/10" /><button type="button" disabled={busy !== null || countdown > 0} onClick={sendSms} className="min-w-[108px] rounded-2xl bg-[#d9eadf] px-3 text-sm font-bold text-[#173f32] transition active:scale-[.98] disabled:opacity-45">{busy === "sms" ? <LoaderCircle className="mx-auto animate-spin" size={18} /> : countdown > 0 ? `${countdown}s` : "获取验证码"}</button></div>
              {busy === "login" && <div className="flex h-8 items-center justify-center"><LoaderCircle className="animate-spin text-[#173f32]" size={20} /></div>}
              {loggedIn && <button type="button" onClick={() => { setShowLogin(false); setPhone(""); setCode(""); setCountdown(0); }} className="h-11 w-full text-sm font-bold text-[#66756d]">取消</button>}
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <section className="flex items-center gap-2 overflow-x-auto rounded-[20px] bg-white p-2.5 shadow-[0_8px_28px_rgba(30,48,39,.07)]">
              {accounts.map((account) => <div key={account.id} className="flex shrink-0 items-center gap-2 rounded-[14px] bg-[#f0f4f0] py-2 pl-3 pr-1.5"><span className="max-w-36 truncate text-sm font-bold">{account.username}</span><button onClick={() => setLogoutTarget(account)} disabled={busy !== null} aria-label={`退出 ${account.username}`} className="grid h-7 w-7 place-items-center rounded-[10px] text-[#8c4a43] disabled:opacity-40"><LogOut size={14} /></button></div>)}
              <button onClick={() => setShowLogin(true)} aria-label="添加账号" className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#173f32] text-white"><Plus size={19} /></button>
            </section>

            <div><div className="mb-3 flex items-end justify-between px-1"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#8a958f]">Doors</p><h2 className="mt-0.5 text-[26px] font-extrabold tracking-[-.04em]">门禁</h2></div><span className="pb-1 text-xs font-semibold text-[#8a958f]">{doors.length} 个</span></div>
              {busy === "doors" && !doors.length ? <div className="grid h-48 place-items-center rounded-[26px] bg-white"><LoaderCircle className="animate-spin text-[#173f32]" /></div> : <div className="grid grid-cols-2 gap-3">{doors.map((door, index) => (
                <article key={door.id} className="min-w-0 rounded-[24px] bg-white p-2 shadow-[0_10px_30px_rgba(30,48,39,.07)]">
                  <button onClick={() => openDoor(door)} disabled={busy !== null} className={`flex aspect-square w-full flex-col items-start justify-between rounded-[19px] p-4 text-left text-white transition active:scale-[.97] disabled:opacity-55 ${index % 3 === 1 ? "bg-[#315c4d]" : index % 3 === 2 ? "bg-[#456d5e]" : "bg-[#173f32]"}`}>
                    <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-white/10">{busy === door.id ? <LoaderCircle className="animate-spin" size={21} /> : <DoorOpen size={21} />}</span>
                    <span className="min-w-0 max-w-full"><strong className="block truncate text-[17px] leading-tight">{door.name}</strong>{door.communityName && <span className="mt-1 block truncate text-xs text-white/55">{door.communityName}</span>}</span>
                  </button>
                  {door.passwordSupported && <button onClick={() => showPassword(door)} disabled={busy !== null} className="mt-1.5 flex h-10 w-full items-center justify-center gap-1.5 rounded-[14px] text-[13px] font-extrabold tabular-nums text-[#285440] disabled:opacity-40">{busy === `password:${door.id}` ? <LoaderCircle className="animate-spin" size={15} /> : passwords[door.id] ? <Copy size={14} /> : <KeyRound size={14} />}{passwordLabel(door.id)}</button>}
                </article>
              ))}</div>}
            </div>
          </div>
        )}
      </section>

      {logoutTarget && <div className="fixed inset-0 z-40 grid place-items-center bg-[#10231b]/45 p-5 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) setLogoutTarget(null); }}><section role="dialog" aria-modal="true" aria-labelledby="logout-title" className="w-full max-w-[340px] rounded-[26px] bg-white p-5 shadow-[0_30px_90px_rgba(10,28,20,.3)]"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#9a6a65]">Account</p><h2 id="logout-title" className="mt-1 text-xl font-extrabold tracking-[-.03em]">退出账号？</h2></div><button onClick={() => setLogoutTarget(null)} aria-label="取消退出" className="grid h-9 w-9 place-items-center rounded-xl bg-[#f1f3ef] text-[#5f6d66]"><X size={18} /></button></div><p className="mt-3 truncate text-sm text-[#68766f]">{logoutTarget.username}</p><div className="mt-6 grid grid-cols-2 gap-2.5"><button onClick={() => setLogoutTarget(null)} className="h-12 rounded-2xl bg-[#eef1ed] text-sm font-bold text-[#4f5f57]">取消</button><button onClick={() => logoutAccount(logoutTarget)} disabled={busy !== null} className="h-12 rounded-2xl bg-[#9f3f37] text-sm font-bold text-white disabled:opacity-50">{busy === `logout:${logoutTarget.id}` ? <LoaderCircle className="mx-auto animate-spin" size={18} /> : "确认退出"}</button></div></section></div>}
    </main>
  );
}
