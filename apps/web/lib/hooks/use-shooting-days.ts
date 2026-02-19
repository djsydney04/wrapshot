"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ShootingDay } from "@/lib/types";

interface UseShootingDaysOptions {
  projectId?: string;
}

interface FetchShootingDaysOptions {
  silent?: boolean;
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

interface ShootingDaySceneRealtimeRow {
  shootingDayId?: string;
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
  const shootingDayIdsRef = useRef<Set<string>>(new Set());
  const isFetchingRef = useRef(false);
  const pendingSilentFetchRef = useRef(false);
  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const fetchShootingDays = useCallback(async ({ silent = false }: FetchShootingDaysOptions = {}) => {
    if (!projectId) {
      setShootingDays([]);
      setLoading(false);
      return;
    }

    if (isFetchingRef.current) {
      if (silent) {
        pendingSilentFetchRef.current = true;
      }
      return;
    }

    isFetchingRef.current = true;
    if (!silent) {
      setLoading(true);
    }
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
            sortOrder
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
      isFetchingRef.current = false;
      if (!silent) {
        setLoading(false);
      }

      if (pendingSilentFetchRef.current) {
        pendingSilentFetchRef.current = false;
        void fetchShootingDays({ silent: true });
      }
    }
  }, [projectId, supabase]);

  const queueRealtimeRefresh = useCallback(() => {
    if (realtimeRefreshTimeoutRef.current) {
      clearTimeout(realtimeRefreshTimeoutRef.current);
    }
    realtimeRefreshTimeoutRef.current = setTimeout(() => {
      void fetchShootingDays({ silent: true });
    }, 250);
  }, [fetchShootingDays]);

  // Initial fetch
  useEffect(() => {
    void fetchShootingDays();
  }, [fetchShootingDays]);

  useEffect(() => {
    return () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
    };
  }, []);

  // Subscribe to realtime updates
  useEffect(() => {
    shootingDayIdsRef.current = new Set(shootingDays.map((day) => day.id));
  }, [shootingDays]);

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
          queueRealtimeRefresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ShootingDayScene",
        }, (payload) => {
          const newRow = payload.new as ShootingDaySceneRealtimeRow | null;
          const oldRow = payload.old as ShootingDaySceneRealtimeRow | null;
          const shootingDayId = newRow?.shootingDayId || oldRow?.shootingDayId;

          if (
            shootingDayId &&
            !shootingDayIdsRef.current.has(shootingDayId)
          ) {
            return;
          }

          queueRealtimeRefresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queueRealtimeRefresh, supabase]);

  return {
    shootingDays,
    loading,
    error,
    refetch: () => fetchShootingDays(),
  };
}

// Hook to fetch all shooting days across all projects
export function useAllShootingDays() {
  const [shootingDays, setShootingDays] = useState<ShootingDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

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
            sortOrder
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
