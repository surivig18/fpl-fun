import type {
  FplGameweek,
  FplOverview,
  FplPick,
  FplPlayer,
  FplRecommendation,
  FplRecommendations,
  FplTeam,
  FplTeamPicks,
} from "@workspace/api-zod";

const FPL_API = "https://fantasy.premierleague.com/api";

type FplBootstrap = {
  events: Array<{
    id: number;
    name: string;
    deadline_time: string;
    finished: boolean;
    is_current: boolean;
    is_next: boolean;
    average_entry_score: number | null;
    highest_score: number | null;
  }>;
  teams: Array<{ id: number; name: string; short_name: string }>;
  elements: Array<{
    id: number;
    first_name: string;
    second_name: string;
    web_name: string;
    element_type: number;
    team: number;
    now_cost: number;
    total_points: number;
    event_points: number;
    form: string;
    selected_by_percent: string;
    transfers_in_event: number;
    transfers_out_event: number;
    points_per_game: string;
    minutes: number;
    status: string;
    news: string;
    photo: string;
  }>;
  element_types: Array<{ id: number; singular_name_short: string }>;
};

type FplTeamPayload = {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  summary_overall_rank: number;
  summary_overall_points: number;
  summary_event_points: number;
  summary_event_rank: number;
  last_deadline_bank: number;
  last_deadline_value: number;
  last_deadline_total_transfers: number;
  last_deadline_total_transfers_cost: number;
  current_event: number;
};

type FplPicksPayload = {
  entry_history?: {
    event: number;
    points: number;
    event_transfers: number;
    bank: number;
    value: number;
  };
  picks: Array<{
    element: number;
    position: number;
    multiplier: number;
    is_captain: boolean;
    is_vice_captain: boolean;
    purchase_price?: number;
    selling_price?: number;
  }>;
};

type FplFixture = {
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
  finished: boolean;
  event: number | null;
};

export class FplDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FplDataError";
  }
}

async function fplFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${FPL_API}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new FplDataError("FPL team not found");
    }
    throw new FplDataError(`FPL data source returned ${response.status}`);
  }

  return (await response.json()) as T;
}

function currentGameweek(bootstrap: FplBootstrap) {
  const current =
    bootstrap.events.find((event) => event.is_current) ??
    bootstrap.events.find((event) => !event.finished) ??
    bootstrap.events.at(-1);
  const next =
    bootstrap.events.find((event) => event.is_next) ??
    bootstrap.events.find((event) => event.id > (current?.id ?? 0)) ??
    current;

  if (!current || !next) {
    throw new FplDataError("No active FPL gameweek found");
  }

  return { current, next };
}

function gameweekDto(event: FplBootstrap["events"][number]): FplGameweek {
  return {
    id: event.id,
    name: event.name,
    deadlineTime: event.deadline_time,
    finished: event.finished,
    isCurrent: event.is_current,
    isNext: event.is_next,
    averageScore: event.average_entry_score ?? undefined,
    highestScore: event.highest_score ?? undefined,
  };
}

