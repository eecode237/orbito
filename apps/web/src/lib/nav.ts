import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  Bitcoin,
  BookOpen,
  Bot,
  Boxes,
  BrainCircuit,
  Briefcase,
  Coins,
  FileText,
  FolderOpen,
  Gauge,
  Globe2,
  GraduationCap,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutGrid,
  Mic,
  Newspaper,
  Palette,
  Radar,
  ScrollText,
  Settings2,
  ShieldCheck,
  Sparkles,
  Video,
  Zap,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  exact?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
};

export const navGroups: NavGroup[] = [
  {
    label: "Command Center",
    defaultOpen: true,
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/chat", label: "Chat", icon: Sparkles },
      { href: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Intelligence",
    defaultOpen: true,
    items: [
      { href: "/agents/monitor", label: "Agent Monitor", icon: Activity, badge: "Live" },
      { href: "/agents", label: "Agents", icon: Bot },
      { href: "/models", label: "Model Hub", icon: Boxes },
      { href: "/memory", label: "Memory", icon: BrainCircuit },
    ],
  },
  {
    label: "Discovery",
    defaultOpen: true,
    items: [
      { href: "/planet", label: "Planet", icon: Globe2 },
      { href: "/news", label: "News Intelligence", icon: Newspaper },
      { href: "/crypto", label: "Markets", icon: Bitcoin },
      { href: "/jobs", label: "Jobs Intelligence", icon: Briefcase },
      { href: "/scraping", label: "Web Intelligence", icon: Radar, badge: "Beta" },
    ],
  },
  {
    label: "Education",
    items: [
      { href: "/academy", label: "Academy", icon: GraduationCap },
      { href: "/knowledge", label: "Knowledge Base", icon: BookOpen },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/workspaces", label: "Workspaces", icon: LayoutGrid },
      { href: "/files", label: "Files", icon: FolderOpen },
      { href: "/automations", label: "Automations", icon: Zap },
    ],
  },
  {
    label: "Creation",
    items: [
      { href: "/voice", label: "Voice Studio", icon: Mic, badge: "Soon" },
      { href: "/video", label: "Video Studio", icon: Video, badge: "Soon" },
      { href: "/image", label: "Image Studio", icon: ImageIcon, badge: "Soon" },
      { href: "/documents", label: "Document Studio", icon: FileText },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/system", label: "System Health", icon: Gauge },
      { href: "/usage", label: "Usage & Costs", icon: Coins },
      { href: "/design-system", label: "Design System", icon: Palette },
    ],
  },
  {
    label: "Security",
    items: [
      { href: "/approvals", label: "Approvals", icon: ShieldCheck },
      { href: "/audit", label: "Audit Logs", icon: ScrollText },
    ],
  },
];

export const settingsItem: NavItem = {
  href: "/settings",
  label: "Settings",
  icon: Settings2,
};

export const allNavItems: NavItem[] = [
  ...navGroups.flatMap((group) => group.items),
  settingsItem,
];

export function navLabelFor(pathname: string): string | null {
  const match = [...allNavItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) =>
      item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`),
    );
  return match?.label ?? null;
}

const agentIcons: Record<string, LucideIcon> = {
  core: Sparkles,
  career: Briefcase,
  research: Globe2,
  study: GraduationCap,
  coding: Sparkles,
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
    text: "text-primary-hover",
    bg: "bg-primary/12",
    border: "border-primary/30",
    glow: "shadow-[0_20px_60px_-30px_rgba(148,112,255,0.8)]",
    gradient: "from-primary/20 via-primary/5 to-transparent",
  },
  mint: {
    text: "text-success",
    bg: "bg-success/10",
    border: "border-success/25",
    glow: "shadow-[0_20px_60px_-30px_rgba(53,211,153,0.6)]",
    gradient: "from-success/15 via-success/4 to-transparent",
  },
  blue: {
    text: "text-info",
    bg: "bg-info/10",
    border: "border-info/25",
    glow: "shadow-[0_20px_60px_-30px_rgba(67,198,245,0.6)]",
    gradient: "from-info/15 via-info/4 to-transparent",
  },
  amber: {
    text: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/25",
    glow: "shadow-[0_20px_60px_-30px_rgba(245,185,66,0.6)]",
    gradient: "from-warning/15 via-warning/4 to-transparent",
  },
  rose: {
    text: "text-error",
    bg: "bg-error/10",
    border: "border-error/25",
    glow: "shadow-[0_20px_60px_-30px_rgba(251,113,133,0.55)]",
    gradient: "from-error/15 via-error/4 to-transparent",
  },
  slate: {
    text: "text-foreground-secondary",
    bg: "bg-foreground/5",
    border: "border-border",
    glow: "",
    gradient: "from-foreground/10 via-foreground/2 to-transparent",
  },
};
