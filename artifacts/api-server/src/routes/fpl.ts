import { Router, type IRouter } from "express";
import {
  GetFplOverviewResponse,
  GetFplRecommendationsParams,
  GetFplRecommendationsResponse,
  GetFplTeamPicksParams,
  GetFplTeamPicksResponse,
  GetFplTeamParams,
  GetFplTeamResponse,
} from "@workspace/api-zod";
import {
  FplDataError,
  getOverview,
  getRecommendations,
  getTeam,
  getTeamPicks,
} from "../lib/fpl";

const router: IRouter = Router();

function parseTeamId(raw: unknown) {
  const result = Number(raw);
  return Number.isInteger(result) && result > 0 ? result : null;
}

router.get("/fpl/overview", async (req, res): Promise<void> => {
  try {
    const data = GetFplOverviewResponse.parse(await getOverview());
    res.json(data);
  } catch (error) {
    req.log.error({ err: error }, "Unable to load FPL overview");
    res.status(502).json({
      error:
        error instanceof FplDataError
          ? error.message
          : "Unable to reach the FPL data source",
    });
  }
});

router.get("/fpl/teams/:teamId", async (req, res): Promise<void> => {
  const parsed = GetFplTeamParams.safeParse(req.params);
  if (!parsed.success || !parseTeamId(parsed.data?.teamId)) {
    res.status(400).json({ error: "Team ID must be a positive integer" });
    return;
  }

  try {
    const data = GetFplTeamResponse.parse(await getTeam(parsed.data.teamId));
    res.json(data);
  } catch (error) {
    req.log.error({ err: error, teamId: parsed.data.teamId }, "Unable to load FPL team");
    res.status(error instanceof FplDataError && error.message.includes("not found") ? 404 : 502).json({
      error: error instanceof FplDataError ? error.message : "Unable to reach the FPL data source",
    });
  }
});

router.get("/fpl/teams/:teamId/picks", async (req, res): Promise<void> => {
  const parsed = GetFplTeamPicksParams.safeParse(req.params);
  if (!parsed.success || !parseTeamId(parsed.data?.teamId)) {
    res.status(400).json({ error: "Team ID must be a positive integer" });
    return;
  }

  try {
    const data = GetFplTeamPicksResponse.parse(
      await getTeamPicks(parsed.data.teamId),
    );
    res.json(data);
  } catch (error) {
    req.log.error({ err: error, teamId: parsed.data.teamId }, "Unable to load FPL picks");
    res.status(error instanceof FplDataError && error.message.includes("not found") ? 404 : 502).json({
      error: error instanceof FplDataError ? error.message : "Unable to reach the FPL data source",
    });
  }
});

router.get("/fpl/teams/:teamId/recommendations", async (req, res): Promise<void> => {
  const parsed = GetFplRecommendationsParams.safeParse(req.params);
  if (!parsed.success || !parseTeamId(parsed.data?.teamId)) {
    res.status(400).json({ error: "Team ID must be a positive integer" });
    return;
  }

  try {
    const data = GetFplRecommendationsResponse.parse(
      await getRecommendations(parsed.data.teamId),
    );
    res.json(data);
  } catch (error) {
    req.log.error({ err: error, teamId: parsed.data.teamId }, "Unable to load FPL recommendations");
    res.status(error instanceof FplDataError && error.message.includes("not found") ? 404 : 502).json({
      error: error instanceof FplDataError ? error.message : "Unable to reach the FPL data source",
    });
  }
});

export default router;