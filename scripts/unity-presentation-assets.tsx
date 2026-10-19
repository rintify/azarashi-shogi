/** Native assets come from the web presentation, rather than a second, drifting design system. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Resvg } from '@resvg/resvg-js';
import postcss from 'postcss';
import { JSDOM } from 'jsdom';
import { RulesDialog } from '../src/components/RulesDialog';
import {
  BookOpen,
  Grid2X2,
  Maximize2,
  RotateCcw,
  Box,
  Volume2,
  VolumeX,
  Film,
  Crown,
  ShieldPlus,
  X,
  Sparkles,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  Info,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Download,
  Upload,
  FileText,
  RotateCw,
  Snowflake,
  ChevronsLeft,
  ChevronsRight,
  StepForward,
  Triangle,
} from 'lucide-react';

export async function exportPresentationAssets(directory: string) {
  const rulesDocument = new JSDOM(
    renderToStaticMarkup(createElement(RulesDialog, { close: () => {} })),
  ).window.document;
  await writeFile(
    `${directory}/Rules.json`,
    JSON.stringify({
      intro: rulesDocument.querySelector('.dialog-intro')?.textContent,
      steps: [...rulesDocument.querySelectorAll('.rule-steps li')].map((li) => ({
        title: li.querySelector('strong')?.textContent,
        body: li.querySelector('p')?.textContent,
      })),
      note: rulesDocument.querySelector('.rule-note')?.textContent,
    }),
  );
  const sheet = postcss.parse(await readFile('src/styles.css', 'utf8'));
  const variables: Record<string, string> = {};
  sheet.walkRules(':root', (rule) => {
    rule.walkDecls((d) => {
      if (d.prop.startsWith('--')) variables[d.prop] = d.value;
    });
  });
  const resolve = (value: string) =>
    value.replace(/var\((--[\w-]+)\)/g, (_, key) => variables[key] ?? `var(${key})`);
  const declarations = (selector: string) => {
    const result: Record<string, string> = {};
    sheet.walkRules((rule) => {
      if (rule.parent?.type === 'root' && rule.selectors.includes(selector))
        rule.walkDecls((d) => {
          result[d.prop] = resolve(d.value);
        });
    });
    return result;
  };
  const symbols = {
    book: BookOpen,
    grid: Grid2X2,
    view: Maximize2,
    reset: RotateCcw,
    cube: Box,
    sound: Volume2,
    mute: VolumeX,
    replay: Film,
    crown: Crown,
    'crown-result': Crown,
    helper: ShieldPlus,
    x: X,
    sparkles: Sparkles,
    'chevron-up': ChevronUp,
    'chevron-down': ChevronDown,
    'arrow-right': ArrowRight,
    info: Info,
    'x-mark': X,
    left: ChevronLeft,
    right: ChevronRight,
    play: Play,
    pause: Pause,
    'play-filled': Play,
    'pause-filled': Pause,
    first: ChevronsLeft,
    last: ChevronsRight,
    step: StepForward,
    triangle: Triangle,
    download: Download,
    upload: Upload,
    text: FileText,
    spin: RotateCw,
    snowflake: Snowflake,
  };
  await mkdir(`${directory}/Symbols`, { recursive: true });
  for (const [name, Icon] of Object.entries(symbols)) {
    const svg = renderToStaticMarkup(
      createElement(Icon, {
        size: 24,
        strokeWidth: name === 'crown' || name === 'helper' ? 2.7 : name === 'x-mark' ? 3 : 2,
        fill: name === 'triangle' || name.endsWith('-filled') ? 'white' : 'none',
        color: 'white',
      }),
    ).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    await writeFile(
      `${directory}/Symbols/${name}.png`,
      new Resvg(svg, { fitTo: { mode: 'width', value: 144 } }).render().asPng(),
    );
  }
  await mkdir(`${directory}/Effects`, { recursive: true });
  await writeFile(
    `${directory}/Effects/orb.png`,
    new Resvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><defs><radialGradient id="g"><stop offset="0" stop-color="white"/><stop offset=".12" stop-color="white"/><stop offset=".3" stop-color="white" stop-opacity=".7529411765"/><stop offset=".6" stop-color="white" stop-opacity=".2196078431"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient></defs><rect width="64" height="64" fill="url(#g)"/></svg>',
    )
      .render()
      .asPng(),
  );
  await writeFile(
    `${directory}/Effects/vignette.png`,
    new Resvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="1000"><defs><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="#84d8ff" stop-opacity=".133333"/><stop offset=".22" stop-color="#84d8ff" stop-opacity="0"/><stop offset=".7" stop-color="#3c8ac4" stop-opacity="0"/><stop offset="1" stop-color="#3c8ac4" stop-opacity=".133333"/></linearGradient></defs><rect width="4" height="1000" fill="url(#g)"/></svg>',
    )
      .render()
      .asPng(),
  );
  const selectors = {
    hud: '.hud-button',
    opponent: '.opponent-bar',
    reserve: '.reserve-dock',
    tray: '.action-dock',
    stock: '.reserve-grid button',
    primary: '.primary-button',
    keep: '.keep-button',
    evolve: '.evolve-button',
    promotion: '.promotion-button',
    cancel: '.promotion-cancel',
    rotation: '.rotation-choice',
    rotationSelected: ".rotation-choice[aria-pressed='true']",
    danger: '.threat-badge',
    king: '.threat-badge.king-capture-badge',
    helper: '.threat-badge.helper-badge',
    trapped: '.threat-badge.trapped-badge',
    dialog: '.dialog',
    replayCard: '.replay-card',
    replayDock: '.replay-dock',
    catalog: '.catalog-stage',
    catalogArrow: '.catalog-arrow',
    optionSelected: '.side-options button.active',
    stockSelected: '.reserve-grid button.selected',
    replayPlay: '.replay-controls .replay-play',
    replayWatch: '.replay-watch',
    replayImport: '.replay-import',
    warning: '.promotion-warning',
    rotationDanger: ".rotation-choice[data-danger='true'][aria-pressed='true']",
    promotionDanger: ".promotion-button[data-danger='true']",
    pulse: '.turn-banner .status-pulse',
    pulseHuman: '.turn-banner .human',
    turnNotice: '.turn-splash-copy',
    coordinate: '.coordinate-board',
    resultPrimary: '.result-overlay .primary-button',
    resultParticle: '.result-particle',
    textStatus: '.turn-banner',
    textBrand: '.game-brand',
    textCatalogCaption: '.brand-catalog',
    textMessage: '.match-message',
    textGain: '.stock-gain',
    stockArrival: '.opponent-stock > [data-gaining]::after',
    textResultHeading: '.result-overlay section',
    textResultKicker: '.result-kicker',
    textResultFooter: '.result-overlay .result-footer p',
  };
  const surfaces = [];
  const splitLayers = (value: string) => {
    let depth = 0,
      start = 0;
    const layers: string[] = [];
    for (let i = 0; i < value.length; i++) {
      if (value[i] === '(') depth++;
      if (value[i] === ')') depth--;
      if (value[i] === ',' && depth === 0) {
        layers.push(value.slice(start, i));
        start = i + 1;
      }
    }
    layers.push(value.slice(start));
    return layers.map((v) => v.trim()).filter(Boolean);
  };
  for (const [name, selector] of Object.entries(selectors)) {
    const values = {
      ...(name === 'keep' || name === 'evolve' ? declarations('.promotion-button') : {}),
      ...(name === 'king' || name === 'helper' || name === 'trapped'
        ? declarations('.threat-badge')
        : {}),
      ...declarations(selector),
    };
    const radius = values['border-radius']?.endsWith('%')
      ? (parseFloat(values.width) || 25) / 2
      : parseFloat(values['border-radius']) || 0;
    const shadowLayers = splitLayers(
      values[name.startsWith('text') ? 'text-shadow' : 'box-shadow'] ?? '',
    )
      .filter((v) => v && !v.startsWith('inset'))
      .map((layer) => {
        const lengths = layer.match(/^(?:-?[\d.]+(?:px)?\s+){2,4}/)?.[0] ?? '';
        const nums = lengths.trim().split(/\s+/).map(parseFloat);
        const [x = 0, y = 0, blur = 0, spread = 0] = nums;
        let color = layer.slice(lengths.length).trim();
        let opacity = 1;
        const mix = color.match(
          /^color-mix\(in srgb,\s*(var\(--[\w-]+\)|#[\da-f]{3,8})\s+([\d.]+)%,\s*transparent\)$/,
        );
        if (mix) {
          color = mix[1];
          opacity = Number(mix[2]) / 100;
        }
        return { x, y, blur, spread, color, opacity };
      })
      .reverse();
    if (name === 'textBrand') {
      const stroke = declarations('.game-brand h1')['-webkit-text-stroke']?.match(
        /([\d.]+)px\s+(#[\da-f]{3,8})/i,
      );
      if (stroke) {
        // paint-order: stroke fill. The visible stroke is half of the CSS
        // centered stroke width; keep it in UI pixels, not SDF outline units.
        for (let i = 0; i < 16; i++)
          shadowLayers.push({
            x: (Math.cos((i * Math.PI) / 8) * Number(stroke[1])) / 2,
            y: (Math.sin((i * Math.PI) / 8) * Number(stroke[1])) / 2,
            blur: 0,
            spread: 0,
            color: stroke[2],
            opacity: 1,
          });
      }
    }
    // The runtime draws these layers behind the border box using native UI
    // Toolkit blur (CSS box-shadow's sigma is blur-radius / 2). No nine-slice
    // scaling of the blur, no SVG filter-region clipping.
    surfaces.push({
      name,
      selector,
      background: values.background ?? '',
      color: values.color ?? '',
      radius,
      border: values.border ?? '',
      shadow: shadowLayers.length > 0,
      layers: shadowLayers,
      values: Object.entries(values).map(([key, value]) => ({ key, value })),
    });
  }
  const keyframes: {
    name: string;
    frames: { at: number; values: { key: string; value: string }[] }[];
  }[] = [];
  sheet.walkAtRules('keyframes', (rule) => {
    const frames: any[] = [];
    rule.walkRules((frame) => {
      for (const point of frame.selector.split(','))
        frames.push({
          at: point.trim() === 'from' ? 0 : point.trim() === 'to' ? 1 : parseFloat(point) / 100,
          values: frame.nodes
            .filter((n) => n.type === 'decl')
            .map((n: any) => ({ key: n.prop, value: resolve(n.value) })),
        });
    });
    keyframes.push({ name: rule.params, frames });
  });
  await writeFile(
    `${directory}/Presentation.json`,
    JSON.stringify({
      variables,
      surfaces,
      keyframes,
      ease: variables['--ui-ease'],
      spring: variables['--ui-spring'],
    }),
  );
}
