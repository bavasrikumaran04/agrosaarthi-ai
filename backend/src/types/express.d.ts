import type { AuthContext } from '../middleware/auth.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by the authenticate middleware when a valid access token is presented. */
      auth?: AuthContext;
    }
  }
}

export {};
