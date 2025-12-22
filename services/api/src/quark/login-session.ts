/**
 * Quark Login Session Manager
 * Manages QR code login sessions and their lifecycle
 */

export interface LoginSession {
    sessionId: string;
    token: string;
    status: 'pending' | 'success' | 'expired';
    cookie?: string;
    initialCookies?: string; // Cookies from the initial QR code generation
    createdAt: number;
    expiresAt: number;
}

class LoginSessionManager {
    private sessions = new Map<string, LoginSession>();
    private readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

    /**
     * Create a new login session
     */
    createSession(token: string, initialCookies?: string): LoginSession {
        const sessionId = this.generateSessionId();
        const now = Date.now();

        const session: LoginSession = {
            sessionId,
            token,
            status: 'pending',
            initialCookies,
            createdAt: now,
            expiresAt: now + this.SESSION_TIMEOUT,
        };

        this.sessions.set(sessionId, session);

        // Auto-cleanup expired session
        setTimeout(() => {
            this.expireSession(sessionId);
        }, this.SESSION_TIMEOUT);

        return session;
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): LoginSession | undefined {
        const session = this.sessions.get(sessionId);

        if (session && Date.now() > session.expiresAt) {
            this.expireSession(sessionId);
            return undefined;
        }

        return session;
    }

    /**
     * Update session with cookie after successful login
     */
    updateSessionSuccess(sessionId: string, cookie: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.status = 'success';
            session.cookie = cookie;
        }
    }

    /**
     * Expire a session
     */
    private expireSession(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (session && session.status === 'pending') {
            session.status = 'expired';
        }

        // Remove after additional 1 minute
        setTimeout(() => {
            this.sessions.delete(sessionId);
        }, 60 * 1000);
    }

    /**
     * Generate a unique session ID
     */
    private generateSessionId(): string {
        return `qk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Clean up all expired sessions
     */
    cleanup(): void {
        const now = Date.now();
        for (const [id, session] of this.sessions) {
            if (now > session.expiresAt) {
                this.sessions.delete(id);
            }
        }
    }
}

// Singleton instance
export const loginSessionManager = new LoginSessionManager();

// Run cleanup every minute
setInterval(() => {
    loginSessionManager.cleanup();
}, 60 * 1000);
