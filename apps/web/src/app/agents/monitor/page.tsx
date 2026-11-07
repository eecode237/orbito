"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { ActiveTasks } from "@/components/monitor/active-tasks";
import { ActivityStream } from "@/components/monitor/activity-stream";
import { AgentInspector } from "@/components/monitor/agent-inspector";
import { AgentNetwork } from "@/components/monitor/agent-network";
import { ExecutionTimeline } from "@/components/monitor/execution-timeline";
import { MonitorHeader } from "@/components/monitor/monitor-header";
import {
  getAgents,
  getTask,
  getTaskEvents,
  getTaskMetrics,
  getTasks,
  taskEventsUrl,
} from "@/lib/api";
import type { Agent, TaskEvent, TaskMetrics, TaskSummary } from "@/lib/types";

export default function AgentMonitorPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [metrics, setMetrics] = useState<TaskMetrics | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskSummary | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [live, setLive] = useState(true);
  const [streamPaused, setStreamPaused] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const kickoff = setTimeout(() => {
      const requested = new URLSearchParams(window.location.search).get("task");
      if (requested) setSelectedTaskId(requested);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [agentsData, tasksData, metricsData] = await Promise.all([
        getAgents(),
        getTasks(40),
        getTaskMetrics(),
      ]);
      setAgents(agentsData.agents);
      setTasks(tasksData.tasks);
      setMetrics(metricsData);
      setLive(true);
      setUpdatedAt(new Date().toISOString());

      setSelectedTaskId((current) => current ?? tasksData.tasks[0]?.id ?? null);
    } catch {
      setLive(false);
    }
  }, []);

  useEffect(() => {
    const kickoff = setTimeout(() => void refresh(), 0);
    const interval = setInterval(refresh, 5000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(interval);
    };
  }, [refresh]);

  useEffect(() => {
    if (!selectedTaskId) {
      const reset = setTimeout(() => {
        setSelectedTask(null);
        setEvents([]);
      }, 0);
      return () => clearTimeout(reset);
    }

    let active = true;
    getTask(selectedTaskId)
      .then((t) => {
        if (active) setSelectedTask(t);
      })
      .catch(() => undefined);

    getTaskEvents(selectedTaskId)
      .then((res) => {
        if (active) setEvents(res.events);
      })
      .catch(() => undefined);

    // Also connect to SSE stream for live events
    const sse = new EventSource(taskEventsUrl(selectedTaskId));
    sse.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.event && !streamPaused) {
          setEvents((prev) => [...prev, payload.event]);
        }
      } catch {
        // Ignore malformed events
      }
    };

    return () => {
      active = false;
      sse.close();
    };
  }, [selectedTaskId, streamPaused]);

  return (
    <div className="space-y-6 pt-6 sm:pt-8">
      <div className="flex items-center justify-between">
        <Link
          href="/agents"
          className="flex items-center gap-2 text-xs font-medium text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Agent Registry
        </Link>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      <MonitorHeader metrics={metrics} live={live} updatedAt={updatedAt} />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <ActiveTasks
            tasks={tasks}
            selectedId={selectedTaskId}
            onSelect={setSelectedTaskId}
          />
          <AgentNetwork agents={agents} metrics={metrics} />
        </div>

        <div className="space-y-6 lg:col-span-8">
          <AgentInspector
            task={selectedTask}
            agents={agents}
            onClose={() => setSelectedTaskId(null)}
          />
          <ExecutionTimeline task={selectedTask} />
          <ActivityStream
            events={events}
            paused={streamPaused}
            connected={live}
            onTogglePause={() => setStreamPaused((p) => !p)}
            onClear={() => setEvents([])}
          />
        </div>
      </div>
    </div>
  );
}
