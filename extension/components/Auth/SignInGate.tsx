import type { ReactNode } from "react";
import type { AuthState } from "../../types/auth";

interface SignInGateProps {
  auth: AuthState;
  onSignIn: () => void;
  onSignOut: () => void;
  children: ReactNode;
}

export function SignInGate({ auth, onSignIn, onSignOut, children }: SignInGateProps) {
  if (auth.status === "checking") {
    return (
      <div role="status" aria-label="Checking sign-in status" className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-500"
          aria-hidden="true"
        />
      </div>
    );
  }

  if (auth.status === "signed-out") {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Sign in with Google to use this extension
        </p>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-600">
          Access is invitation-only.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          aria-label="Sign in with Google"
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  if (auth.status === "not-authorized") {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
            Access to this extension is invitation-only.
          </p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-500">
            {auth.user?.email ? `${auth.user.email} hasn't been invited yet.` : "This account hasn't been invited yet."}
          </p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Sign out"
          className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Sign out
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
