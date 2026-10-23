import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Stroke icons (24×24 grid, Lucide-style outlines) drawn inline — no icon font or extra dependency. Decorative by default. */
const PATHS: Record<string, string> = {
  camera: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z|c12,13,3.5',
  mic: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z|M19 10v2a7 7 0 0 1-14 0v-2|M12 19v3',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  expert: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|c9,7,4|M16 11l2 2 4-4',
  leaf: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z|M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12',
  sprout: 'M7 20h10|M10 20c5.5-2.5.8-6.4 3-10|M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z|M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z|M8 9h8|M8 13h5',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z|M9 12l2 2 4-4',
  globe: 'c12,12,10|M2 12h20|M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  clipboard: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2|M9 2h6v4H9z|M9 12h6|M9 16h4',
  arrow: 'M5 12h14|M12 5l7 7-7 7',
  back: 'M19 12H5|M12 19l-7-7 7-7',
  check: 'M20 6 9 17l-5-5',
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z|M12 9v4|M12 17h.01',
  info: 'c12,12,10|M12 16v-4|M12 8h.01',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M17 8l-5-5-5 5|M12 3v12',
  clock: 'c12,12,10|M12 6v6l4 2',
  book: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z|M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  chart: 'M3 3v18h18|M18 17V9|M13 17V5|M8 17v-3',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|c9,7,4|M23 21v-2a4 4 0 0 0-3-3.9|M16 3.1a4 4 0 0 1 0 7.8',
  settings: 'c12,12,3|M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|M16 17l5-5-5-5|M21 12H9',
  menu: 'M3 6h18|M3 12h18|M3 18h18',
  close: 'M18 6 6 18|M6 6l12 12',
  search: 'c11,11,8|M21 21l-4.3-4.3',
  cpu: 'M9 2v2|M15 2v2|M9 20v2|M15 20v2|M2 9h2|M2 15h2|M20 9h2|M20 15h2|M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z|M9 9h6v6H9z',
  database: 'M12 2c5 0 9 1.3 9 3s-4 3-9 3-9-1.3-9-3 4-3 9-3z|M21 12c0 1.7-4 3-9 3s-9-1.3-9-3|M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5',
  lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z|M7 11V7a5 5 0 0 1 10 0v4',
  wifiOff: 'M2 2l20 20|M8.5 16.5a5 5 0 0 1 7 0|M5 12.9a10 10 0 0 1 5.2-2.8|M19 12.9a10 10 0 0 0-2.3-1.6|M2 8.8a15 15 0 0 1 4.2-2.7|M22 8.8a15 15 0 0 0-11.3-3.8|M12 20h.01',
  keypad: 'M5 2h14a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z|M8 6h8v3H8z|M8 13h.01|M12 13h.01|M16 13h.01|M8 17h.01|M12 17h.01|M16 17h.01',
  sun: 'c12,12,4|M12 2v2|M12 20v2|M4.9 4.9l1.4 1.4|M17.7 17.7l1.4 1.4|M2 12h2|M20 12h2|M4.9 19.1l1.4-1.4|M17.7 6.3l1.4-1.4',
  volume: 'M11 5 6 9H2v6h4l5 4z|M15.5 8.5a5 5 0 0 1 0 7|M19 5a10 10 0 0 1 0 14',
  play: 'M6 3l14 9-14 9z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6',
};

interface Shape { kind: 'path'; d: string }
interface Circle { kind: 'circle'; cx: string; cy: string; r: string }

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      @for (s of shapes(); track $index) {
        @if (s.kind === 'circle') {<circle [attr.cx]="s.cx" [attr.cy]="s.cy" [attr.r]="s.r" />} @else {<path [attr.d]="s.d" />}
      }
    </svg>
  `,
  styles: `:host{display:inline-flex;flex:none;line-height:0}`,
})
export class Icon {
  readonly name = input.required<string>();
  readonly size = input(24);
  protected readonly shapes = computed<Array<Shape | Circle>>(() =>
    (PATHS[this.name()] ?? '').split('|').filter(Boolean).map((part) => {
      if (part.startsWith('c')) {
        const [cx, cy, r] = part.slice(1).split(',') as [string, string, string];
        return { kind: 'circle', cx, cy, r };
      }
      return { kind: 'path', d: part };
    }),
  );
}
