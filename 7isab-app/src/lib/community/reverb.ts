import Pusher from 'pusher-js';
import { useEffect, useRef } from 'react';

/**
 * Live community events over Laravel Reverb (Pusher protocol).
 * One connection per signed-in session; screens subscribe with useReverbChannel.
 */

let reverb: Pusher | null = null;

export function initializeReverb(config: { appKey: string; host: string; port: number; useTLS: boolean; token: string }): Pusher {
  if (reverb) return reverb;

  const scheme = config.useTLS ? 'wss' : 'ws';
  const protocol = config.useTLS ? 'https' : 'http';

  reverb = new Pusher(config.appKey, {
    wsHost: config.host,
    wsPort: config.port,
    wssPort: config.port,
    forceTLS: config.useTLS,
    enabledTransports: [scheme],
    cluster: '',
    authEndpoint: `${protocol}://${config.host}:${config.port}/broadcasting/auth`,
    auth: { headers: { Authorization: `Bearer ${config.token}` } },
  });

  return reverb;
}

export function getReverb(): Pusher | null {
  return reverb;
}

export function disconnectReverb(): void {
  reverb?.disconnect();
  reverb = null;
}

export type ChannelHandlers = Record<string, (data: unknown) => void>;

/** Channel names, matching routes/channels.php on the server. */
export const Channels = {
  user: (userId: number) => `private-users.${userId}`,
  space: (spaceId: number, gender: 'male' | 'female') => `private-spaces.${spaceId}.${gender}`,
  post: (postId: number, gender: 'male' | 'female') => `private-posts.${postId}.${gender}`,
  conversation: (conversationId: number) => `private-conversations.${conversationId}`,
};

/**
 * Subscribes to a channel while the component is mounted and calls the handler
 * for each event name. Pass null to stay unsubscribed (e.g. before joining).
 * Handlers may change between renders without re-subscribing.
 */
export function useReverbChannel(channelName: string | null, handlers: ChannelHandlers): void {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const connection = getReverb();
    if (!channelName || !connection) return;

    const channel = connection.subscribe(channelName);
    const listener = (eventName: string, data: unknown) => {
      handlersRef.current[eventName]?.(data);
    };
    channel.bind_global(listener);

    return () => {
      channel.unbind_global(listener);
      connection.unsubscribe(channelName);
    };
  }, [channelName]);
}
