import Pusher from 'pusher-js';
import { useEffect, useRef } from 'react';

let reverb: Pusher | null = null;

export function initializeReverb(config: {
  appKey: string;
  host: string;
  port: number;
  useTLS: boolean;
  token: string;
}) {
  if (reverb) {
    return reverb;
  }

  if (__DEV__) {
    // Pusher.logToConsole = true; // Uncomment for debugging
  }

  const scheme = config.useTLS ? 'wss' : 'ws';
  const protocol = config.useTLS ? 'https' : 'http';

  reverb = new Pusher(config.appKey, {
    wsHost: config.host,
    wsPort: config.port,
    httpHost: config.host,
    httpPort: config.port,
    scheme,
    enabledTransports: [scheme],
    authEndpoint: `${protocol}://${config.host}:${config.port}/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
    },
  } as any);

  return reverb;
}

export function getReverb(): Pusher | null {
  return reverb;
}

export function disconnectReverb() {
  if (reverb) {
    reverb.disconnect();
    reverb = null;
  }
}

export function useReverbChannel(channelName: string, callbacks: { onMessage?: (data: any) => void; onError?: (error: Error) => void } = {}) {
  const channelRef = useRef<any | null>(null);
  const reverbInstance = getReverb();

  useEffect(() => {
    if (!reverbInstance) {
      callbacks.onError?.(new Error('Reverb not initialized'));
      return;
    }

    const channel = reverbInstance.subscribe(channelName);

    channel.bind('pusher:subscription_succeeded', () => {
      console.log(`Subscribed to ${channelName}`);
    });

    channel.bind('pusher:subscription_error', (error: any) => {
      console.error(`Failed to subscribe to ${channelName}:`, error);
      callbacks.onError?.(error);
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current && reverbInstance) {
        reverbInstance.unsubscribe(channelName);
        channelRef.current = null;
      }
    };
  }, [channelName, callbacks, reverbInstance]);

  return {
    channel: channelRef.current,
    bind: (eventName: string, callback: (data: any) => void) => {
      if (channelRef.current) {
        channelRef.current.bind(eventName, callback);
      }
    },
    unbind: (eventName: string, callback?: (data: any) => void) => {
      if (channelRef.current) {
        if (callback) {
          channelRef.current.unbind(eventName, callback);
        } else {
          channelRef.current.unbind(eventName);
        }
      }
    },
  };
}

export function subscribeToUserChannel(userId: number, callbacks: { onNotification?: (data: any) => void } = {}) {
  return useReverbChannel(`private-users.${userId}`, {
    onMessage: callbacks.onNotification,
  });
}

export function subscribeToSpaceChannel(spaceId: number, gender: 'male' | 'female', callbacks: { onPost?: (data: any) => void } = {}) {
  return useReverbChannel(`private-spaces.${spaceId}.${gender}`, {
    onMessage: callbacks.onPost,
  });
}

export function subscribeToPostChannel(postId: number, gender: 'male' | 'female', callbacks: { onComment?: (data: any) => void } = {}) {
  return useReverbChannel(`private-posts.${postId}.${gender}`, {
    onMessage: callbacks.onComment,
  });
}

export function subscribeToConversationChannel(conversationId: number, callbacks: { onMessage?: (data: any) => void; onTyping?: (data: any) => void } = {}) {
  const channel = useReverbChannel(`private-conversations.${conversationId}`, {
    onMessage: callbacks.onMessage,
  });

  return {
    ...channel,
    onMessage: callbacks.onMessage,
    onTyping: callbacks.onTyping,
  };
}
