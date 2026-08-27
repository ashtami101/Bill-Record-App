import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import SetNewPassword from "./SetNewPassword";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "PASSWORD_RECOVERY") {
        // Someone arrived via a "reset your password" email link. Supabase
        // has already signed them in (that's how the link works), but they
        // should set a new password before going anywhere else.
        setRecovering(true);
      }
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
        Loading…
      </div>
    );
  }

  if (recovering) {
    return <SetNewPassword onDone={() => setRecovering(false)} />;
  }

  if (!session) {
    return <Login />;
  }

  return children(session);
}
