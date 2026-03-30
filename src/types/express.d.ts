declare namespace Express {
  interface Request {
    adminAuth?: {
      actorId: string;
      email: string | null;
      role: 'admin' | 'hr' | 'manager';
      permissions: string[];
      token: string;
    };
  }
}
