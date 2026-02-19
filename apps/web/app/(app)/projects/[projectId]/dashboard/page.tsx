import { redirect } from "next/navigation";

export default async function ProjectDashboardPage({
  params,
}: {
  params: { projectId: string };
}) {
  const { projectId } = params;
  redirect(`/projects/${projectId}?section=dashboard`);
}
