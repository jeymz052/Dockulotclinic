"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { DEFAULT_ROLE, type UserRole } from "@/src/lib/roles";
import {
  roleToUiRole,
  readRoleFromUserMetadata,
} from "@/src/lib/auth/role-mappings";
import { getSupabaseBrowserClient } from "@/src/lib/supabase/client";
import { resolveProtectedUiRole } from "@/src/lib/auth/protected-accounts";

type UserProfile = {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type PatientSnapshot = {
  id: string;
  patient_category?: "New" | "Existing" | null;
  patient_number?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  suffix_name?: string | null;
  dob?: string | null;
  gender?: string | null;
  civil_status?: string | null;
  address?: string | null;
  religion?: string | null;
  occupation?: string | null;
  guardian_name?: string | null;
};

type RoleContextValue = {
  role: UserRole;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  patient: PatientSnapshot | null;
  isLoading: boolean;
  accessToken: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const RoleContext = createContext<RoleContextValue | null>(null);

function readRoleFromUser(user: User | null): UserRole {
  return readRoleFromUserMetadata(user) ?? DEFAULT_ROLE;
}

function isEmailVerified(user: User | null) {
  return Boolean(user?.email_confirmed_at);
}

async function fetchProfileFromApi(accessToken: string): Promise<{ profile: UserProfile | null; patient: PatientSnapshot | null }> {
  const attempts = 3;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch("/api/v2/me", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) continue;
      const payload = (await res.json()) as { profile?: UserProfile | null; patient?: PatientSnapshot | null };
      const nextProfile = payload.profile;
      const nextPatient = payload.patient ?? null;
      const parsedRole = resolveProtectedUiRole(
        roleToUiRole(nextProfile?.role),
        nextProfile?.email,
      );
      if (nextProfile && parsedRole) {
        return {
          profile: {
            ...nextProfile,
            role: parsedRole,
          },
          patient: nextPatient,
        };
      }
    } catch {
      // Network timeouts can happen in local dev; retry briefly before fallback.
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
    }
  }

  return { profile: null, patient: null };
}
export function RoleProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(DEFAULT_ROLE);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [patient, setPatient] = useState<PatientSnapshot | null>(null);
  // `isLoading` is a one-shot gate that consumers (e.g. <Layout>) use to
  // decide whether to render the whole-page "Loading…" placeholder. We flip
  // it true on first mount only — after the very first session resolution it
  // STAYS false forever, even when Supabase fires TOKEN_REFRESHED on tab
  // focus or USER_UPDATED on a profile change. Re-toggling it back to true
  // would unmount every page child (booking forms, half-typed notes, modal
  // state…) every few minutes, which is what the dashboard used to do and
  // why patients lost in-progress booking drafts on tab switch.
  const [isLoading, setIsLoading] = useState(true);
  const requestSequenceRef = useRef(0);
  // Tracks whether we've completed at least one applySession() pass, so
  // subsequent auth events run as silent background updates instead of
  // toggling the global loading gate.
  const hasResolvedOnceRef = useRef(false);
  // Tracks the user id the last applySession resolved against. We use this
  // to decide whether the profile actually needs a re-fetch (true on real
  // sign-in / sign-out / user switch) or whether we can skip the network
  // round-trip (true on routine TOKEN_REFRESHED).
  const lastUserIdRef = useRef<string | null>(null);
  const profileRef = useRef<UserProfile | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function applySession(nextSession: Session | null) {
      const requestId = ++requestSequenceRef.current;
      if (!active) return;

      const nextUser = isEmailVerified(nextSession?.user ?? null) ? nextSession?.user ?? null : null;
      const nextUserId = nextUser?.id ?? null;
      const isUserChange = nextUserId !== lastUserIdRef.current;
      const isFirstResolution = !hasResolvedOnceRef.current;

      setSession(nextSession);
      setUser(nextUser);

      // Only show the global loading gate before the very first resolution.
      // Once we've resolved once, every subsequent applySession call is a
      // background revalidation — children stay mounted, drafts survive.
      if (isFirstResolution) {
        setIsLoading(true);
      }

      if (nextSession?.user && isEmailVerified(nextSession.user)) {
        const optimisticRole = readRoleFromUserMetadata(nextSession.user);
        if (optimisticRole) {
          setRole(optimisticRole);
        }

        // Skip the /api/v2/me round-trip on routine token refresh: same user,
        // we already have their profile in memory. Without this guard,
        // every TOKEN_REFRESHED event (Supabase fires one on every tab
        // focus where the access token is older than a few minutes) would
        // hit the API for nothing.
        const canSkipFetch = !isUserChange && profileRef.current !== null;
        if (!canSkipFetch) {
          const dbProfile = await fetchProfileFromApi(nextSession.access_token);
          if (!active || requestId !== requestSequenceRef.current) return;

          if (dbProfile.profile) {
            profileRef.current = dbProfile.profile;
            setProfile(dbProfile.profile);
            setPatient(dbProfile.patient);
            setRole(
              resolveProtectedUiRole(roleToUiRole(dbProfile.profile.role), dbProfile.profile.email)
              ?? optimisticRole
              ?? readRoleFromUser(nextSession.user),
            );
          } else {
            profileRef.current = null;
            setProfile(null);
            setPatient(null);
            setRole(optimisticRole ?? readRoleFromUser(nextSession.user));
          }
        }
      } else {
        if (nextSession?.user && !isEmailVerified(nextSession.user)) {
          await supabase.auth.signOut();
        }
        setRole(DEFAULT_ROLE);
        profileRef.current = null;
        setProfile(null);
        setPatient(null);
      }

      lastUserIdRef.current = nextUserId;
      hasResolvedOnceRef.current = true;
      setIsLoading(false);
    }

    void supabase.auth.getSession().then((result: { data: { session: Session | null }, error: unknown }) => {
      const { data, error } = result;
      if (!active) return;
      if (error) {
        hasResolvedOnceRef.current = true;
        setIsLoading(false);
        return;
      }
      void applySession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, nextSession: Session | null) => {
      void applySession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function refreshProfile() {
    if (!session?.access_token) return;

    const nextProfile = await fetchProfileFromApi(session.access_token);
    if (!nextProfile.profile) return;

    profileRef.current = nextProfile.profile;
    setProfile(nextProfile.profile);
    setPatient(nextProfile.patient);
    setRole(
      resolveProtectedUiRole(roleToUiRole(nextProfile.profile.role), nextProfile.profile.email)
      ?? DEFAULT_ROLE,
    );
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
  }

  return (
    <RoleContext.Provider
      value={{
        role,
        session,
        user,
        profile,
        patient,
        isLoading,
        accessToken: session?.access_token ?? null,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);

  if (!context) {
    throw new Error("useRole must be used within RoleProvider.");
  }

  return context;
}
