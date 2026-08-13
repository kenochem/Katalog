import { TalkChatDrawer } from '../chat/TalkChatDrawer';

/** Czat w Suite — pełny Talk w bańce (jak hub-platform). */
export function HubChatDrawer() {
  return <TalkChatDrawer listenHubOpenEvent suiteMode zIndexClass="z-[55]" />;
}
