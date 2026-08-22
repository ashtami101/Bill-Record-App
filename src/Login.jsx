import React, { useState } from "react";
import { FileStack, Loader2 } from "lucide-react";
import { supabase } from "./supabaseClient";

const NAVY = "#0B2540";
const TEAL = "#0E7C7B";

export default function Login() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!id || !password) {
      setError("Enter an ID and password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: id,
          password,
        });
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: id,
          password,
        });
        if (err) throw err;
        if (data?.user && !data?.session) {
          setNotice("Account created. Check your email to confirm before signing in.");
          setMode("signin");
        }
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: NAVY }}>
            <FileStack size={22} color="white" />
          </div>
          <div className="font-bold text-lg" style={{ color: NAVY }}>BillTrack Pro</div>
          <div className="text-xs text-slate-400">Contractor Bill Tracking System</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex rounded-lg bg-slate-100 p-1 mb-5">
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(""); setNotice(""); }}
              className={`flex-1 text-sm font-semibold py-2 rounded-md transition-colors ${mode === "signin" ? "bg-white shadow-sm" : "text-slate-500"}`}
              style={mode === "signin" ? { color: NAVY } : {}}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setError(""); setNotice(""); }}
              className={`flex-1 text-sm font-semibold py-2 rounded-md transition-colors ${mode === "signup" ? "bg-white shadow-sm" : "text-slate-500"}`}
              style={mode === "signup" ? { color: NAVY } : {}}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">ID</label>
              <input
                type="email"
                autoComplete="username"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]/40 focus:border-[#0E7C7B]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]/40 focus:border-[#0E7C7B]"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            {notice && (
              <div className="text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: TEAL }}
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          {mode === "signin" ? "New here? Switch to Create Account above." : "Already have an account? Switch to Sign In above."}
        </p>
      </div>
    </div>
  );
}
