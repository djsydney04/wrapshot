-- Performance indexes for high-frequency project and agent queries

CREATE INDEX IF NOT EXISTS idx_scene_project_id ON "Scene" ("projectId");
CREATE INDEX IF NOT EXISTS idx_shooting_day_project_id ON "ShootingDay" ("projectId");
CREATE INDEX IF NOT EXISTS idx_cast_member_project_id ON "CastMember" ("projectId");
CREATE INDEX IF NOT EXISTS idx_location_project_id ON "Location" ("projectId");
CREATE INDEX IF NOT EXISTS idx_element_project_id ON "Element" ("projectId");
CREATE INDEX IF NOT EXISTS idx_script_project_id ON "Script" ("projectId");

CREATE INDEX IF NOT EXISTS idx_agent_job_script_created_at
  ON "AgentJob" ("scriptId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_agent_job_script_status
  ON "AgentJob" ("scriptId", status);
