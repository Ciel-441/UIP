'use client';

import React, { useEffect } from 'react';
import { AuthProvider } from '@/hooks/useAuth';
import { RoomProvider } from '@/hooks/useRoom';
import { DialogProvider } from '@/context/DialogContext';
import { ChatProvider } from '@/context/ChatContext';
import { settingsApi } from '@/lib/api';
import ClickSpark from '@/components/ui/ClickSpark';

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    settingsApi.get().then(res => {
      if (res.data?.theme === 'light') {
        document.body.classList.add('light-mode');
      } else {
        document.body.classList.remove('light-mode');
      }
    }).catch(() => {});
  }, []);

  return (
    <DialogProvider>
      <AuthProvider>
        <RoomProvider>
          <ChatProvider>
            <ClickSpark sparkColor="#ff79c6" sparkSize={8} sparkRadius={20} sparkCount={10} duration={500}>
              {children}
            </ClickSpark>
          </ChatProvider>
        </RoomProvider>
      </AuthProvider>
    </DialogProvider>
  );
}
