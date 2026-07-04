import { useRef, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { RedeemCodeSheet } from '../components/RedeemCodeSheet';
import { DevTools } from '../components/DevTools';
import { useProfile } from '../lib/profileContext';
import { isPremium, isDeveloper } from '../lib/profile';
import { useEffectiveDeveloper } from '../lib/devViewContext';

/** Taps on the Version row that unlock the developer role (ADR-0014). */
const DEV_UNLOCK_TAPS = 7;

/** Working version string — bump on each release. */
const APP_VERSION = '0.1.0';

const card: React.CSSProperties = {
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-card)',
  padding: 'var(--space-4)',
};

const sectionLabel: React.CSSProperties = {
  color: 'var(--text-tertiary)',
  letterSpacing: '0.06em',
};

function Rule({ heading, body }: { heading: string; body: string }) {
  return (
    <div>
      <p
        className="text-sm font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        {heading}
      </p>
      <p
        className="mt-0.5 text-sm"
        style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}
      >
        {body}
      </p>
    </div>
  );
}

/**
 * Settings tab — v1 Phase 4, backlog item 19. There is no Account
 * section: since ADR-0020 the app is single-user and local-first, with
 * profile sync handled by a bearer-secret Worker rather than a per-user
 * login, so there is nothing to sign in or out of. Theme, sound, and
 * haptics are deferred until those features exist; Restore Purchase /
 * Manage Subscription land with the StoreKit work.
 */
export function SettingsScreen() {
  const { profile, devSetProfile } = useProfile();
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [devNote, setDevNote] = useState<string | null>(null);
  // Tap count — a ref, not state: it isn't displayed, and a ref
  // increments synchronously so rapid taps all land.
  const versionTaps = useRef(0);

  // The underlying role from the profile, and the effective flag the
  // UI uses — the View-as-guest toggle (ADR-0017) flips `developer`
  // off without changing the role, so the developer can preview the
  // new-player experience.
  const isDev = isDeveloper(profile);
  const developer = useEffectiveDeveloper(isDev);

  // The Version row is the hidden developer-mode unlock — tap it
  // DEV_UNLOCK_TAPS times (ADR-0014). Honour the underlying role so a
  // developer viewing as guest doesn't double-elevate by accident.
  function tapVersion() {
    if (isDev) return;
    versionTaps.current += 1;
    if (versionTaps.current >= DEV_UNLOCK_TAPS) {
      versionTaps.current = 0;
      devSetProfile((p) => ({ ...p, role: 'developer' }));
      setDevNote('Developer mode enabled.');
    }
  }

  const premium = isPremium(profile);
  const planStatus = !premium
    ? 'Free'
    : profile.premiumExpiresAt
      ? `Premium · until ${new Date(profile.premiumExpiresAt).toLocaleDateString()}`
      : 'Premium · lifetime';

  return (
    <div>
      <ScreenHeader title="Settings" />
      <div className="flex flex-col gap-4 px-4 pt-2 pb-8">
        {/* plan */}
        <div>
          <p className="mb-2 px-1 text-xs font-semibold" style={sectionLabel}>
            TECTONIC PREMIUM
          </p>
          <div className="flex flex-col gap-3" style={card}>
            <div className="flex items-center justify-between">
              <span
                className="text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                Plan
              </span>
              <span
                className="text-sm font-medium"
                style={{
                  color: premium ? 'var(--success)' : 'var(--text-primary)',
                }}
              >
                {planStatus}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setRedeemOpen(true)}
              className="cursor-pointer py-2.5 text-sm font-medium"
              style={{
                color: 'var(--brand-600)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-button)',
              }}
            >
              Redeem a code
            </button>
          </div>
        </div>

        {/* how to play */}
        <div>
          <p className="mb-2 px-1 text-xs font-semibold" style={sectionLabel}>
            HOW TO PLAY
          </p>
          <div className="flex flex-col gap-3" style={card}>
            <Rule
              heading="Fill every cage"
              body="Each outlined cage holds the numbers 1 up to its size, once each — a three-cell cage holds 1, 2, 3."
            />
            <Rule
              heading="Keep neighbours apart"
              body="No two touching cells may share a number — not even diagonally."
            />
            <Rule
              heading="There is always a path"
              body="Every puzzle can be reasoned out one cell at a time. Stuck? The Hint button explains the next move."
            />
          </div>
        </div>

        {/* about */}
        <div>
          <p className="mb-2 px-1 text-xs font-semibold" style={sectionLabel}>
            ABOUT
          </p>
          <div className="flex flex-col gap-3" style={card}>
            <button
              type="button"
              onClick={tapVersion}
              className="flex w-full items-center justify-between"
            >
              <span
                className="text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                Version
              </span>
              <span
                className="text-sm font-medium"
                style={{
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {APP_VERSION}
              </span>
            </button>
            {devNote && (
              <p
                className="text-xs font-medium"
                style={{ color: 'var(--success)' }}
              >
                {devNote}
              </p>
            )}
            <p
              className="text-sm"
              style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}
            >
              Tectonic Legend is a logic puzzle of cages and numbers — no
              guessing, just reasoning. Your progress is saved on this device,
              and synced across your devices when sync is configured.
            </p>
          </div>
        </div>

        {developer && (
          <div>
            <p className="mb-2 px-1 text-xs font-semibold" style={sectionLabel}>
              DEVELOPER
            </p>
            <DevTools />
          </div>
        )}

        <p
          className="px-1 text-xs"
          style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}
        >
          Theme, sound, and haptics settings arrive alongside those features.
        </p>
      </div>

      <RedeemCodeSheet
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
      />
    </div>
  );
}
