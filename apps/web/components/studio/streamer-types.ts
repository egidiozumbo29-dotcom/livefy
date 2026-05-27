export type ShowMode = "PUBLIC" | "BASE" | "PRIVATE";

export type StreamObsCreds = { rtmpUrl: string; streamKey: string };

export type StreamerLiveSnapshot = {
  id: string;
  room: string | null;
  title: string;
  thumbnail: string | null;
  viewers: number;
  showMode: ShowMode;
  basePrice: number;
  privatePricePerMinute: number;
  spyPricePerMinute: number;
  chatOpen: boolean;
  isPrivate: boolean;
  category?: string | null;
  tags?: string[];
  /** True se è attiva una password di accesso viewer (hash lato server). */
  hasRoomPassword?: boolean;
  startedAt: string | null;
  obs?: StreamObsCreds | null;
};

/** Alias per compatibilita` con il codice esistente. */
export type LiveState = StreamerLiveSnapshot;
