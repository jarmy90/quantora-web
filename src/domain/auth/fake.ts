/**
 * QNT-0013 · TEST-ONLY in-memory AuthService.
 *
 * Never imported by the application — used exclusively by
 * `scripts/test-qnt-0013.ts` to exercise the auth domain contracts without a
 * Supabase project. Keeps credentials only in memory; nothing persists.
 */
import type {
  PublicAuthResult,
  AuthService,
  AuthUser,
  PasswordResetRequest,
  PasswordUpdate,
  SignInInput,
  SignUpInput,
} from './contracts';
import { validateDisplayName, validateEmail, validatePassword } from './validation';

type StoredUser = {
  id: string;
  email: string;
  password: string;
  displayName: string | null;
  verified: boolean;
};

export class MemoryAuthService implements AuthService {
  private users = new Map<string, StoredUser>();
  /** Test-only: exposes the last issued tokens to prove renewal works. */
  lastAccessToken: string | null = null;
  lastRefreshToken: string | null = null;
  private sessions = new Map<string, string>(); // userId -> id
  private resetRequests: string[] = [];

  constructor(private readonly configure = true) {}

  private notConfigured(): PublicAuthResult {
    return { ok: false, error: 'not_configured', message: 'Authentication is not configured yet.' };
  }

  async signUp(input: SignUpInput): Promise<PublicAuthResult> {
    if (!this.configure) return this.notConfigured();
    const email = input.email.trim().toLowerCase();
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) return { ok: false, error: 'invalid_form', message: emailCheck.message };
    const passCheck = validatePassword(input.password);
    if (!passCheck.ok) return { ok: false, error: 'invalid_form', message: passCheck.message };
    const nameCheck = validateDisplayName(input.displayName ?? '');
    if (!nameCheck.ok) return { ok: false, error: 'invalid_form', message: nameCheck.message };
    if ([...this.users.values()].some((u) => u.email === email)) {
      return { ok: false, error: 'email_taken', message: 'An account with that email already exists.' };
    }
    const user: StoredUser = {
      id: `u_${this.users.size + 1}`,
      email,
      password: input.password,
      displayName: input.displayName?.trim() || null,
      verified: false,
    };
    this.users.set(user.id, user);
    // Sign-up returns no session until the email is verified (like Supabase).
    return { ok: true, user: null, requiresEmailVerification: true };
  }

  async signIn(input: SignInInput): Promise<PublicAuthResult> {
    if (!this.configure) return this.notConfigured();
    const email = input.email.trim().toLowerCase();
    const user = [...this.users.values()].find((u) => u.email === email);
    if (!user || user.password !== input.password) {
      return { ok: false, error: 'invalid_credentials', message: 'The email or password is not correct.' };
    }
    if (!user.verified) {
      return { ok: false, error: 'email_not_verified', message: 'Please confirm your email first — check your inbox.' };
    }
    this.sessions.set(user.id, `s_${user.id}`);
    this.lastAccessToken = this.sessions.get(user.id)!;
    this.lastRefreshToken = `r_${user.id}`;
    // Tokens are internal only — the public result carries just the user.
    return { ok: true, user: this.toAuthUser(user), requiresEmailVerification: false };
  }

  async signOut(): Promise<PublicAuthResult> {
    this.sessions.clear();
    this.lastAccessToken = null;
    this.lastRefreshToken = null;
    return { ok: true, user: null, requiresEmailVerification: false };
  }

  async requestPasswordReset(input: PasswordResetRequest): Promise<PublicAuthResult> {
    if (!this.configure) return this.notConfigured();
    const email = input.email.trim().toLowerCase();
    if (validateEmail(email).ok && [...this.users.values()].some((u) => u.email === email)) {
      this.resetRequests.push(email);
    }
    // Always resolves ok so the caller cannot tell whether the account exists.
    return { ok: true, user: null, requiresEmailVerification: false };
  }

  async updatePassword(input: PasswordUpdate): Promise<PublicAuthResult> {
    if (!this.configure) return this.notConfigured();
    const passCheck = validatePassword(input.newPassword);
    if (!passCheck.ok) return { ok: false, error: 'invalid_form', message: passCheck.message };
    for (const user of this.users.values()) user.password = input.newPassword;
    return { ok: true, user: null, requiresEmailVerification: false };
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    for (const [userId, sessionId] of this.sessions) {
      if (sessionId) return this.toAuthUser(this.users.get(userId)!);
    }
    return null;
  }

  // Test helpers
  verifyUser(email: string): void {
    const user = [...this.users.values()].find((u) => u.email === email.toLowerCase().trim());
    if (user) user.verified = true;
  }
  hasResetRequestFor(email: string): boolean {
    return this.resetRequests.includes(email.toLowerCase().trim());
  }
  resetRequestCount(): number {
    return this.resetRequests.length;
  }

  private toAuthUser(user: StoredUser): AuthUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? user.email,
      emailVerified: user.verified,
    };
  }
}
