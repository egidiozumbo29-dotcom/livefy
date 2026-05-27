import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type Role = "VIEWER" | "MODEL" | "ADMIN" | "MODERATOR";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  role: Role;
  balance: number;
  /** Guadagni netti creator (token), convertibili in payout. */
  creatorBalance?: number;
  avatarUrl?: string | null;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
};

const initialState: AuthState = {
  token: null,
  user: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{ token: string; user: AuthUser }>
    ) {
      state.token = action.payload.token;
      state.user = action.payload.user;
    },
    updateBalance(state, action: PayloadAction<number>) {
      if (state.user) state.user.balance = action.payload;
    },
    logout(state) {
      state.token = null;
      state.user = null;
    },
  },
});

export const { setCredentials, updateBalance, logout } = authSlice.actions;
export default authSlice.reducer;