function playerDto(
  player: FplBootstrap["elements"][number],
  bootstrap: FplBootstrap,
): FplPlayer {
  const position =
    bootstrap.element_types.find((type) => type.id === player.element_type)
      ?.singular_name_short ?? "MID";
  const teamName =
    bootstrap.teams.find((team) => team.id === player.team)?.name ?? "Unknown";
  const netTransfers = player.transfers_in_event - player.transfers_out_event;
  const form = Number(player.form) || 0;
  const ownership = Number(player.selected_by_percent) || 0;
  const pointsPerGame = Number(player.points_per_game) || 0;
  const availabilityPenalty = player.status === "a" ? 0 : 25;
  const rawChance =
    50 +
    Math.min(35, Math.max(-35, netTransfers / 5000)) +
    form * 2.5 +
    pointsPerGame * 1.5 -
    availabilityPenalty -
    (ownership > 15 ? 5 : 0);
  const priceRiseChance = Math.max(1, Math.min(99, Math.round(rawChance)));

  return {
    id: player.id,
    firstName: player.first_name,
    secondName: player.second_name,
    webName: player.web_name,
    position,
    team: player.team,
    teamName,
    price: player.now_cost / 10,
    totalPoints: player.total_points,
    eventPoints: player.event_points,
    form,
    selectedByPercent: ownership,
    transfersInEvent: player.transfers_in_event,
    transfersOutEvent: player.transfers_out_event,
    pointsPerGame,
    minutes: player.minutes,
    status: player.status,
    news: player.news,
    photo: player.photo,
    priceRiseChance,
    priceRiseLabel:
      priceRiseChance >= 75
        ? "Likely"
        : priceRiseChance >= 55
          ? "Watch"
          : "Stable",
    momentum:
      netTransfers > 10_000
        ? "Surging"
        : netTransfers > 2_000
          ? "Rising"
          : netTransfers < -5_000
            ? "Cooling"
            : "Steady",
  };
}

function fixtureText(
  teamId: number,
  eventId: number,
  fixtures: FplFixture[],
  teams: FplBootstrap["teams"],
) {
  const fixture = fixtures.find(
    (item) =>
      item.event === eventId &&
      (item.team_h === teamId || item.team_a === teamId),
  );
  if (!fixture) return "No fixture";
  const home = fixture.team_h === teamId;
  const opponent = teams.find(
    (team) => team.id === (home ? fixture.team_a : fixture.team_h),
  );
  return `${opponent?.short_name ?? "TBC"} ${home ? "(H)" : "(A)"}`;
}

async function getBootstrap() {
  return fplFetch<FplBootstrap>("/bootstrap-static/");
}

export async function getOverview(): Promise<FplOverview> {
  const bootstrap = await getBootstrap();
  const { current, next } = currentGameweek(bootstrap);
  const players = bootstrap.elements
    .map((player) => playerDto(player, bootstrap))
    .sort(
      (a, b) =>
        (b.priceRiseChance ?? 0) - (a.priceRiseChance ?? 0),
    )
    .slice(0, 24);

  return {
    currentGameweek: gameweekDto(current),
    nextGameweek: gameweekDto(next),
    players,
    updatedAt: new Date().toISOString(),
  };
}

export async function getTeam(teamId: number): Promise<FplTeam> {
  const team = await fplFetch<FplTeamPayload>(`/entry/${teamId}/`);
  return {
    id: team.id,
    name: team.name,
    managerName: `${team.player_first_name} ${team.player_last_name}`.trim(),
    overallRank: team.summary_overall_rank,
    totalPoints: team.summary_overall_points,
    gameweekPoints: team.summary_event_points,
    gameweekRank: team.summary_event_rank,
    bank: team.last_deadline_bank / 10,
    teamValue: team.last_deadline_value / 10,
    transfersMade: team.last_deadline_total_transfers,
    lastDeadline: new Date().toISOString(),
  };
}

async function getPicksPayload(teamId: number) {
  const bootstrap = await getBootstrap();
  const { current } = currentGameweek(bootstrap);
  const [team, picks] = await Promise.all([
    fplFetch<FplTeamPayload>(`/entry/${teamId}/`),
    fplFetch<FplPicksPayload>(`/entry/${teamId}/event/${current.id}/picks/`),
  ]);
  const actualPicks =
    picks.entry_history?.event === current.id
      ? picks
      : await fplFetch<FplPicksPayload>(
          `/entry/${teamId}/event/${current.id}/picks/`,
        );
  return { bootstrap, team, picks: actualPicks, event: current };
}

