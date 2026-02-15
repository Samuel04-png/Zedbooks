import {
  Auth,
  User,
  UserCredential,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { assertFirebaseConfigured, firebaseAuth, isFirebaseConfigured } from "@/integrations/firebase/client";
import { callFunction } from "@/services/firebase/functionsService";
import type { InvitationPayload } from "@/services/firebase/types";

interface SignUpInput {
  email: string;
  password: string;
  fullName?: string;
  organizationName?: string;
  phone?: string;
  organizationType?: "business" | "non_profit";
  taxClassification?: string;
  tpin?: string;
}

interface BootstrapUserResponse {
  success: boolean;
  message?: string;
}

interface AcceptInvitationResponse {
  success: boolean;
  companyId: string;
  role: string;
}

interface EnsureCurrentMembershipResponse {
  success: boolean;
  companyId: string;
  role: string;
  status: string;
}

export interface AuthStateSubscription {
  unsubscribe: () => void;
}

const getAuthInstance = (): Auth => {
  return firebaseAuth;
};

export const authService = {
  async signIn(email: string, password: string): Promise<UserCredential> {
    assertFirebaseConfigured();
    return signInWithEmailAndPassword(getAuthInstance(), email, password);
  },

  async signUp(input: SignUpInput): Promise<UserCredential> {
    assertFirebaseConfigured();
    const credential = await createUserWithEmailAndPassword(getAuthInstance(), input.email, input.password);

    if (input.fullName) {
      await updateProfile(credential.user, { displayName: input.fullName });
    }

    await sendEmailVerification(credential.user);

    await callFunction<SignUpInput & { uid: string }, BootstrapUserResponse>("bootstrapUserAccount", {
      ...input,
      uid: credential.user.uid,
    });

    return credential;
  },

  async resendVerificationEmail(): Promise<void> {
    assertFirebaseConfigured();
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error("No authenticated user found.");
    }
    await sendEmailVerification(user);
  },

  async sendResetPasswordEmail(email: string): Promise<void> {
    assertFirebaseConfigured();
    await sendPasswordResetEmail(getAuthInstance(), email);
  },

  async updateUserPassword(newPassword: string): Promise<void> {
    assertFirebaseConfigured();
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error("No authenticated user found.");
    }
    await updatePassword(user, newPassword);
  },

  async logout(): Promise<void> {
    assertFirebaseConfigured();
    await signOut(getAuthInstance());
  },

  async getIdToken(forceRefresh = false): Promise<string | null> {
    const user = this.getCurrentUser();
    if (!user) return null;
    return user.getIdToken(forceRefresh);
  },

  getCurrentUser(): User | null {
    if (!isFirebaseConfigured) return null;
    return getAuthInstance().currentUser;
  },

  onAuthStateChanged(callback: (user: User | null) => void): AuthStateSubscription {
    if (!isFirebaseConfigured) {
      callback(null);
      return { unsubscribe: () => undefined };
    }
    const unsubscribe = onAuthStateChanged(getAuthInstance(), callback);
    return { unsubscribe };
  },

  async sendInvitation(payload: InvitationPayload): Promise<void> {
    assertFirebaseConfigured();
    await callFunction<InvitationPayload, { success: boolean }>("createInvitation", payload);
  },

  async acceptInvitation(token: string): Promise<AcceptInvitationResponse> {
    assertFirebaseConfigured();
    return callFunction<{ token: string }, AcceptInvitationResponse>("acceptInvitation", { token });
  },

  async ensureCurrentMembership(): Promise<EnsureCurrentMembershipResponse> {
    assertFirebaseConfigured();
    return callFunction<Record<string, never>, EnsureCurrentMembershipResponse>("ensureCurrentMembership", {});
  },
};
