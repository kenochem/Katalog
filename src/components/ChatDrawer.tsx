import { TalkChatDrawer } from './chat/TalkChatDrawer';
import { TalkChatPage } from './chat/TalkChatPage';

/** Bańka czatu w produktach z modułem comms (np. Sell). */
export function ChatDrawer({ layout = 'fab' }: { layout?: 'fab' | 'page' }) {
  if (layout === 'page') {
    return (
      <div className="relative flex min-h-[calc(100dvh-4rem)] flex-1 flex-col">
        <TalkChatPage variant="page" />
      </div>
    );
  }
  return (
    <TalkChatDrawer
      fabBottomClass="bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 md:bottom-6 md:right-6"
      zIndexClass="z-40"
    />
  );
}
