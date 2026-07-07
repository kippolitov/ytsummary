import { useCallback, useEffect, useState } from "react";
import {
  getStoredAuth,
  signIn as authClientSignIn,
  signInSilently,
  signOut as authClientSignOut,
  type StoredAuth,
} from "../services/authClient";
import type { AuthState } from "../types/auth";

const CHECKING_STATE: AuthState = { status: "checking", user: null };

function toAuthState(stored: StoredAuth | null): AuthState {
  if (!stored) return { status: "signed-out", user: null };
  if (stored.authorizationStatus === "not-authorized") {
    return { status: "not-authorized", user: stored.user };
  }
  return { status: "signed-in", user: stored.user };
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(CHECKING_STATE);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const stored = await getStoredAuth();
      if (stored && stored.expiresAt > Date.now()) {
        if (!cancelled) setState(toAuthState(stored));
        return;
      }
      const user = await signInSilently();
      if (cancelled) return;
      if (user) {
        const refreshed = await getStoredAuth();
        setState(toAuthState(refreshed));
      } else {
        setState({ status: "signed-out", user: null });
      }
    }
    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName !== "local") return;
      if (!("ytsummary_auth" in changes)) return;
      void getStoredAuth().then((stored) => setState(toAuthState(stored)));
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const signIn = useCallback(async () => {
    try {
      await authClientSignIn();
      const stored = await getStoredAuth();
      setState(toAuthState(stored));
    } catch {
      setState({ status: "signed-out", user: null });
    }
  }, []);

  const signOut = useCallback(async () => {
    await authClientSignOut();
    setState({ status: "signed-out", user: null });
  }, []);

  return { ...state, signIn, signOut };
}
