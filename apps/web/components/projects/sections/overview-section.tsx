"use client";

import * as React from "react";
import {
  Clapperboard,
  Calendar,
  Users,
  UserCircle,
  Package,
  FileText,
  Clock,
  ChevronRight,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import type { Scene, CastMember, ShootingDay, CrewMember, GearItem, Script } from "@/lib/mock-data";
import type { Project } from "@/lib/actions/projects";

interface OverviewSectionProps {
  project: Project;
  scenes: Scene[];
  cast: CastMember[];
  crew: CrewMember[];
  shootingDays: ShootingDay[];
  gear: GearItem[];
  scripts: Script[];
  onNavigate: (section: string) => void;
}

export function OverviewSection({
  project,
  scenes,
  cast,
  crew,
  shootingDays,
  gear,
  scripts,
  onNavigate,
}: OverviewSectionProps) {
  const upcomingDays = shootingDays
    .filter((d) => d.status !== "COMPLETED" && d.status !== "CANCELLED")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  const hasContent = scenes.length > 0 || cast.length > 0 || crew.length > 0 || shootingDays.length > 0;

  // Show getting started view for empty projects
  if (!hasContent) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold mb-2">Welcome to {project.name}</h1>
          <p className="text-muted-foreground">
            Get started by adding the essentials to your production.
          </p>
        </div>

        <div className="space-y-3">
          <QuickStartCard
            icon={Calendar}
            title="Add shooting days"
            description="Set up your production schedule"
            onClick={() => onNavigate("schedule")}
          />
          <QuickStartCard
            icon={Clapperboard}
            title="Add scenes"
            description="Break down your script into scenes"
            onClick={() => onNavigate("scenes")}
          />
          <QuickStartCard
            icon={Users}
            title="Add cast members"
            description="Build your cast list"
            onClick={() => onNavigate("cast")}
          />
          <QuickStartCard
            icon={UserCircle}
            title="Add crew members"
            description="Organize your production team"
            onClick={() => onNavigate("crew")}
          />
          <QuickStartCard
            icon={FileText}
            title="Upload script"
            description="Keep track of script revisions"
            onClick={() => onNavigate("script")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Upcoming Shoots - Most Important */}
      {upcomingDays.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Upcoming</h2>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("schedule")}>
              View schedule
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <div className="space-y-2">
            {upcomingDays.map((day) => (
              <div
                key={day.id}
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => onNavigate("schedule")}
              >
                <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary">
                  <span className="text-lg font-semibold leading-none">
                    {new Date(day.date).getDate()}
                  </span>
                  <span className="text-[10px] uppercase">
                    {new Date(day.date).toLocaleDateString("en-US", { month: "short" })}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Day {day.dayNumber}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Call time: {day.generalCall}
                    {day.scenes.length > 0 && (
                      <span className="ml-2">{day.scenes.length} scenes</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Stats Grid */}
      <section>
        <h2 className="text-lg font-medium mb-4">At a glance</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Clapperboard}
            label="Scenes"
            value={scenes.length}
            onClick={() => onNavigate("scenes")}
          />
          <StatCard
            icon={Calendar}
            label="Shoot days"
            value={shootingDays.length}
            onClick={() => onNavigate("schedule")}
          />
          <StatCard
            icon={Users}
            label="Cast"
            value={cast.length}
            onClick={() => onNavigate("cast")}
          />
          <StatCard
            icon={UserCircle}
            label="Crew"
            value={crew.length}
            onClick={() => onNavigate("crew")}
          />
        </div>
      </section>

      {/* Recent Activity / Quick Access */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cast & Crew Preview */}
        {(cast.length > 0 || crew.length > 0) && (
          <section className="rounded-lg border border-border">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-medium">Team</h3>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {[...cast.slice(0, 4), ...crew.filter(c => c.isHead).slice(0, 4)].map((member, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-full bg-muted/50"
                  >
                    <Avatar
                      alt={"actorName" in member ? member.actorName : member.name}
                      src={"profilePhotoUrl" in member ? member.profilePhotoUrl : undefined}
                      size="sm"
                    />
                    <span className="text-sm">
                      {"characterName" in member ? member.characterName : member.name}
                    </span>
                  </div>
                ))}
                {(cast.length + crew.length) > 8 && (
                  <button
                    onClick={() => onNavigate("cast")}
                    className="flex items-center gap-2 px-3 py-2 rounded-full bg-muted/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
                  >
                    +{cast.length + crew.length - 8} more
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Script Status */}
        <section className="rounded-lg border border-border">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-medium">Script</h3>
          </div>
          <div className="p-4">
            {scripts.length > 0 ? (
              <div
                className="flex items-center gap-3 cursor-pointer hover:bg-muted/30 -m-2 p-2 rounded-lg transition-colors"
                onClick={() => onNavigate("script")}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{scripts[0].fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    Version {scripts[0].version}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ) : (
              <button
                onClick={() => onNavigate("script")}
                className="flex items-center gap-3 w-full text-left hover:bg-muted/30 -m-2 p-2 rounded-lg transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30">
                  <Plus className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-muted-foreground">Upload script</p>
                  <p className="text-sm text-muted-foreground/70">PDF format</p>
                </div>
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors text-left"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </button>
  );
}

function QuickStartCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 w-full p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors text-left group"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
        <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
    </button>
  );
}
