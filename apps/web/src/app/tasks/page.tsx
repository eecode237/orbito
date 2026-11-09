import type { Metadata } from "next";

import { TaskManager } from "@/components/tasks/task-manager";

export const metadata: Metadata = {
  title: "Task Manager",
  description: "Plan the backlog, schedule tomorrow, and track ORBITO project work alongside its real execution runs.",
};

export default function TasksPage() {
  return <TaskManager />;
}
