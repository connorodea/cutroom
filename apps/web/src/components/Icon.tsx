import {
  Activity, ArrowLeft, ArrowUpRight, AudioLines, Camera, Captions, Check, ChevronDown,
  CircleCheckBig, Clapperboard, Columns2, Combine, Contrast, CornerDownLeft, Crop, Dot, Film, Folder, Gauge, Layers, Magnet,
  Maximize2, Monitor, MousePointer2, Palette, PictureInPicture2, Play, Plus, Quote, Redo2, Repeat, Rewind, RotateCw, Scissors,
  Search, SkipBack, SkipForward, SlidersHorizontal, Smartphone, Snowflake, Sparkles, Type,
  Undo2, Upload, Volume2, Wand2, ZoomIn, ZoomOut,
  type LucideIcon,
} from "lucide-react";

/** Maps the design's kebab-case icon names to lucide-react components. */
const ICONS: Record<string, LucideIcon> = {
  activity: Activity, "arrow-left": ArrowLeft, "arrow-up-right": ArrowUpRight,
  "audio-lines": AudioLines, camera: Camera, captions: Captions, check: Check, "chevron-down": ChevronDown,
  "circle-check-big": CircleCheckBig, clapperboard: Clapperboard, "columns-2": Columns2, combine: Combine, contrast: Contrast, "corner-down-left": CornerDownLeft,
  crop: Crop, dot: Dot, film: Film, folder: Folder, gauge: Gauge, layers: Layers, magnet: Magnet, "maximize-2": Maximize2,
  monitor: Monitor, "mouse-pointer-2": MousePointer2, palette: Palette, pip: PictureInPicture2, play: Play, plus: Plus,
  quote: Quote, "redo-2": Redo2, repeat: Repeat, rewind: Rewind, "rotate-cw": RotateCw, scissors: Scissors, search: Search, "skip-back": SkipBack,
  "skip-forward": SkipForward, "sliders-horizontal": SlidersHorizontal, smartphone: Smartphone,
  snowflake: Snowflake, sparkles: Sparkles, type: Type, "undo-2": Undo2, upload: Upload, "volume-2": Volume2,
  "wand-2": Wand2, "zoom-in": ZoomIn, "zoom-out": ZoomOut,
};

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
  style?: React.CSSProperties;
}

/** Inline SVG icon by design name. Inherits `currentColor` unless `color` is set. */
export function Icon({ name, size = 16, color, strokeWidth = 2, fill = "none", style }: IconProps) {
  const Cmp = ICONS[name];
  if (!Cmp) return null;
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} fill={fill} style={style} />;
}
