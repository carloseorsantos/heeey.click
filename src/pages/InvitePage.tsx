import { useEffect, useState } from 'react';
import { Loader2, LogIn, UsersRound, XCircle } from 'lucide-react';
import { HeeeyLogo } from '../components/Logo';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useTeams } from '../hooks/useTeams';
import { InvitePreview, acceptTeamInvite, getTeamInvite } from '../lib/teams';
import { useI18n } from '../i18n';

interface InvitePageProps {
  token: string;
  onOpenTeam: (slug: string) => void;
  onBackToDashboard: () => void;
}

/** Landing page of a team invite link: preview, sign in if needed, then join */
export function InvitePage({ token, onOpenTeam, onBackToDashboard }: InvitePageProps) {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const { openAuthDialog } = useSettings();
  const { refreshTeams, setActiveTeamId } = useTeams();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = t('invite.documentTitle');
  }, [t]);

  // Reload after signing in: "already a member" and the team link depend on who is asking
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    getTeamInvite(token).then((result) => !cancelled && setInvite(result));
    return () => {
      cancelled = true;
    };
  }, [token, user?.id, authLoading]);

  async function handleAccept() {
    setJoining(true);
    setError(null);
    try {
      const team = await acceptTeamInvite(token);
      await refreshTeams();
      setActiveTeamId(team.id);
      onOpenTeam(team.slug);
    } catch {
      setError(t('invite.acceptError'));
      setJoining(false);
    }
  }

  const roleLabel = invite?.role ? t(`teams.roles.${invite.role}`) : '';
  const unusable = invite && invite.status !== 'valid' && !invite.is_member;

  return (
    <div className="min-h-full flex items-center justify-center bg-app px-4 py-12">
      <main className="w-full max-w-sm text-center">
        <HeeeyLogo className="w-12 h-12 mx-auto mb-6" />
        {!invite ? (
          <div role="status" className="flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-label-2" />
            <span className="sr-only">{t('invite.loading')}</span>
          </div>
        ) : unusable ? (
          <>
            <XCircle className="w-10 h-10 mx-auto text-label-3 mb-3" />
            <h1 className="text-xl font-semibold text-label">{t(`invite.status.${invite.status as 'expired' | 'used' | 'revoked' | 'invalid'}`)}</h1>
            <p className="mt-2 text-sm text-label-2">{t('invite.askForNew')}</p>
            <Button variant="secondary" className="mt-6" onClick={onBackToDashboard}>
              {t('invite.backToBoards')}
            </Button>
          </>
        ) : (
          <>
            <UsersRound className="w-10 h-10 mx-auto text-accent-text mb-3" />
            <h1 className="text-xl font-semibold text-label text-balance">{t('invite.title', { team: invite.team_name ?? '' })}</h1>
            <p className="mt-2 text-sm text-label-2 text-pretty">
              {invite.invited_by ? t('invite.invitedBy', { name: invite.invited_by, role: roleLabel }) : t('invite.invitedAs', { role: roleLabel })}
            </p>
            {error && (
              <p className="mt-4 text-sm text-danger-text" role="alert">
                {error}
              </p>
            )}
            <div className="mt-6 flex flex-col gap-2">
              {invite.is_member && invite.team_slug ? (
                <Button variant="primary" size="lg" onClick={() => onOpenTeam(invite.team_slug!)}>
                  {t('invite.openTeam')}
                </Button>
              ) : user ? (
                <Button variant="primary" size="lg" onClick={handleAccept} disabled={joining}>
                  {joining && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{t('invite.accept')}</span>
                </Button>
              ) : (
                <Button variant="primary" size="lg" onClick={() => openAuthDialog('login')}>
                  <LogIn className="w-4 h-4" />
                  <span>{t('invite.signInToAccept')}</span>
                </Button>
              )}
              {invite.is_member && <p className="text-xs text-label-2">{t('invite.alreadyMember')}</p>}
              {user && !invite.is_member && <p className="text-xs text-label-2">{t('invite.signedInAs', { email: user.email ?? '' })}</p>}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
