import type { Metadata } from "next";

import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  return <SettingsView initialTab={params.tab ?? "profile"} />;
}
