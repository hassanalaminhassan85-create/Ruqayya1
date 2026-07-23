import React from 'react';
import { AIPortalWorkspace } from './AIPortalWorkspace';

interface ChatDashboardProps {
  lang: 'en' | 'ha';
  currentRole: string;
  userName: string;
  onExit?: () => void;
}

/**
 * ChatDashboard - Replicates a premium ChatGPT-style workspace
 * integrated cleanly within the Ruqayya ERP layout, preserving
 * state, authorization roles, and the dark navy corporate aesthetic.
 */
export const ChatDashboard: React.FC<ChatDashboardProps> = ({
  lang,
  currentRole,
  userName,
  onExit
}) => {
  return (
    <div 
      id="ruqayya-chat-dashboard" 
      className="h-screen flex flex-col bg-[#030712] overflow-hidden w-full p-0 m-0 border-0"
    >
      <AIPortalWorkspace
        lang={lang}
        currentRole={currentRole}
        userName={userName}
        onExit={onExit}
      />
    </div>
  );
};

export default ChatDashboard;
