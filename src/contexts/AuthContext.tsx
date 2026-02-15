import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { toast } from "sonner";
import { isFirebaseConfigured } from "@/integrations/firebase/client";
import { authService } from "@/services/firebase/authService";

export interface AuthSession {
  userId: string;
  email: string | null;
  emailVerified: boolean;
  idToken: string | null;
}

export interface AuthUser {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
}

interface AuthContextType {
  session: AuthSession | null;
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const mapFirebaseUser = (user: FirebaseUser): AuthUser => ({
  id: user.uid,
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
  phoneNumber: user.phoneNumber,
  emailVerified: user.emailVerified,
});

const buildSession = async (user: FirebaseUser): Promise<AuthSession> => ({
  userId: user.uid,
  email: user.email,
  emailVerified: user.emailVerified,
  idToken: await user.getIdToken(),
});

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuthState = useCallback(() => {
    setSession(null);
    setUser(null);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!isFirebaseConfigured) {
      clearAuthState();
      return;
    }

    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        clearAuthState();
        return;
      }

      await currentUser.reload();
      const refreshedUser = authService.getCurrentUser();

      if (!refreshedUser) {
        clearAuthState();
        return;
      }

      setUser(mapFirebaseUser(refreshedUser));
      setSession(await buildSession(refreshedUser));
    } catch (error) {
      clearAuthState();
      console.error("Failed to refresh Firebase session:", error);
    }
  }, [clearAuthState]);

  const signOut = useCallback(async () => {
    try {
      if (isFirebaseConfigured) {
        await authService.logout();
      }
    } catch (error) {
      console.error("Firebase sign out failed:", error);
    } finally {
      clearAuthState();
      toast.success("Signed out successfully");
    }
  }, [clearAuthState]);

  useEffect(() => {
    let mounted = true;

    if (!isFirebaseConfigured) {
      setIsLoading(false);
      return;
    }

    const initialUser = authService.getCurrentUser();
    if (initialUser) {
      setUser(mapFirebaseUser(initialUser));
      buildSession(initialUser)
        .then((nextSession) => {
          if (mounted) {
            setSession(nextSession);
          }
        })
        .finally(() => {
          if (mounted) {
            setIsLoading(false);
          }
        });
    } else {
      setIsLoading(false);
    }

    const subscription = authService.onAuthStateChanged(async (nextUser) => {
      if (!mounted) return;

      if (!nextUser) {
        clearAuthState();
        setIsLoading(false);
        return;
      }

      setUser(mapFirebaseUser(nextUser));
      setSession(await buildSession(nextUser));
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [clearAuthState]);

  const value: AuthContextType = {
    session,
    user,
    isLoading,
    isAuthenticated: Boolean(session && user),
    signOut,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
