import jwt from 'jsonwebtoken';

const SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-do-not-use-in-prod';

export type JwtPayload = {
  sub: string;
  role: string;
  iat: number;
  exp: number;
};

export function signToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}
