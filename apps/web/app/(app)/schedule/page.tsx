"use client";

import * as React from "react";
import { isSameDay } from "date-fns";
import { Plus, Calendar as CalendarIcon, List, CalendarDays } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/calendar/calendar";
import { WeekCalendar } from "@/components/calendar/week-calendar";
import { DayDetailPanel } from "@/components/calendar/day-detail";
import { AddShootingDayForm } from "@/components/forms/add-shooting-day-form";
import { useProjectStore } from "@/lib/stores/project-store";
import type { ShootingDay } from "@/lib/mock-data";

export default function SchedulePage() {
  const { shootingDays, scenes } = useProjectStore();

  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = React.useState<ShootingDay[]>([]);
  const [viewMode, setViewMode] = React.useState<"week" | "month" | "list">("week");
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [addFormDate, setAddFormDate] = React.useState<Date | undefined>();

  // Default to first project for now
  const defaultProjectId = "proj-1";

  const handleDayClick = (date: Date, events: ShootingDay[]) => {
    setSelectedDate(date);
    setSelectedDayEvents(events);
  };

  const handleClosePanel = () => {
    setSelectedDate(null);
    setSelectedDayEvents([]);
  };

  const handleAddClick = (date?: Date) => {
    setAddFormDate(date);
    setShowAddForm(true);
  };

  return (
    <div className="flex h-full flex-col">
      <Header
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Schedule" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border border-border rounded-md p-0.5">
              <Button
                variant={viewMode === "week" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setViewMode("week")}
                title="Week view"
              >
                <CalendarDays className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "month" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setViewMode("month")}
                title="Month view"
              >
                <CalendarIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setViewMode("list")}
                title="List view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button size="sm" className="gap-1" onClick={() => handleAddClick()}>
              <Plus className="h-4 w-4" />
              Add Day
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 overflow-hidden p-6 flex flex-col">
          <div className="mb-4 flex-shrink-0">
            <h1 className="text-2xl font-semibold text-foreground">Schedule</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your shooting schedule and plan production days
            </p>
          </div>

          <div className="flex-1 min-h-0">
            {viewMode === "week" ? (
              <WeekCalendar
                shootingDays={shootingDays}
                scenes={scenes}
                onDayClick={handleDayClick}
                onAddClick={handleAddClick}
                selectedDate={selectedDate || undefined}
                className="h-full"
              />
            ) : viewMode === "month" ? (
              <Calendar
                shootingDays={shootingDays}
                onDayClick={handleDayClick}
                selectedDate={selectedDate || undefined}
              />
            ) : (
              <div className="rounded-lg border border-border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Day</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Unit</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Call Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Scenes</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {shootingDays.map((day) => (
                      <tr
                        key={day.id}
                        className="hover:bg-[hsl(var(--notion-hover))] transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedDate(new Date(day.date));
                          setSelectedDayEvents(shootingDays.filter((d) =>
                            isSameDay(new Date(d.date), new Date(day.date))
                          ));
                        }}
                      >
                        <td className="px-4 py-3 text-sm font-medium">Day {day.dayNumber}</td>
                        <td className="px-4 py-3 text-sm">
                          {new Date(day.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm">{day.unit}</td>
                        <td className="px-4 py-3 text-sm">{day.generalCall}</td>
                        <td className="px-4 py-3 text-sm">{day.scenes.length}</td>
                        <td className="px-4 py-3 text-sm">{day.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Day Detail Panel */}
        {selectedDate && (
          <DayDetailPanel
            date={selectedDate}
            shootingDays={selectedDayEvents}
            scenes={scenes}
            onClose={handleClosePanel}
          />
        )}
      </div>

      {/* Add Shooting Day Form */}
      <AddShootingDayForm
        projectId={defaultProjectId}
        open={showAddForm}
        onOpenChange={setShowAddForm}
        defaultDate={addFormDate}
      />
    </div>
  );
}
