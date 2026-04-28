export function handoffBuildTask(task: unknown) {
  sessionStorage.setItem(
    "telegpt_forge_handoff",
    JSON.stringify({
      kind: "FORGE_HANDOFF_BUILD_TASK_V1",
      task,
    })
  );
  const url = new URL(window.location.href);
  url.pathname = "/studio";
  url.searchParams.set("tab", "forge");
  url.searchParams.set("handoff", "1");
  window.location.href = url.toString();
}
