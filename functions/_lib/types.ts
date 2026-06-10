export type UserStatus = "pending_activation" | "active" | "suspended";
export type UserRole = "player" | "admin";

export interface Env {
  DB: D1Database;
  SESSION_SECRET?: string;
}

export interface SessionPayload {
  userId: number;
  exp: number;
}

export interface SignupRequestBody {
  email?: string;
  nickname?: string;
  password?: string;
}

export interface LoginRequestBody {
  email?: string;
  password?: string;
}

export interface ActivateRequestBody {
  email?: string;
  code?: string;
}

export interface UserRecord {
  id: number;
  nickname: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  imf_coins_balance: number;
}

export interface LoginAccountRecord extends UserRecord {
  password_hash: string;
}

export interface ActivationLookupRecord {
  activation_code_id: number;
  user_id: number | null;
  consumed_date: string | null;
}

export interface ActivationUserRecord {
  id: number;
  status: UserStatus;
}
