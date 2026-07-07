export interface AuthenticatedUser {
  sub: string;
  email: string;
}

export type AuthStatus = "checking" | "signed-out" | "not-authorized" | "signed-in";

export interface AuthState {
  status: AuthStatus;
  user: AuthenticatedUser | null;
}
