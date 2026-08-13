export const HUB_OPEN_CHAT_EVENT = 'hub-open-chat';

export function openHubChat() {
  window.dispatchEvent(new CustomEvent(HUB_OPEN_CHAT_EVENT));
}
