import { useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BellRing,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  ExternalLink,
  Flame,
  Gauge,
  Info,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
  UserRound,
  X,
  Zap,
} from 'lucide-react';
import {
  getGetFplOverviewQueryKey,
  getGetFplRecommendationsQueryKey,
  getGetFplTeamPicksQueryKey,
  getGetFplTeamQueryKey,
  useGetFplOverview,
  useGetFplRecommendations,
  useGetFplTeam,
  useGetFplTeamPicks,
  type FplGameweek,
  type FplPick,
  type FplPlayer,
  type FplRecommendation,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import NotFound from '@/pages/not-found';
import './index.css';

const queryClient = new QueryClient();
const TEAM_ID_KEY = 'fpl-companion-team-id';

function readTeamId() {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(TEAM_ID_KEY);
  const parsed = value ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function formatNumber(value: number | undefined) {
  return typeof value === 'number' ? new Intl.NumberFormat('en-GB').format(value) : '—';
}

function formatMoney(value: number | undefined) {
  return typeof value === 'number' ? `£${value.toFixed(1)}m` : '—';
}

function formatUpdated(value?: string) {
  if (!value) return 'Awaiting first sync';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return `Updated ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

function getCountdown(deadline?: string) {
  if (!deadline) return 'Deadline pending';
  const distance = new Date(deadline).getTime() - Date.now();
  if (distance <= 0) return 'Deadline passed';
  const days = Math.floor(distance / 86400000);
  const hours = Math.floor((distance % 86400000) / 3600000);
  const minutes = Math.floor((distance % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h to deadline`;
  return `${hours}h ${minutes}m to deadline`;
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-[hsl(var(--muted))] ${className}`} />;
}

function EmptyState({
  icon: Icon,
  title,
  detail,
  action,
}: {
  icon: typeof Search;
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-[hsl(var(--border))] px-6 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--primary))]">
        <Icon size={18} />
      </div>
      <p className="font-display text-sm font-semibold text-[hsl(var(--foreground))]">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-[hsl(var(--muted-foreground))]">{detail}</p>
      {action}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="font-mono-custom text-[10px] font-medium uppercase tracking-[.18em] text-[hsl(var(--primary))]">{eyebrow}</p>
        <h2 className="mt-1 font-display text-xl font-semibold tracking-[-.03em] text-[hsl(var(--foreground))]">{title}</h2>
        {detail && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

function PlayerAvatar({ player, size = 'md' }: { player: Pick<FplPlayer, 'webName' | 'photo'>; size?: 'sm' | 'md' }) {
  const [failed, setFailed] = useState(false);
  const dimension = size === 'sm' ? 'size-8' : 'size-10';
  return (
    <div className={`${dimension} relative shrink-0 overflow-hidden rounded-full bg-[hsl(var(--secondary))] text-center text-[10px] font-bold leading-10 text-[hsl(var(--primary))]`}>
      {!failed && player.photo ? (
        <img
          src={player.photo}
          alt=""
          className="size-full object-cover object-top"
          onError={() => setFailed(true)}
        />
      ) : initials(player.webName)}
    </div>
  );
}

function GameweekCard({ gameweek, next }: { gameweek: FplGameweek; next?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 ${next ? 'bg-[hsl(var(--secondary))]' : 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'}`}>
      <div className={`absolute -right-9 -top-10 size-32 rounded-full border-[18px] ${next ? 'border-[hsl(var(--border))]' : 'border-[hsl(var(--primary-foreground)/.1)]'}`} />
      <div className="relative z-[1] flex items-start justify-between">
        <div>
          <p className={`font-mono-custom text-[10px] uppercase tracking-[.18em] ${next ? 'text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--primary-foreground)/.65)]'}`}>
            {next ? 'Up next' : 'Live gameweek'}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold tracking-[-.06em]">{gameweek.name}</p>
        </div>
        <div className={`flex size-9 items-center justify-center rounded-full ${next ? 'bg-[hsl(var(--card))] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--primary-foreground)/.12)]'}`}>
          {next ? <Clock3 size={17} /> : <Activity size={17} />}
        </div>
      </div>
      <div className={`relative z-[1] mt-8 flex items-end justify-between text-xs ${next ? 'text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--primary-foreground)/.7)]'}`}>
        <div>
          <p>Deadline</p>
          <p className={`mt-1 font-mono-custom text-sm ${next ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--primary-foreground))]'}`}>
            {new Date(gameweek.deadlineTime).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {new Date(gameweek.deadlineTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <span className={`rounded-full px-2 py-1 font-mono-custom text-[10px] ${next ? 'bg-[hsl(var(--card))] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--primary-foreground)/.12)]'}`}>{getCountdown(gameweek.deadlineTime)}</span>
      </div>
    </div>
  );
}

function PickRow({ pick }: { pick: FplPick }) {
  return (
    <div className="group grid grid-cols-[minmax(150px,1.4fr)_70px_70px_1fr] items-center gap-3 border-b border-[hsl(var(--border))] py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${pick.isCaptain ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]'}`}>
          {pick.isCaptain ? 'C' : pick.isViceCaptain ? 'VC' : pick.position.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">{pick.webName}</p>
          <p className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">{pick.teamName} · {pick.fixture}</p>
        </div>
      </div>
      <p className="text-right font-mono-custom text-xs text-[hsl(var(--muted-foreground))]">{formatMoney(pick.price)}</p>
      <p className="text-right font-mono-custom text-sm font-medium text-[hsl(var(--foreground))]">{pick.points * pick.multiplier}</p>
      <div className="hidden justify-end gap-2 text-[10px] text-[hsl(var(--muted-foreground))] sm:flex">
        <span>{pick.multiplier}x</span>
        <span className="opacity-0 transition-opacity group-hover:opacity-100">{formatMoney(pick.sellingPrice)}</span>
      </div>
    </div>
  );
}

function WatchItem({ player }: { player: FplPlayer }) {
  const chance = player.priceRiseChance ?? 0;
  const positive = chance >= 70;
  return (
    <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] py-3 last:border-0">
      <PlayerAvatar player={player} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">{player.webName}</p>
          <span className={`shrink-0 font-mono-custom text-xs font-medium ${positive ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'}`}>{chance}%</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">{player.teamName} · {formatMoney(player.price)}</p>
          <p className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">{player.priceRiseLabel || player.momentum || 'Market watch'}</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 font-mono-custom text-[9px] text-[hsl(var(--muted-foreground))]">
          <span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5">xGI/90 {player.expectedGoalInvolvementsPer90.toFixed(2)}</span>
          <span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5">Run {player.fixtureRunDifficulty.toFixed(1)}/5</span>
          <span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5">{player.chanceOfPlayingNextRound}% available</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
          <div className={`h-full rounded-full ${positive ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--primary))]'}`} style={{ width: `${Math.min(100, Math.max(5, chance))}%` }} />
        </div>
      </div>
    </div>
  );
}

function RecommendationItem({ item, index }: { item: FplRecommendation; index: number }) {
  return (
    <div className="relative border-b border-[hsl(var(--border))] py-4 last:border-0">
      <div className="flex items-start gap-3">
        <span className="font-mono-custom text-[10px] text-[hsl(var(--muted-foreground))]">0{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{item.webName}</p>
              <p className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{item.teamName} · {item.fixture}</p>
            </div>
            <span className="rounded-md bg-[hsl(var(--primary)/.1)] px-2 py-1 font-mono-custom text-[10px] font-medium text-[hsl(var(--primary))]">{item.score.toFixed(1)}</span>
          </div>
          <p className="mt-3 text-xs leading-5 text-[hsl(var(--foreground)/.72)]">{item.reason}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[hsl(var(--muted-foreground))]">
            {item.replaces && <span className="flex items-center gap-1"><ArrowUpRight size={12} className="text-[hsl(var(--accent))]" /> For {item.replaces}</span>}
            <span className="flex items-center gap-1"><TrendingUp size={12} className="text-[hsl(var(--primary))]" /> {item.priceRiseChance}% rise chance</span>
            <span>{formatMoney(item.price)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamSetup({ currentId, onSave, onClose }: { currentId: number | null; onSave: (id: number) => void; onClose?: () => void }) {
  const [value, setValue] = useState(currentId ? String(currentId) : '');
  const [error, setError] = useState('');
  const save = () => {
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1) {
      setError('Enter a valid numeric team ID.');
      return;
    }
    window.localStorage.setItem(TEAM_ID_KEY, String(id));
    onSave(id);
  };
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[0_16px_50px_hsl(var(--primary)/.06)]">
      <div className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full border-[24px] border-[hsl(var(--secondary))]" />
      {onClose && <button type="button" aria-label="Close team editor" data-testid="button-close-team-editor" onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><X size={16} /></button>}
      <div className="relative max-w-xl">
        <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Command size={20} /></div>
        <p className="font-mono-custom text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">Personalise your board</p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-.045em] text-[hsl(var(--foreground))]">Bring your squad into focus.</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-[hsl(var(--muted-foreground))]">Enter your official FPL team ID to see live picks, manager context, and transfer ideas built around your squad.</p>
        <div className="mt-5 flex max-w-md flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="team-id">FPL team ID</label>
          <input
            id="team-id"
            inputMode="numeric"
            value={value}
            onChange={(event) => { setValue(event.target.value.replace(/\D/g, '')); setError(''); }}
            onKeyDown={(event) => { if (event.key === 'Enter') save(); }}
            placeholder="e.g. 4829017"
            data-testid="input-team-id"
            className="h-11 flex-1 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 font-mono-custom text-sm outline-none transition-shadow placeholder:text-[hsl(var(--muted-foreground))] focus:ring-2 focus:ring-[hsl(var(--ring)/.25)]"
          />
          <button type="button" onClick={save} data-testid="button-save-team-id" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-transform hover:-translate-y-0.5 active:translate-y-0">
            {currentId ? 'Update board' : 'Connect team'} <ChevronRight size={16} />
          </button>
        </div>
        {error && <p className="mt-2 flex items-center gap-1 text-xs text-[hsl(var(--destructive))]"><Info size={13} />{error}</p>}
        <p className="mt-4 text-[11px] text-[hsl(var(--muted-foreground))]">Find it in the URL of your FPL points page. Your ID stays on this device.</p>
      </div>
    </div>
  );
}

function Dashboard() {
  const queryClient = useQueryClient();
  const [teamId, setTeamId] = useState<number | null>(() => readTeamId());
  const [editingTeam, setEditingTeam] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const queryTeamId = teamId ?? 0;
  const overviewQuery = useGetFplOverview({ query: { queryKey: getGetFplOverviewQueryKey() } });
  const teamQuery = useGetFplTeam(queryTeamId, { query: { enabled: Boolean(teamId), queryKey: getGetFplTeamQueryKey(queryTeamId) } });
  const picksQuery = useGetFplTeamPicks(queryTeamId, { query: { enabled: Boolean(teamId), queryKey: getGetFplTeamPicksQueryKey(queryTeamId) } });
  const recommendationsQuery = useGetFplRecommendations(queryTeamId, { query: { enabled: Boolean(teamId), queryKey: getGetFplRecommendationsQueryKey(queryTeamId) } });
  const overview = overviewQuery.data;
  const team = teamQuery.data;
  const picks = picksQuery.data;
  const recommendations = recommendationsQuery.data;
  const isRefreshing = overviewQuery.isFetching || teamQuery.isFetching || picksQuery.isFetching || recommendationsQuery.isFetching;
  const currentWeek = overview?.currentGameweek;
  const watchlist = useMemo(() => recommendations?.watchlist?.slice(0, 5) ?? overview?.players?.filter((player) => (player.priceRiseChance ?? 0) >= 60).slice(0, 5) ?? [], [overview?.players, recommendations?.watchlist]);
  const marketLeaders = useMemo(() => overview?.players?.slice().sort((a, b) => (b.transfersInEvent - b.transfersOutEvent) - (a.transfersInEvent - a.transfersOutEvent)).slice(0, 3) ?? [], [overview?.players]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetFplOverviewQueryKey() });
    if (teamId) {
      queryClient.invalidateQueries({ queryKey: getGetFplTeamQueryKey(teamId) });
      queryClient.invalidateQueries({ queryKey: getGetFplTeamPicksQueryKey(teamId) });
      queryClient.invalidateQueries({ queryKey: getGetFplRecommendationsQueryKey(teamId) });
    }
  };

  const saveTeam = (id: number) => {
    setTeamId(id);
    setEditingTeam(false);
  };

  return (
    <div className="grain min-h-[100dvh] bg-[hsl(var(--background))]">
      <header className="sticky top-0 z-20 border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/.93)] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between px-5 lg:px-10">
          <div className="flex items-center gap-8">
            <button type="button" onClick={() => setMobileMenu((open) => !open)} data-testid="button-mobile-menu" className="rounded-lg p-2 text-[hsl(var(--foreground))] md:hidden"><Menu size={20} /></button>
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Command size={18} /></div>
              <div>
                <p className="font-display text-[15px] font-bold tracking-[-.03em] text-[hsl(var(--foreground))]">matchday<span className="text-[hsl(var(--accent))]">.</span></p>
                <p className="font-mono-custom text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">FPL command centre</p>
              </div>
            </div>
            <nav className={`${mobileMenu ? 'absolute left-0 right-0 top-[72px] flex border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4' : 'hidden'} items-center gap-1 md:static md:flex md:border-0 md:bg-transparent md:p-0`}>
              <button type="button" data-testid="button-nav-live-board" className="rounded-lg bg-[hsl(var(--muted))] px-3 py-2 text-xs font-semibold text-[hsl(var(--foreground))]">Live board</button>
              <button type="button" onClick={() => setEditingTeam(true)} data-testid="button-nav-my-team" className="rounded-lg px-3 py-2 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]">My team</button>
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-[10px] text-[hsl(var(--muted-foreground))] sm:flex">
              <span className={`size-1.5 rounded-full ${isRefreshing ? 'animate-pulse-soft bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--primary))]'}`} />
              {isRefreshing ? 'Syncing live data' : formatUpdated(overview?.updatedAt)}
            </span>
            <button type="button" onClick={refresh} disabled={isRefreshing} data-testid="button-refresh-data" className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] transition-transform hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] disabled:opacity-40">
              <RefreshCw size={17} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <button type="button" onClick={() => setEditingTeam(true)} data-testid="button-open-team-editor" className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-2 text-xs font-semibold text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary)/.35)]">
              <UserRound size={15} className="text-[hsl(var(--primary))]" /><span className="hidden sm:inline">{teamId ? `Team ${teamId}` : 'Set team ID'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-5 py-8 lg:px-10 lg:py-10">
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="animate-rise">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-[hsl(var(--primary))]"><span className="size-2 rounded-full bg-[hsl(var(--accent))]" /> Saturday, matchday {currentWeek ? `· ${currentWeek.name}` : ''}</div>
            <h1 className="max-w-2xl font-display text-4xl font-semibold leading-[.98] tracking-[-.065em] text-[hsl(var(--foreground))] sm:text-5xl">Everything you need.<br /><span className="text-[hsl(var(--primary))]">Nothing you don’t.</span></h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-[hsl(var(--muted-foreground))]">A composed view of your gameweek, the market’s next move, and the transfer decisions worth making before the whistle.</p>
          </div>
          <div className="animate-rise delay-1 flex items-center gap-3 self-start md:self-end">
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
              <p className="font-mono-custom text-[9px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Your next move</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--foreground))]"><Zap size={15} className="text-[hsl(var(--accent))]" /> {teamId ? `${recommendations?.freeTransfers ?? '—'} free transfer${recommendations?.freeTransfers === 1 ? '' : 's'}` : 'Connect your team'}</p>
            </div>
          </div>
        </div>

        {overviewQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-44" /><Skeleton className="h-44" /></div>
        ) : overviewQuery.isError ? (
          <div className="rounded-2xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.05)] p-6"><div className="flex items-start gap-3"><div className="flex size-9 items-center justify-center rounded-lg bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]"><Activity size={18} /></div><div><p className="font-semibold text-[hsl(var(--foreground))]">The live feed is taking a breather.</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">We couldn’t load the current FPL data. Try the connection again.</p><button type="button" onClick={() => overviewQuery.refetch()} data-testid="button-retry-overview" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-semibold text-[hsl(var(--primary-foreground))]">Retry feed <RefreshCw size={13} /></button></div></div></div>
        ) : overview ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="animate-rise delay-1"><GameweekCard gameweek={overview.currentGameweek} /></div>
            <div className="animate-rise delay-2"><GameweekCard gameweek={overview.nextGameweek} next /></div>
          </div>
        ) : (
          <EmptyState icon={Activity} title="No gameweek feed yet" detail="The market feed will appear here once the FPL connection is available." />
        )}

        {editingTeam && (
          <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-[hsl(var(--foreground)/.2)] p-5 pt-[12vh] backdrop-blur-sm">
            <div className="w-full max-w-2xl animate-rise"><TeamSetup currentId={teamId} onSave={saveTeam} onClose={() => setEditingTeam(false)} /></div>
          </div>
        )}

        <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
          <section className="animate-rise delay-2">
            <SectionHeading eyebrow="Manager view" title={team ? team.name : 'Your team, at a glance'} detail={team ? `Managed by ${team.managerName}` : 'Connect your FPL team to unlock the personal view'} action={team ? <button type="button" onClick={() => setEditingTeam(true)} data-testid="button-edit-team-inline" className="flex items-center gap-1 text-xs font-semibold text-[hsl(var(--primary))]">Edit ID <Settings2 size={13} /></button> : undefined} />
            {teamQuery.isError ? (
              <div className="rounded-xl border border-[hsl(var(--destructive)/.22)] bg-[hsl(var(--card))] p-5 text-sm"><p className="font-semibold">We couldn’t find team {teamId}.</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Check the ID and connect again.</p><button type="button" onClick={() => setEditingTeam(true)} data-testid="button-fix-team-id" className="mt-3 text-xs font-semibold text-[hsl(var(--primary))]">Edit team ID <ChevronRight size={13} className="inline" /></button></div>
            ) : teamQuery.isLoading && teamId ? (
              <div className="grid gap-3 sm:grid-cols-4">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-[108px]" />)}</div>
            ) : team ? (
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { label: 'GW points', value: formatNumber(team.gameweekPoints), icon: Activity, color: 'primary' },
                  { label: 'Overall rank', value: formatNumber(team.overallRank), icon: Trophy, color: 'accent' },
                  { label: 'Total points', value: formatNumber(team.totalPoints), icon: BarChart3, color: 'primary' },
                  { label: 'Bank', value: formatMoney(team.bank), icon: Gauge, color: 'accent' },
                ].map((stat) => (
                  <div key={stat.label} data-testid={`stat-${stat.label.toLowerCase().replace(' ', '-')}`} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition-transform hover:-translate-y-0.5">
                    <div className="flex items-center justify-between"><p className="text-[11px] text-[hsl(var(--muted-foreground))]">{stat.label}</p><stat.icon size={14} className={stat.color === 'accent' ? 'text-[hsl(var(--accent))]' : 'text-[hsl(var(--primary))]'} /></div>
                    <p className="mt-4 font-display text-2xl font-semibold tracking-[-.05em]">{stat.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <TeamSetup currentId={teamId} onSave={saveTeam} />
            )}
          </section>
          <section className="animate-rise delay-3">
            <SectionHeading eyebrow="Squad signal" title="Market pulse" detail="The players moving fastest this gameweek" />
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4">
              {overviewQuery.isLoading ? [1, 2, 3].map((item) => <Skeleton key={item} className="my-3 h-10" />) : marketLeaders.length > 0 ? marketLeaders.map((player) => <div key={player.id} className="flex items-center gap-3 border-b border-[hsl(var(--border))] py-3 last:border-0"><div className="flex size-7 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Flame size={14} /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{player.webName}</p><p className="text-[10px] text-[hsl(var(--muted-foreground))]">{player.teamName} · {player.form.toFixed(1)} form</p></div><span className="flex items-center gap-1 font-mono-custom text-[11px] text-[hsl(var(--primary))]"><ArrowUpRight size={12} />{formatNumber(player.transfersInEvent - player.transfersOutEvent)}</span></div>) : <EmptyState icon={TrendingUp} title="No market movement yet" detail="Signals appear when the first player data arrives." />}
            </div>
          </section>
        </div>

        <div className="mt-12 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,.85fr)]">
          <section className="animate-rise delay-3">
            <SectionHeading eyebrow="The XI" title={picks ? `Current picks · GW${picks.event}` : 'Current picks'} detail={picks ? `${picks.points} points in the current gameweek` : 'Your starting squad, with captaincy clearly marked'} action={picks ? <span className="font-mono-custom text-[10px] text-[hsl(var(--muted-foreground))]">{formatUpdated(picks.updatedAt)}</span> : undefined} />
            <div className="overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
              <div className="hidden grid-cols-[minmax(150px,1.4fr)_70px_70px_1fr] gap-3 border-b border-[hsl(var(--border))] px-4 py-2.5 text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))] sm:grid"><span>Player</span><span className="text-right">Price</span><span className="text-right">Points</span><span className="text-right">Role</span></div>
              <div className="px-4">
                {picksQuery.isLoading && teamId ? [1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="my-3 h-10" />) : picksQuery.isError ? <div className="py-8 text-center"><p className="text-sm font-semibold">Picks are unavailable.</p><button type="button" onClick={() => picksQuery.refetch()} data-testid="button-retry-picks" className="mt-2 text-xs font-semibold text-[hsl(var(--primary))]">Retry picks</button></div> : picks?.picks?.length ? picks.picks.map((pick) => <PickRow key={pick.playerId} pick={pick} />) : <EmptyState icon={UserRound} title="No picks to show" detail={teamId ? 'Your current squad has not arrived yet.' : 'Connect your team ID to see the XI you sent out.'} action={!teamId ? <button type="button" onClick={() => setEditingTeam(true)} data-testid="button-connect-from-picks" className="mt-4 text-xs font-semibold text-[hsl(var(--primary))]">Connect team <ChevronRight size={13} className="inline" /></button> : undefined} />}
              </div>
            </div>
          </section>
          <section className="animate-rise delay-4">
            <SectionHeading eyebrow="Early warning" title="Price-rise watch" detail="Quiet signals before the market catches up" action={<BellRing size={16} className="text-[hsl(var(--accent))]" />} />
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4">
              {recommendationsQuery.isLoading && teamId ? [1, 2, 3].map((item) => <Skeleton key={item} className="my-3 h-14" />) : recommendationsQuery.isError ? <div className="py-8 text-center"><p className="text-sm font-semibold">Watchlist unavailable.</p><button type="button" onClick={() => recommendationsQuery.refetch()} data-testid="button-retry-watchlist" className="mt-2 text-xs font-semibold text-[hsl(var(--primary))]">Retry watchlist</button></div> : watchlist.length ? watchlist.map((player) => <WatchItem key={player.id} player={player} />) : <EmptyState icon={BellRing} title="No watchlist yet" detail={teamId ? 'Price signals will appear as the market develops.' : 'Connect a team to get a personalised watchlist.'} />}
            </div>
          </section>
        </div>

        <section className="mt-12 animate-rise delay-4">
          <SectionHeading eyebrow="Decision support" title="Transfers worth a look" detail={recommendations ? `Based on ${recommendations.freeTransfers} free transfer${recommendations.freeTransfers === 1 ? '' : 's'} and the next fixture run` : 'Clear, explainable suggestions — never a black box'} action={recommendations && <span className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]"><ShieldCheck size={13} className="text-[hsl(var(--primary))]" /> Explainable signals</span>} />
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 sm:px-6">
            {recommendationsQuery.isLoading && teamId ? [1, 2].map((item) => <Skeleton key={item} className="my-4 h-28" />) : recommendationsQuery.isError ? <div className="py-10 text-center"><p className="text-sm font-semibold">Transfer ideas are unavailable right now.</p><button type="button" onClick={() => recommendationsQuery.refetch()} data-testid="button-retry-recommendations" className="mt-2 text-xs font-semibold text-[hsl(var(--primary))]">Retry recommendations</button></div> : recommendations?.recommendations?.length ? <div className="grid gap-x-8 md:grid-cols-2">{recommendations.recommendations.slice(0, 6).map((item, index) => <RecommendationItem key={`${item.playerId}-${index}`} item={item} index={index} />)}</div> : <div className="py-3"><EmptyState icon={Sparkles} title={teamId ? 'No transfer moves flagged' : 'Your next move starts here'} detail={teamId ? 'The model is happy with your current squad for now.' : 'Connect your team and we’ll keep the noise out of your decision-making.'} action={!teamId ? <button type="button" onClick={() => setEditingTeam(true)} data-testid="button-connect-from-recommendations" className="mt-4 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-semibold text-[hsl(var(--primary-foreground))]">Connect your team</button> : undefined} /></div>}
          </div>
        </section>

        <footer className="mt-14 flex flex-col justify-between gap-3 border-t border-[hsl(var(--border))] py-6 text-[10px] text-[hsl(var(--muted-foreground))] sm:flex-row sm:items-center">
          <p className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-[hsl(var(--primary))]" /> Data from the official FPL feed · {formatUpdated(overview?.updatedAt)}</p>
          <div className="flex items-center gap-4"><button type="button" data-testid="button-help" className="flex items-center gap-1 hover:text-[hsl(var(--foreground))]"><CircleHelp size={13} /> How it works</button><button type="button" onClick={() => setEditingTeam(true)} data-testid="button-footer-settings" className="flex items-center gap-1 hover:text-[hsl(var(--foreground))]"><Settings2 size={13} /> Team settings</button></div>
        </footer>
      </main>
    </div>
  );
}

function Router() {
  return (
    <ErrorBoundary>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
