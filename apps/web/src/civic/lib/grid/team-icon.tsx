import {
  Car,
  Cog,
  Construction,
  Cpu,
  Hash,
  Route,
  ShoppingCart,
  Zap,
  Droplets,
  Footprints,
  HelpCircle,
  Lightbulb,
  type LucideIcon,
  ShieldAlert,
  Signpost,
  SprayCan,
  Trash2,
  TreePine,
  Users,
  Waves,
} from "lucide-react";

/* ==================================================================
   Maps the kebab `icon` field on TeamMeta to its lucide component.
   Centralized so any Teams surface (roster, bars, delegation chips)
   renders the same glyph for a given team.
   ================================================================== */

const ICON_MAP: Record<string, LucideIcon> = {
  users: Users,
  construction: Construction,
  footprints: Footprints,
  waves: Waves,
  droplets: Droplets,
  lightbulb: Lightbulb,
  "sign-post": Signpost,
  "tree-pine": TreePine,
  "spray-can": SprayCan,
  "shield-alert": ShieldAlert,
  "trash-2": Trash2,
  "help-circle": HelpCircle,
};

export function teamIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? HelpCircle;
}

/* ThreadRev: rows are keyed by Slack channel, not a city department, so the
   glyph comes from the channel name. */
const CHANNEL_ICONS: [RegExp, LucideIcon][] = [
  [/electric/i, Zap],
  [/mech/i, Cog],
  [/firmware|software|code/i, Cpu],
  [/purchas|budget|buy/i, ShoppingCart],
  [/drive|chassis|motor/i, Car],
  [/strategy|sim|route/i, Route],
];

export function channelIcon(channel: string | undefined): LucideIcon {
  if (!channel) return Hash;
  return CHANNEL_ICONS.find(([re]) => re.test(channel))?.[1] ?? Hash;
}
