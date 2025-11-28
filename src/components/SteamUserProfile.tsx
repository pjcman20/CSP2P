import { LogOut } from 'lucide-react';
import { Button } from './ui/button';
import type { SteamUser } from '../utils/steamAuth';

interface SteamUserProfileProps {
  user: SteamUser;
  onLogout: () => void;
}

export function SteamUserProfile({ user, onLogout }: SteamUserProfileProps) {
  return (
    <div className="flex items-center gap-3">
      <a
        href={user.profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
      >
        <img
          src={user.avatarUrl}
          alt={user.personaName}
          className="w-10 h-10 rounded-full border-2 border-[#FF6A00]"
        />
        <span className="text-white font-medium">{user.personaName}</span>
      </a>
      
      <Button
        onClick={onLogout}
        variant="ghost"
        size="sm"
        className="text-gray-400 hover:text-white"
      >
        <LogOut className="w-4 h-4" />
      </Button>
    </div>
  );
}
