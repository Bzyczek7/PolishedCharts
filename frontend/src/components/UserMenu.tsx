/**
 * User menu component for authenticated users.
 *
 * Feature: 011-firebase-auth
 * User Story 5: Sign Out
 */

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Mail } from 'lucide-react';

// =============================================================================
// Helper Components
// =============================================================================

/**
 * Avatar for displaying user photo or initials.
 */
const UserAvatar: React.FC<{
  email?: string | null;
  photoUrl?: string | null;
}> = ({ email, photoUrl }) => {
  // If photo URL exists, display the image
  if (photoUrl) {
    return (
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.1)',
        }}
      >
        <img
          src={photoUrl}
          alt={email || 'User'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 20%',
          }}
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // Otherwise, fall back to initials
  const initial = email?.charAt(0).toUpperCase() || 'U';
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-base font-medium">
      {initial}
    </div>
  );
};

// =============================================================================
// Props
// =============================================================================

interface UserMenuProps {
  /**
   * Optional className for custom styling
   */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * UserMenu provides a dropdown menu for authenticated users.
 *
 * Features:
 * - Display user email (FR-007)
 * - Sign out functionality (FR-023)
 * - Link to profile settings (future feature)
 * - Visual indication of authentication state
 */
export function UserMenu({ className }: UserMenuProps) {
  const { userProfile, signOut, isLoading } = useAuth();

  /**
   * Handle sign out.
   */
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
      // Even if sign out fails, the user should be logged out from Firebase
      // The auth context handles cleanup
    }
  };

  // Don't render if user is not authenticated
  if (!userProfile) {
    return null;
  }

  // Get user initials for avatar
  const getUserInitials = (email: string) => {
    const parts = email.split('@');
    const username = parts[0];
    const initials = username
      .split('.')
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
    return initials || email.charAt(0).toUpperCase();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={`relative h-12 w-12 rounded-full p-0 ${className || ''}`}>
          <UserAvatar
            email={userProfile.email}
            photoUrl={userProfile.photo_url}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {userProfile.email}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {userProfile.email_verified ? 'Verified' : 'Unverified'}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Mail className="mr-2 h-4 w-4" />
            <span>
              {userProfile.email_verified ? 'Email Verified' : 'Verify Email'}
            </span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={isLoading}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default UserMenu;
