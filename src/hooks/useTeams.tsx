import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { Project, Team, ensurePersonalTeam, fetchMyTeams, fetchProjects } from '../lib/teams';

const LAST_TEAM_KEY = 'heeey_last_team';

interface TeamsContextValue {
  /** Teams the signed-in user belongs to (personal first) */
  teams: Team[];
  /** False for guests and while the database has no teams yet */
  available: boolean;
  loading: boolean;
  /** Team shown in the dashboard and in Settings › Team */
  activeTeam: Team | null;
  setActiveTeamId: (teamId: string) => void;
  refreshTeams: () => Promise<Team[]>;
  /** Projects of the active team that the user can see */
  projects: Project[];
  refreshProjects: () => Promise<void>;
}

const TeamsContext = createContext<TeamsContextValue | null>(null);

function readLastTeam(): string | null {
  try {
    return localStorage.getItem(LAST_TEAM_KEY);
  } catch {
    return null;
  }
}

function saveLastTeam(teamId: string) {
  try {
    localStorage.setItem(LAST_TEAM_KEY, teamId);
  } catch {
    // Storage unavailable: the personal team is shown next time
  }
}

export function TeamsProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [available, setAvailable] = useState(false);
  // Until the session and the teams are known, screens wait instead of loading the wrong scope
  const [loading, setLoading] = useState(true);
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(readLastTeam);
  const [projects, setProjects] = useState<Project[]>([]);

  const refreshTeams = useCallback(async () => {
    const result = await fetchMyTeams();
    setTeams(result || []);
    setAvailable(result !== null && result.length > 0);
    return result || [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!user?.id) {
      setTeams([]);
      setProjects([]);
      setAvailable(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    // The personal team is created on sign-up; this also covers accounts where that failed
    // and activates invites to boards shared with this e-mail
    ensurePersonalTeam()
      .then(() => fetchMyTeams())
      .then((result) => {
        if (cancelled) return;
        setTeams(result || []);
        setAvailable(result !== null && result.length > 0);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading]);

  const activeTeam = useMemo(
    () => teams.find((team) => team.id === activeTeamId) ?? teams.find((team) => team.is_personal) ?? teams[0] ?? null,
    [teams, activeTeamId]
  );

  const setActiveTeamId = useCallback((teamId: string) => {
    setActiveTeamIdState(teamId);
    saveLastTeam(teamId);
  }, []);

  const refreshProjects = useCallback(async () => {
    if (!activeTeam) return;
    const result = await fetchProjects(activeTeam.id);
    if (result) setProjects(result);
  }, [activeTeam]);

  useEffect(() => {
    let cancelled = false;
    setProjects([]);
    if (!activeTeam) return;
    fetchProjects(activeTeam.id).then((result) => {
      if (!cancelled && result) setProjects(result);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTeam?.id]);

  const value = useMemo(
    () => ({ teams, available, loading, activeTeam, setActiveTeamId, refreshTeams, projects, refreshProjects }),
    [teams, available, loading, activeTeam, setActiveTeamId, refreshTeams, projects, refreshProjects]
  );

  return <TeamsContext.Provider value={value}>{children}</TeamsContext.Provider>;
}

export function useTeams(): TeamsContextValue {
  const context = useContext(TeamsContext);
  if (!context) throw new Error('useTeams must be used inside TeamsProvider');
  return context;
}
