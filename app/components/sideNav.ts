import { Tag, Layers, Activity, Cpu, Wrench, Sliders, RefreshCcw } from "lucide-react";

export const SIDE_NAV: Record<
  string,
  { key: string; label: string; href: string; icon?: any }[]
> = {
  labels: [
    { key: "label-a", label: "Label A", href: "/labels/a", icon: Tag },
    { key: "label-b", label: "Label B", href: "/labels/b", icon: Tag },
    { key: "label-c", label: "Label C", href: "/labels/c", icon: Layers },
  ],
  status: [
    { key: "overview", label: "Übersicht", href: "/status", icon: Activity },
    { key: "motors", label: "Motoren", href: "/status/motors", icon: Cpu },
    { key: "sensors", label: "Sensoren", href: "/status/sensors", icon: Wrench },
  ],
  settings: [
    { key: "general", label: "Allgemein", href: "/settings", icon: Sliders },
    { key: "network", label: "Netzwerk", href: "/settings/network", icon: Wrench },
    { key: "sync", label: "Sync", href: "/settings/sync", icon: RefreshCcw },
  ],
};
