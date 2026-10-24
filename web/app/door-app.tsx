"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, DoorOpen, LoaderCircle, LogOut, Smartphone, UserRound } from "lucide-react";

type Door = { id: string; name: string; communityName?: string | null; passwordSupported?: boolean; refreshedAt: number };
type Account = { id: string; username: string };
type ApiResult<T = unknown> = { ok: boolean; message?: string; data?: T; meta?: { accountCount?: number; failedAccountCount?: number } };

async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const payload = (await response.json().catch(() => ({}))) as ApiResult<T>;
  if (!response.ok || !payload.ok) throw Object.assign(new Error(payload.message || "请求失败"), { status: response.status });
  return payload;
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
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState<boolean | null>(null);
  const [countdown, setCountdown] = useState(0);
  const openingRef = useRef(false);
  const accountIdRef = useRef(crypto.randomUUID());
  const accountCount = accounts.length;

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  async function loadDoors() {
    setBusy("doors"); setMessage("");
    try {
      const result = await request<Door[]>("/api/v1/doors");
      setDoors(result.data || []); setLoggedIn(true);
      if (result.message) setMessage(result.message);
      if (result.meta?.failedAccountCount) setMessage(`${result.meta.failedAccountCount} 个账号刷新失败，已显示其余门禁`);
      if (!result.data?.length) setMessage("账号已登录，但没有查询到可用门禁");
    } catch (error) { if (error instanceof Error && "status" in error && error.status === 401) { setLoggedIn(false); setDoors([]); } setMessage(error instanceof Error ? error.message : "门禁加载失败"); }
    finally { setBusy(null); }
  }

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
      .catch((error) => { setShowLogin(true); setMessage(error instanceof Error ? error.message : "加载失败"); })
      .finally(() => setInitialized(true));
  }, []);

  async function sendSms() {
    if (!/^1\d{10}$/.test(phone)) { setMessage("请输入正确的 11 位手机号"); return; }
    setBusy("sms"); setMessage(""); setSuccess(null);
    try {
      const result = await request(`/api/v1/accounts/${accountIdRef.current}/sms`, { method: "POST", body: JSON.stringify({ mobile: phone }) });
      setCountdown(60); setSuccess(true); setMessage(result.message || "验证码已发送");
    } catch (error) { setSuccess(false); setMessage(error instanceof Error ? error.message : "验证码发送失败"); }
    finally { setBusy(null); }
  }

  async function login(smsCode = code) {
    if (!/^1\d{10}$/.test(phone) || !/^\d{6}$/.test(smsCode) || busy !== null) return;
    setBusy("login"); setMessage(""); setSuccess(null);
    try {
      await request(`/api/v1/accounts/${accountIdRef.current}/login`, { method: "POST", body: JSON.stringify({ mobile: phone, smsCode }) });
      accountIdRef.current = crypto.randomUUID(); setPhone(""); setCode(""); setShowLogin(false); setLoggedIn(true); await loadAccounts(); await loadDoors();
    } catch (error) { setSuccess(false); setMessage(error instanceof Error ? error.message : "登录失败"); setBusy(null); }
  }

  async function logoutAccount(account: Account) {
    setBusy(`logout:${account.id}`); setMessage(""); setSuccess(null);
    try {
      const result = await request(`/api/v1/accounts/${account.id}`, { method: "DELETE" });
      const remaining = await loadAccounts();
      setSuccess(true); setMessage(result.message || `${account.username} 已退出`);
      if (!remaining.length) { setDoors([]); setShowLogin(true); }
      else await loadDoors();
    } catch (error) { setSuccess(false); setMessage(error instanceof Error ? error.message : "退出失败"); }
    finally { setBusy(null); }
  }

  async function openDoor(door: Door) {
    if (openingRef.current) return;
    openingRef.current = true;
    setBusy(door.id); setMessage(""); setSuccess(null);
    try {
      const result = await request(`/api/v1/doors/${door.id}/open`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } });
      setSuccess(true); setMessage(result.message || `${door.name} 开门请求成功`);
    } catch (error) { if (error instanceof Error && "status" in error && error.status === 401) { setLoggedIn(false); setDoors([]); } setSuccess(false); setMessage(error instanceof Error ? error.message : "开门失败"); }
    finally { openingRef.current = false; setBusy(null); }
  }

  async function showPassword(door: Door) {
    setBusy(door.id); setMessage(""); setSuccess(null);
    try {
      const result = await request<{ password: string; validUntil: string }>(`/api/v1/doors/${door.id}/password`);
      setSuccess(true); setMessage(`开门密码：${result.data?.password}（10 分钟内有效）`);
    } catch (error) { setSuccess(false); setMessage(error instanceof Error ? error.message : "获取开门密码失败"); }
    finally { setBusy(null); }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f2] px-4 py-8 text-[#18231d] sm:py-14">
      <section className="mx-auto w-full max-w-[560px]">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#146a3b] text-white shadow-sm"><DoorOpen size={23} strokeWidth={2.2} /></span>
            <h1 className="text-xl font-bold tracking-tight">OpenGate</h1>
          </div>
          {loggedIn && <button onClick={() => setShowLogin(true)} className="rounded-full bg-[#e8f3eb] px-3 py-1.5 text-xs font-semibold text-[#146a3b]">已连接 {accountCount} 个账号 · 添加</button>}
        </header>

        {!initialized ? <div className="grid h-56 place-items-center"><LoaderCircle className="animate-spin text-[#146a3b]" size={28} /></div> : !loggedIn || showLogin ? (
          <form onSubmit={(event) => event.preventDefault()} className="rounded-[28px] border border-white bg-white p-6 shadow-[0_18px_60px_rgba(28,55,39,.08)] sm:p-8">
            <div className="mb-7 flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e8f3eb] text-[#146a3b]"><Smartphone size={23} /></span><h2 className="text-2xl font-bold tracking-tight">{loggedIn ? "添加账号" : "登录"}</h2></div>
            <input autoComplete="tel" inputMode="numeric" maxLength={11} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} placeholder="请输入手机号" className="mb-5 h-13 w-full rounded-2xl border border-[#dfe5df] bg-[#fafbf9] px-4 text-base outline-none transition focus:border-[#238a52] focus:ring-4 focus:ring-[#238a52]/10" />
            <div className="flex gap-3">
              <input autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={code} onChange={(event) => { const next = event.target.value.replace(/\D/g, ""); setCode(next); if (next.length === 6) void login(next); }} placeholder="6 位验证码" className="h-14 min-w-0 flex-1 rounded-2xl border border-[#dfe5df] bg-[#fafbf9] px-4 text-lg tracking-[.18em] outline-none transition focus:border-[#238a52] focus:ring-4 focus:ring-[#238a52]/10" />
              <button type="button" disabled={busy !== null || countdown > 0} onClick={sendSms} className="min-w-28 rounded-2xl bg-[#146a3b] px-4 text-sm font-semibold text-white disabled:opacity-45">{busy === "sms" ? <LoaderCircle className="mx-auto animate-spin" size={18} /> : countdown > 0 ? `${countdown}s` : "获取验证码"}</button>
            </div>
            {busy === "login" && <div className="mt-5 flex justify-center"><LoaderCircle className="animate-spin text-[#146a3b]" size={22} /></div>}
            {loggedIn && <button type="button" onClick={() => setShowLogin(false)} className="mt-3 h-11 w-full text-sm font-semibold text-[#718078]">返回门禁列表</button>}
          </form>
        ) : (
          <div className="space-y-4">
            <section className="rounded-[24px] border border-white bg-white p-5 shadow-[0_10px_35px_rgba(28,55,39,.06)]">
              <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">已登录账号</h2><button onClick={() => setShowLogin(true)} className="text-sm font-semibold text-[#146a3b]">添加账号</button></div>
              <div className="space-y-2">{accounts.map((account) => (
                <div key={account.id} className="flex items-center gap-3 rounded-2xl bg-[#f7f9f6] px-4 py-3">
                  <UserRound size={18} className="text-[#718078]" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{account.username}</span>
                  <button onClick={() => logoutAccount(account)} disabled={busy !== null} aria-label={`退出 ${account.username}`} className="flex items-center gap-1 text-xs font-semibold text-[#a34339] disabled:opacity-40">{busy === `logout:${account.id}` ? <LoaderCircle className="animate-spin" size={15} /> : <LogOut size={15} />}退出</button>
                </div>
              ))}</div>
            </section>
            <div className="flex items-center justify-between px-1"><h2 className="text-2xl font-bold">门禁</h2><button onClick={loadDoors} disabled={busy !== null} className="text-sm font-semibold text-[#146a3b] disabled:opacity-40">刷新</button></div>
            {busy === "doors" && !doors.length ? <div className="grid h-48 place-items-center rounded-[26px] bg-white"><LoaderCircle className="animate-spin text-[#146a3b]" /></div> : doors.map((door) => (
              <div key={door.id} className="space-y-2">
                <button onClick={() => openDoor(door)} disabled={busy !== null} className="flex min-h-28 w-full items-center gap-4 rounded-[26px] bg-[#146a3b] p-6 text-left text-white shadow-[0_12px_35px_rgba(20,106,59,.2)] transition active:scale-[.98] disabled:opacity-55">
                  <DoorOpen size={30} /><span className="min-w-0 flex-1"><strong className="block truncate text-xl">{door.name}</strong>{door.communityName && <span className="mt-1 block truncate text-sm text-white/70">{door.communityName}</span>}</span>{busy === door.id && <LoaderCircle className="animate-spin" size={24} />}
                </button>
                {door.passwordSupported && <button onClick={() => showPassword(door)} disabled={busy !== null} className="h-11 w-full rounded-2xl bg-white text-sm font-semibold text-[#146a3b] disabled:opacity-40">查看密码</button>}
              </div>
            ))}
          </div>
        )}
        {message && <div role="status" className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 text-sm ${success === true ? "border-[#b9dec5] bg-[#edf8f0] text-[#155e35]" : success === false ? "border-[#f0c9c5] bg-[#fff2f0] text-[#9e2e25]" : "border-[#dfe5df] bg-white text-[#536159]"}`}>{success === true && <CheckCircle2 className="mt-0.5 shrink-0" size={18} />}<span>{message}</span></div>}
      </section>
    </main>
  );
}
