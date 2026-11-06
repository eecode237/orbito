import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BookOpen,
  Briefcase,
  Code2,
  FileText,
  Globe2,
  GraduationCap,
  LayoutDashboard,
  LayoutGrid,
  Mic,
  Settings2,
  Sparkles,
  Video,
  Zap,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

export type NavGroup = { label: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/chat", label: "Chat", icon: Sparkles },
      { href: "/agents", label: "Agents", icon: Briefcase },
    ],
  },
  {
    label: "Studios",
    items: [
      { href: "/scraping", label: "Scraping Studio", icon: Globe2, badge: "Beta" },
      { href: "/voice", label: "Voice Studio", icon: Mic, badge: "Soon" },
      { href: "/video", label: "Video Studio", icon: Video, badge: "Soon" },
    ],
  },
  {
    label: "Organize",
    items: [
      { href: "/workspaces", label: "Workspaces", icon: LayoutGrid },
      { href: "/knowledge", label: "Knowledge Base", icon: BookOpen },
      { href: "/automations", label: "Automations", icon: Zap },
      { href: "/activity", label: "Activity", icon: Activity },
    ],
  },
];

export const settingsItem: NavItem = {
  href: "/settings",
  label: "Settings",
  icon: Settings2,
};

const agentIcons: Record<string, LucideIcon> = {
  core: Sparkles,
  career: Briefcase,
  research: Globe2,
  study: GraduationCap,
  coding: Code2,
  automation: Zap,
  documents: FileText,
};

export function agentIcon(slug: string): LucideIcon {
  return agentIcons[slug] ?? Sparkles;
}

export const accentStyles: Record<
  string,
  { text: string; bg: string; border: string; glow: string; gradient: string }
> = {
  violet: {
    text: "text-violet-soft",
    bg: "bg-violet/12",
    border: "border-violet/30",
    glow: "shadow-[0_20px_60px_-30px_rgba(124,92,255,0.8)]",
    gradient: "from-violet/20 via-violet/5 to-transparent",
  },
  mint: {
    text: "text-mint",
    bg: "bg-mint/10",
    border: "border-mint/25",
    glow: "shadow-[0_20px_60px_-30px_rgba(61,220,151,0.6)]",
    gradient: "from-mint/15 via-mint/4 to-transparent",
  },
  blue: {
    text: "text-sky",
    bg: "bg-sky/10",
    border: "border-sky/25",
    glow: "shadow-[0_20px_60px_-30px_rgba(56,189,248,0.6)]",
    gradient: "from-sky/15 via-sky/4 to-transparent",
  },
  amber: {
    text: "text-amber",
    bg: "bg-amber/10",
    border: "border-amber/25",
    glow: "shadow-[0_20px_60px_-30px_rgba(245,165,36,0.6)]",
    gradient: "from-amber/15 via-amber/4 to-transparent",
  },
  rose: {
    text: "text-rose",
    bg: "bg-rose/10",
    border: "border-rose/25",
    glow: "shadow-[0_20px_60px_-30px_rgba(251,113,133,0.55)]",
    gradient: "from-rose/15 via-rose/4 to-transparent",
  },
  slate: {
    text: "text-white/70",
    bg: "bg-white/5",
    border: "border-white/15",
    glow: "",
    gradient: "from-white/10 via-white/2 to-transparent",
  },
};
