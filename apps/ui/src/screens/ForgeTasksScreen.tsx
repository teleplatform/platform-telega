import { Link } from "react-router-dom";
import { useForgeTasks } from "../hooks/useForge";
import { ListChecks, Clock, User } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "text-muted",
  running: "text-yellow-400",
  completed: "text-green-400",
  failed: "text-red-400",
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ForgeTasksScreen() {
  const { tasks, loading } = useForgeTasks();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ListChecks className="w-6 h-6" />
          Tasks
        </h1>
        <Link to="/forge" className="px-3 py-2 bg-primary/20 rounded hover:bg-primary/30">
          Dashboard
        </Link>
      </div>

      {!tasks.length ? (
        <p className="text-muted text-center py-12">No tasks yet</p>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <div
              key={task.task_id}
              className="flex items-center justify-between p-3 bg-card border border-border rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{task.task}</p>
                <div className="flex items-center gap-3 text-xs text-muted mt-1">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {task.account_label}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(task.updated_at)}
                  </span>
                </div>
              </div>
              <span className={`font-mono text-sm ${STATUS_COLORS[task.status] ?? "text-muted"}`}>
                {task.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}