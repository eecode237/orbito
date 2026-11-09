import type { Metadata } from "next";

import { NotificationsView } from "@/components/safety/notifications-view";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Approval requests, safety changes and failed workflow runs.",
};

export default function NotificationsPage() {
  return <NotificationsView />;
}

