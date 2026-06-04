import jwt from 'jsonwebtoken';

function getJwtSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXTAUTH_SECRET is required in production');
  }
  return 'development-secret';
}

export type JwtPayload = {
  sub: string;
  role: string;
  iat: number;
  exp: number;
};

export function signToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, getJwtSecret(), { expiresIn: '30d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}