export async function getTeamPicks(teamId: number): Promise<FplTeamPicks> {
  const { bootstrap, picks, event } = await getPicksPayload(teamId);
  const fixtures = await fplFetch<FplFixture[]>(`/fixtures/?event=${event.id}`);
  const players = new Map(
    bootstrap.elements.map((player) => [
      player.id,
      playerDto(player, bootstrap),
    ]),
  );
  return {
    teamId,
    event: event.id,
    points:
      picks.entry_history?.points ??
      picks.picks.reduce(
        (sum, pick) => sum + (players.get(pick.element)?.eventPoints ?? 0) * pick.multiplier,
        0,
      ),
    picks: picks.picks.map((pick): FplPick => {
      const player = players.get(pick.element);
      return {
        playerId: pick.element,
        webName: player?.webName ?? "Unknown",
        position: player?.position ?? "MID",
        teamName: player?.teamName ?? "Unknown",
        price: player?.price ?? (pick.selling_price ?? 0) / 10,
        points: player?.eventPoints ?? 0,
        multiplier: pick.multiplier,
        isCaptain: pick.is_captain,
        isViceCaptain: pick.is_vice_captain,
        purchasePrice:
          typeof pick.purchase_price === "number"
            ? pick.purchase_price / 10
            : player?.price ?? 0,
        sellingPrice:
          typeof pick.selling_price === "number"
            ? pick.selling_price / 10
            : player?.price ?? 0,
        fixture: player
          ? fixtureText(
              player.team,
              event.id,
              fixtures,
              bootstrap.teams,
            )
          : "No fixture",
      };
    }),
    updatedAt: new Date().toISOString(),
  };
}

export async function getRecommendations(
  teamId: number,
): Promise<FplRecommendations> {
  const [{ bootstrap, team, picks, event }, teamPicks] = await Promise.all([
    getPicksPayload(teamId),
    getTeamPicks(teamId),
  ]);
  const fixtures = await fplFetch<FplFixture[]>(`/fixtures/?event=${event.id}`);
  const players = bootstrap.elements.map((player) => playerDto(player, bootstrap));
  const currentIds = new Set(picks.picks.map((pick) => pick.element));
  const currentPicks = teamPicks.picks;
  const freeTransfers = 1;
  const recommendations: FplRecommendation[] = [];
  const recommendedIds = new Set<number>();

  for (const pick of [...currentPicks].sort((a, b) => a.points - b.points)) {
    const alternatives = players
      .filter(
        (player) =>
          player.position === pick.position &&
          !currentIds.has(player.id) &&
          !recommendedIds.has(player.id) &&
          player.status === "a" &&
          player.price <= pick.sellingPrice + team.last_deadline_bank / 10,
      )
      .map((player) => {
        const netTransfers =
          player.transfersInEvent - player.transfersOutEvent;
        const score =
          player.form * 6 +
          (player.pointsPerGame ?? 0) * 3 +
          player.eventPoints * 1.5 +
          (player.priceRiseChance ?? 0) * 0.22 +
          Math.min(12, Math.max(-8, netTransfers / 2000));
        const fixture = fixtureText(
          player.team,
          event.id,
          fixtures,
          bootstrap.teams,
        );
        return {
          playerId: player.id,
          webName: player.webName,
          position: player.position,
          teamName: player.teamName,
          price: player.price,
          score: Number(score.toFixed(1)),
          reason:
            (player.priceRiseChance ?? 0) >= 75
              ? `Strong momentum with a ${fixture} next`
              : `Form ${player.form.toFixed(1)} and ${fixture} next`,
          priceRiseChance: player.priceRiseChance ?? 0,
          fixture,
          replaces: pick.webName,
        };
      })
      .sort((a, b) => b.score - a.score);
    if (alternatives[0]) {
      recommendations.push(alternatives[0]);
      recommendedIds.add(alternatives[0].playerId);
    }
    if (recommendations.length >= 4) break;
  }

  const watchlist = players
    .filter((player) => !currentIds.has(player.id))
    .sort(
      (a, b) =>
        (b.priceRiseChance ?? 0) - (a.priceRiseChance ?? 0) ||
        b.form - a.form,
    )
    .slice(0, 8);

  return {
    teamId,
    freeTransfers,
    recommendations,
    watchlist,
    updatedAt: new Date().toISOString(),
  };
}