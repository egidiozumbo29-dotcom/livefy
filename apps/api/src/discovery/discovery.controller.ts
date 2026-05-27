import { Controller, Get, Query } from "@nestjs/common";
import type { DiscoverySearchFilters } from "./discovery.service";
import { DiscoveryService } from "./discovery.service";

function parseTake(raw?: string): number | undefined {
  const n = raw ? Number(raw) : undefined;
  return n != null && Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function parseCouple(raw?: string): boolean | undefined {
  if (raw == null || raw === "") return undefined;
  const v = raw.trim().toLowerCase();
  if (["1", "true", "yes", "si", "on"].includes(v)) return true;
  return false;
}

@Controller("discovery")
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Get("categories")
  categories() {
    return this.discovery.categoriesList();
  }

  @Get("online-models")
  onlineModels(@Query("take") take?: string) {
    return this.discovery.creatorsOnline(parseTake(take));
  }

  @Get("trending-live")
  trendingLive(@Query("take") take?: string) {
    return this.discovery.trendingLive(parseTake(take));
  }

  @Get("recommended")
  recommended(@Query("take") take?: string) {
    return this.discovery.recommendedModels(parseTake(take));
  }

  @Get("new-models")
  newModels(@Query("take") take?: string) {
    return this.discovery.newModels(parseTake(take));
  }

  @Get("top-earners")
  topEarners(
    @Query("take") take?: string,
    @Query("windowDays") windowDays?: string,
  ) {
    const w = windowDays ? Number(windowDays) : undefined;
    return this.discovery.topEarners(parseTake(take), w);
  }

  @Get("search")
  searchAdvanced(
    @Query("q") q?: string,
    @Query("category") category?: string,
    @Query("gender") gender?: string,
    @Query("country") country?: string,
    @Query("language") language?: string,
    @Query("tag") tag?: string,
    @Query("coupleOnly") coupleOnlyRaw?: string,
    @Query("sort") sortRaw?: string,
    @Query("take") take?: string,
  ) {
    const sort =
      sortRaw === "new" || sortRaw === "followers" || sortRaw === "relevance"
        ? sortRaw
        : undefined;
    const filters: DiscoverySearchFilters = {
      q,
      category,
      gender,
      country,
      language,
      tag,
      coupleOnly: parseCouple(coupleOnlyRaw),
      sort,
      take: parseTake(take),
    };
    return this.discovery.searchAdvanced(filters);
  }
}
