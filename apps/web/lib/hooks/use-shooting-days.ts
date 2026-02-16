"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ShootingDay } from "@/lib/types";

interface UseShootingDaysOptions {
  projectId?: string;
}

// Type for Supabase response row
interface SupabaseShootingDayRow {
  id: string;
  projectId: string;
  date: string;
  dayNumber: number;
  unit: string;
  status: string;
  generalCall: string | null;
  estimatedWrap: string | null;
  notes: string | null;
  scenes?: { sceneId: string; sortOrder: number | null }[] | null;
}

// Transform database row to match the mock data format
function transformToShootingDay(row: SupabaseShootingDayRow): ShootingDay {
  // Handle the scenes relation which could be null or an array
  const sceneIds = Array.isArray(row.scenes)
    ? [...row.scenes]
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((s) => s.sceneId)
    : [];

  return {
    id: row.id,
    projectId: row.projectId,
    date: row.date,
    dayNumber: row.dayNumber,
    unit: (row.unit || "MAIN") as "MAIN" | "SECOND",
    status: (row.status || "TENTATIVE") as ShootingDay["status"],
    generalCall: row.generalCall || "07:00",
    wrapTime: row.estimatedWrap || undefined,
    scenes: sceneIds,
    notes: row.notes || undefined,
  };
}

export function useShootingDays({ projectId }: UseShootingDaysOptions = {}) {
  const [shootingDays, setShootingDays] = useState<ShootingDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchShootingDays = useCallback(async () => {
    if (!projectId) {
      setShootingDays([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("ShootingDay")
        .select(
          `
          id,
          projectId,
          date,
          dayNumber,
          unit,
          status,
          generalCall,
          estimatedWrap,
          notes,
          scenes:ShootingDayScene(
            sceneId,
            sortOrder,
            scene:Scene(
              id,
              sceneNumber,
              synopsis,
              intExt,
              dayNight,
              pageCount,
              location:Location(name)
            )
          )
        `
        )
        .eq("projectId", projectId)
        .order("date", { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      const rows = (data || []) as unknown as SupabaseShootingDayRow[];
      const transformed = rows.map(transformToShootingDay);
      setShootingDays(transformed);
    } catch (err) {
      console.error("Error fetching shooting days:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch shooting days");
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  // Initial fetch
  useEffect(() => {
    fetchShootingDays();
  }, [fetchShootingDays]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`shooting-days-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ShootingDay",
          filter: `projectId=eq.${projectId}`,
        },
        () => {
          // Refetch on any change
          fetchShootingDays();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ShootingDayScene",
        },
        () => {
          fetchShootingDays();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, supabase, fetchShootingDays]);

  return {
    shootingDays,
    loading,
    error,
    refetch: fetchShootingDays,
  };
}

// Hook to fetch all shooting days across all projects
export function useAllShootingDays() {
  const [shootingDays, setShootingDays] = useState<ShootingDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchAllShootingDays = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("ShootingDay")
        .select(
          `
          id,
          projectId,
          date,
          dayNumber,
          unit,
          status,
          generalCall,
          estimatedWrap,
          notes,
          scenes:ShootingDayScene(
            sceneId,
            sortOrder,
            scene:Scene(
              id,
              sceneNumber,
              synopsis,
              intExt,
              dayNight,
              pageCount,
              location:Location(name)
            )
          )
        `
        )
        .order("date", { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      const rows = (data || []) as unknown as SupabaseShootingDayRow[];
      const transformed = rows.map(transformToShootingDay);
      setShootingDays(transformed);
    } catch (err) {
      console.error("Error fetching all shooting days:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch shooting days");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAllShootingDays();
  }, [fetchAllShootingDays]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("all-shooting-days")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ShootingDay",
        },
        () => {
          fetchAllShootingDays();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ShootingDayScene",
        },
        () => {
          fetchAllShootingDays();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchAllShootingDays]);

  return {
    shootingDays,
    loading,
    error,
    refetch: fetchAllShootingDays,
  };
}
