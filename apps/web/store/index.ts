import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";

/** Un nuovo store per istanza `Provider`: evita data race su SSR con Redux singleton. */
export function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
    },
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
