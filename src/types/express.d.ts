declare namespace Express {
  interface Request {
    adminAuth?: {
      actorId: string;
      email: string | null;
      role: 'admin' | 'hr' | 'manager' | 'analytics';
      permissions: string[];
      token: string;
    };
  }
}
