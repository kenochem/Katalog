import { buildGifMessage } from './chatAttachments';

export interface TalkGif {
  id: string;
  label: string;
  url: string;
}

export const TALK_GIFS: TalkGif[] = [
  { id: 'ok', label: 'OK', url: 'https://media.tenor.com/UrIakXGExfUAAAAM/mr-bean.gif' },
  { id: 'dzieki', label: 'Dzięki', url: 'https://media.tenor.com/s62iXGOChw8AAAAM/thanks-thanks-alot.gif' },
  { id: 'super', label: 'Super robota', url: 'https://media.tenor.com/w_nJNuSaCK8AAAAM/good-job.gif' },
  { id: 'jade', label: 'Jadę', url: 'https://media.tenor.com/8TMA1l68bx4AAAAM/frunk-running.gif' },
  { id: 'pilne', label: 'Pilne', url: 'https://media.tenor.com/vuOR748h-6cAAAAM/despicable-me-animation.gif' },
  { id: 'gotowe', label: 'Gotowe', url: 'https://media.tenor.com/wclYcVD2GvwAAAAM/finished-im-so-done.gif' },
];

export function buildTalkGifMessage(gif: TalkGif): string {
  return buildGifMessage(gif.url, gif.label);
}
