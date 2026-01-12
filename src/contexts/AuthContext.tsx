import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Session, User, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleAuthError = useCallback((error: AuthError) => {
    console.error("Auth error:", error);
    
    // Handle specific error types
    if (error.message?.includes("refresh_token_not_found") || 
        error.message?.includes("Invalid Refresh Token") ||
        error.status === 401) {
      // Token expired or invalid - sign out cleanly
      setSession(null);
      setUser(null);
      toast.error("Session expired. Please sign in again.");
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        handleAuthError(error);
        return;
      }
      
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
    } catch (error) {
      console.error("Failed to refresh session:", error);
    }
  }, [handleAuthError]);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setSession(null);
      setUser(null);
      toast.success("Signed out successfully");
    } catch (error) {
      console.error("Sign out error:", error);
      // Force clear local state even if API fails
      setSession(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    
    // Set up auth state listener FIRST (before getSession)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;
        
        switch (event) {
          case "SIGNED_IN":
          case "TOKEN_REFRESHED":
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            break;
            
          case "SIGNED_OUT":
            setSession(null);
            setUser(null);
            break;
            
          case "USER_UPDATED":
            setUser(currentSession?.user ?? null);
            break;
            
          case "PASSWORD_RECOVERY":
            // Handle password recovery event
            break;
            
          default:
            if (currentSession) {
              setSession(currentSession);
              setUser(currentSession.user);
            }
        }
        
        setIsLoading(false);
      }
    );

    // Then get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (!mounted) return;
      
      if (error) {
        handleAuthError(error);
        setIsLoading(false);
        return;
      }
      
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setIsLoading(false);
    });

    // Set up token refresh interval (every 4 minutes for 5-min token lifetime)
    const refreshInterval = setInterval(() => {
      if (session) {
        refreshSession();
      }
    }, 4 * 60 * 1000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [handleAuthError, refreshSession]);

  const value: AuthContextType = {
    session,
    user,
    isLoading,
    isAuthenticated: !!session,
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
