export type UserStatus = "pending_activation" | "active" | "suspended" | "deactivated";
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
  timezone: string | null;
}

export interface LoginAccountRecord extends UserRecord {
  password_hash: string;
}

export interface SessionUserRecord extends UserRecord {
  last_code_request_date: string | null;
  last_coins_request_date: string | null;
}

export interface CoinHistoryRecord {
  id: number;
  amount: number;
  reason: string | null;
  created_date: string;
}

export interface ActivationLookupRecord {
  activation_code_id: number;
  user_id: number | null;
  consumed_date: string | null;
}

export interface ActivationUserRecord {
  id: number;
  status: UserStatus;
  activated_date: string | null;
}

export interface ActivationCodeListRecord {
  id: number;
  code: string;
  consumed_date: string | null;
  user_id: number | null;
  user_nickname: string | null;
  user_email: string | null;
  user_status: UserStatus | null;
}

export interface RoundRecord {
  id: number;
  season_key: string;
  title: string;
  date_from: string;
  date_to: string;
  description: string | null;
}

export interface MovieRecord {
  id: number;
  round_id: number;
  movie_title: string;
  poster_url: string | null;
  csfd_url: string | null;
  imdb_url: string | null;
  actual_revenue: number | null;
}

export interface CreateRoundMovieInput {
  movie_title?: string;
  poster_url?: string;
  csfd_url?: string;
  imdb_url?: string;
}

export interface CreateRoundRequestBody {
  title?: string;
  season_key?: string;
  date_from?: string;
  date_to?: string;
  description?: string;
  movies?: CreateRoundMovieInput[];
}

export interface ActivationCodeDeleteRecord {
  id: number;
  user_id: number | null;
  consumed_date: string | null;
}
