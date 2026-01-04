import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

/**
 * Hook to access the auth context.
 *
 * @throws Error if used outside of AuthProvider
 * @returns AuthContextType
 */
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

/**
 * Alias for useAuthContext for backward compatibility.
 * Preferred hook name is useAuthContext.
 */
export const useAuth = useAuthContext;