"use client";

import clsx from "clsx";
import {
  BookOpenCheck,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  Filter,
  LogOut,
  RefreshCw,
  Undo2
} from "lucide-react";
import { useMemo, useState } from "react";
import type { SerializedSyncRun, SerializedTask } from "@/lib/serializers";

type Props = {
  initialTasks: SerializedTask[];
  courses: string[];
  syncRuns: SerializedSyncRun[];
  generatedAt: string;
};

type StatusFilter = "all" | "pending" | "done";
type UrgencyFilter = "all" | "overdue" | "today" | "week";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit"
});

const fullDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

export function Dashboard({ initialTasks, courses, syncRuns, generatedAt }: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [course, setCourse] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [urgency, setUrgency] = useState<UrgencyFilter>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const now = new Date(generatedAt).getTime();
  const stats = useMemo(() => {
    const pending = tasks.filter((task) => !task.manuallyDone);
    const overdue = pending.filter((task) => task.dueAt && new Date(task.dueAt).getTime() < now);
    const next48h = pending.filter((task) => {
      if (!task.dueAt) return false;
      const due = new Date(task.dueAt).getTime();
      return due >= now && due <= now + 48 * 60 * 60 * 1000;
    });

    return {
      total: tasks.length,
      pending: pending.length,
      overdue: overdue.length,
      next48h: next48h.length
    };
  }, [now, tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (course !== "all" && task.course !== course) return false;
      if (status === "pending" && task.manuallyDone) return false;
      if (status === "done" && !task.manuallyDone) return false;

      if (urgency !== "all") {
        if (!task.dueAt || task.manuallyDone) return false;
        const due = new Date(task.dueAt).getTime();
        const today = new Date(now);
        today.setHours(24, 0, 0, 0);

        if (urgency === "overdue" && due >= now) return false;
        if (urgency === "today" && due > today.getTime()) return false;
        if (urgency === "week" && due > now + 7 * 24 * 60 * 60 * 1000) return false;
      }

      return true;
    });
  }, [course, now, status, tasks, urgency]);

  async function updateDone(task: SerializedTask, manuallyDone: boolean) {
    setUpdatingId(task.id);
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manuallyDone })
    });
    setUpdatingId(null);

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { task: SerializedTask };
    setTasks((current) => current.map((item) => (item.id === task.id ? payload.task : item)));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const latestSync = syncRuns[0];

  return (
    <main className="app-shell">
      <div className="site-backdrop" aria-hidden="true">
        <video src="/moodle-cover.mp4" autoPlay muted loop playsInline />
        <div className="site-backdrop-shade" />
      </div>

      <header className="topbar">
        <div className="brand-cluster">
          <div className="brand-mark">
            <BookOpenCheck size={21} />
          </div>
          <div>
            <p className="eyebrow">Moodle AI</p>
            <strong>Tarefas Unisinos</strong>
          </div>
        </div>
        <nav className="topnav" aria-label="Visões do dashboard">
          <span className="active">Painel</span>
          <span>Tarefas</span>
          <span>Sync</span>
        </nav>
        <div className="topbar-actions">
          <span className="sync-chip">
            <CalendarClock size={15} />
            {latestSync ? formatDate(latestSync.startedAt) : "Sem sync"}
          </span>
          <button className="logout-button" type="button" onClick={logout}>
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>
      </header>

      <section className="dashboard-hero" aria-labelledby="dashboard-title">
        <div className="hero-copy">
          <p className="eyebrow">Agenda acadêmica</p>
          <h1 id="dashboard-title">Controle suas entregas sem abrir o Moodle toda hora.</h1>
          <p>
            Priorize prazos, acompanhe o último sync e marque o que já foi resolvido sem perder o
            status original da disciplina.
          </p>
        </div>
        <div className="hero-focus">
          <span>Próximas 48h</span>
          <strong>{stats.next48h}</strong>
          <small>{stats.overdue > 0 ? `${stats.overdue} vencida(s)` : "Nenhuma vencida"}</small>
        </div>
      </section>

      <section className="summary-grid" aria-label="Resumo">
        <Metric label="Pendentes" value={stats.pending} tone="primary" caption="A fazer" />
        <Metric label="Próximas 48h" value={stats.next48h} tone="warning" caption="Urgentes" />
        <Metric label="Vencidas" value={stats.overdue} tone="danger" caption="Atrasadas" />
        <Metric label="Total" value={stats.total} tone="muted" caption="Monitoradas" />
      </section>

      <section className="status-strip">
        <div className="status-item">
          <RefreshCw size={16} />
          <span>
            {latestSync
              ? `Último sync ${formatFullDate(latestSync.startedAt)}`
              : "Nenhum sync registrado"}
          </span>
        </div>
        {latestSync?.errorMessage ? <span className="sync-error">{latestSync.errorMessage}</span> : null}
      </section>

      <section className="toolbar" aria-label="Filtros">
        <div className="toolbar-title">
          <Filter size={16} />
          <span>Filtros</span>
        </div>
        <label className="select-wrap">
          <span>Disciplina</span>
          <select aria-label="Disciplina" value={course} onChange={(event) => setCourse(event.target.value)}>
            <option value="all">Todas as disciplinas</option>
            {courses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <ChevronDown size={16} />
        </label>
        <SegmentedFilter
          value={status}
          options={[
            ["pending", "Pendentes"],
            ["done", "Feitas"],
            ["all", "Todas"]
          ]}
          onChange={setStatus}
        />
        <SegmentedFilter
          value={urgency}
          options={[
            ["all", "Prazo"],
            ["overdue", "Vencidas"],
            ["today", "Hoje"],
            ["week", "7 dias"]
          ]}
          onChange={setUrgency}
        />
      </section>

      <section className="task-list" aria-label="Tarefas">
        {filteredTasks.length === 0 ? (
          <div className="empty-state">
            <Check size={20} />
            <span>Nenhuma tarefa para os filtros atuais.</span>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <article className={clsx("task-row", task.manuallyDone && "is-done")} key={task.id}>
              <div className="task-main">
                <div className="task-title-line">
                  <h2>{task.title}</h2>
                  <span className={clsx("status-pill", task.manuallyDone ? "done" : getDueTone(task.dueAt, now))}>
                    {task.manuallyDone ? "Feita" : getDueLabel(task.dueAt, now)}
                  </span>
                </div>
                <div className="task-meta">
                  <span>{task.course}</span>
                  <span className="meta-dot" />
                  <Clock3 size={14} />
                  <span>{task.dueAt ? formatDate(task.dueAt) : "Sem prazo"}</span>
                  <span className="meta-dot" />
                  <span className="source-tag">{task.source}</span>
                </div>
              </div>
              <div className="task-actions">
                {task.link ? (
                  <a className="icon-button" href={task.link} target="_blank" rel="noreferrer" aria-label="Abrir tarefa" title="Abrir tarefa">
                    <ExternalLink size={17} />
                  </a>
                ) : null}
                <button
                  className="icon-button"
                  type="button"
                  disabled={updatingId === task.id}
                  onClick={() => updateDone(task, !task.manuallyDone)}
                  aria-label={task.manuallyDone ? "Desmarcar como feita" : "Marcar como feita"}
                  title={task.manuallyDone ? "Desmarcar como feita" : "Marcar como feita"}
                >
                  {task.manuallyDone ? <Undo2 size={17} /> : <Check size={17} />}
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

function Metric({ label, value, tone, caption }: { label: string; value: number; tone: string; caption: string }) {
  return (
    <div className={clsx("metric", tone)}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{caption}</small>
    </div>
  );
}

function SegmentedFilter<T extends string>({
  value,
  options,
  onChange
}: {
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented-control">
      {options.map(([optionValue, label]) => (
        <button
          className={optionValue === value ? "active" : ""}
          key={optionValue}
          type="button"
          onClick={() => onChange(optionValue)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatFullDate(value: string) {
  return fullDateFormatter.format(new Date(value));
}

function getDueTone(value: string | null, now: number) {
  if (!value) return "muted";

  const due = new Date(value).getTime();

  if (due < now) return "danger";
  if (due < now + 48 * 60 * 60 * 1000) return "warning";
  return "primary";
}

function getDueLabel(value: string | null, now: number) {
  if (!value) return "Sem prazo";

  const due = new Date(value).getTime();

  if (due < now) return "Vencida";
  if (due < now + 48 * 60 * 60 * 1000) return "Até 48h";
  return "Pendente";
}
