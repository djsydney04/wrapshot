import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";
import { getConfigError } from "./src/lib/env";
import { getSupabaseClient } from "./src/lib/supabase";
import {
  fetchCallSheetList,
  fetchDayOverview,
  fetchProjects,
  fetchShootingDays,
  formatDateForDb,
  formatTimeForInput,
  normalizeDayStatus,
  publishCallSheet,
  updateCallSheet,
  updateCastCall,
  updateShootingDay,
  upsertCrewCall,
  upsertDepartmentCall,
} from "./src/lib/mobile-data";
import type {
  AppTab,
  CallSheetListRow,
  CallSheetSummary,
  CastCallSummary,
  CrewCallSummary,
  DayOverview,
  DepartmentCallSummary,
  ProjectSummary,
  ShootingDayStatus,
  ShootingDaySummary,
} from "./src/types/mobile";

interface StatusChip {
  label: string;
  value: ShootingDayStatus;
}

const TAB_LABELS: Record<AppTab, string> = {
  today: "Today",
  schedule: "Schedule",
  callsheets: "Call Sheets",
  people: "People",
  more: "More",
};

const DAY_STATUSES: StatusChip[] = [
  { label: "Tentative", value: "TENTATIVE" },
  { label: "Scheduled", value: "SCHEDULED" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

function prettyDate(dateValue: string): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function trimOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function timeOrNull(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

function statusLabel(status: string): string {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/(^\w)|\s\w/g, (letter) => letter.toUpperCase());
}

interface MessageBannerProps {
  kind: "error" | "success";
  text: string;
}

function MessageBanner({ kind, text }: MessageBannerProps) {
  return (
    <View style={[styles.messageBanner, kind === "error" ? styles.errorBanner : styles.successBanner]}>
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

interface AuthScreenProps {
  loading: boolean;
  error: string | null;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}

function AuthScreen({
  loading,
  error,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: AuthScreenProps) {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.authContainer}>
        <Text style={styles.eyebrow}>ProdAI Mobile</Text>
        <Text style={styles.title}>Shoot-day command center</Text>
        <Text style={styles.description}>
          Same project data as web, optimized for quick viewing and updates while on set.
        </Text>

        {error ? <MessageBanner kind="error" text={error} /> : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={onEmailChange}
          />
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={onPasswordChange}
          />
          <Pressable
            onPress={onSubmit}
            disabled={loading}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed ? styles.buttonPressed : null,
              loading ? styles.buttonDisabled : null,
            ]}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Sign In</Text>}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

interface DaySummaryCardProps {
  day: ShootingDaySummary;
  statusSaving: boolean;
  notesSaving: boolean;
  onStatusChange: (nextStatus: ShootingDayStatus) => void;
  onNotesSave: (nextNotes: string | null) => void;
}

function DaySummaryCard({
  day,
  statusSaving,
  notesSaving,
  onStatusChange,
  onNotesSave,
}: DaySummaryCardProps) {
  const [notesDraft, setNotesDraft] = React.useState(day.notes ?? "");

  React.useEffect(() => {
    setNotesDraft(day.notes ?? "");
  }, [day.id, day.notes]);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Day {day.dayNumber}</Text>
      <Text style={styles.metaText}>{prettyDate(day.date)} • {day.unit} Unit</Text>
      <Text style={styles.metaText}>General call: {formatTimeForInput(day.generalCall) || "—"}</Text>
      <Text style={styles.metaText}>Estimated wrap: {formatTimeForInput(day.estimatedWrap) || "—"}</Text>

      <Text style={styles.sectionLabel}>Status</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {DAY_STATUSES.map((option) => {
          const isActive = option.value === day.status;
          return (
            <Pressable
              key={option.value}
              onPress={() => onStatusChange(option.value)}
              disabled={statusSaving}
              style={({ pressed }) => [
                styles.statusChip,
                isActive ? styles.statusChipActive : null,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <Text style={[styles.statusChipText, isActive ? styles.statusChipTextActive : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.sectionLabel}>Day notes</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        multiline
        placeholder="Operational notes for crew and cast"
        placeholderTextColor="#9CA3AF"
        value={notesDraft}
        onChangeText={setNotesDraft}
      />
      <Pressable
        onPress={() => onNotesSave(trimOrNull(notesDraft) ?? null)}
        disabled={notesSaving}
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed ? styles.buttonPressed : null,
          notesSaving ? styles.buttonDisabled : null,
        ]}
      >
        {notesSaving ? (
          <ActivityIndicator color="#111827" />
        ) : (
          <Text style={styles.secondaryButtonText}>Save Day Notes</Text>
        )}
      </Pressable>
    </View>
  );
}

interface CallSheetCardProps {
  callSheet: CallSheetSummary;
  saving: boolean;
  publishing: boolean;
  onSave: (payload: {
    nearestHospital: string | null;
    safetyNotes: string | null;
    parkingNotes: string | null;
    mealNotes: string | null;
    advanceNotes: string | null;
  }) => void;
  onPublish: () => void;
}

function CallSheetCard({ callSheet, saving, publishing, onSave, onPublish }: CallSheetCardProps) {
  const [nearestHospital, setNearestHospital] = React.useState(callSheet.nearestHospital ?? "");
  const [safetyNotes, setSafetyNotes] = React.useState(callSheet.safetyNotes ?? "");
  const [parkingNotes, setParkingNotes] = React.useState(callSheet.parkingNotes ?? "");
  const [mealNotes, setMealNotes] = React.useState(callSheet.mealNotes ?? "");
  const [advanceNotes, setAdvanceNotes] = React.useState(callSheet.advanceNotes ?? "");

  React.useEffect(() => {
    setNearestHospital(callSheet.nearestHospital ?? "");
    setSafetyNotes(callSheet.safetyNotes ?? "");
    setParkingNotes(callSheet.parkingNotes ?? "");
    setMealNotes(callSheet.mealNotes ?? "");
    setAdvanceNotes(callSheet.advanceNotes ?? "");
  }, [
    callSheet.id,
    callSheet.nearestHospital,
    callSheet.safetyNotes,
    callSheet.parkingNotes,
    callSheet.mealNotes,
    callSheet.advanceNotes,
  ]);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Call Sheet</Text>
      <Text style={styles.metaText}>
        Version {callSheet.version} • {callSheet.publishedAt ? "Published" : "Draft"}
      </Text>

      <Text style={styles.sectionLabel}>Nearest Hospital</Text>
      <TextInput
        style={styles.input}
        value={nearestHospital}
        placeholder="Hospital name and address"
        placeholderTextColor="#9CA3AF"
        onChangeText={setNearestHospital}
      />

      <Text style={styles.sectionLabel}>Safety Notes</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={safetyNotes}
        multiline
        placeholder="Set safety notes"
        placeholderTextColor="#9CA3AF"
        onChangeText={setSafetyNotes}
      />

      <Text style={styles.sectionLabel}>Parking Notes</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={parkingNotes}
        multiline
        placeholder="Parking and load-in details"
        placeholderTextColor="#9CA3AF"
        onChangeText={setParkingNotes}
      />

      <Text style={styles.sectionLabel}>Meal Notes</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={mealNotes}
        multiline
        placeholder="Meal break and catering"
        placeholderTextColor="#9CA3AF"
        onChangeText={setMealNotes}
      />

      <Text style={styles.sectionLabel}>Advance Notes</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={advanceNotes}
        multiline
        placeholder="Advance and logistics notes"
        placeholderTextColor="#9CA3AF"
        onChangeText={setAdvanceNotes}
      />

      <View style={styles.buttonRow}>
        <Pressable
          onPress={() =>
            onSave({
              nearestHospital: trimOrNull(nearestHospital),
              safetyNotes: trimOrNull(safetyNotes),
              parkingNotes: trimOrNull(parkingNotes),
              mealNotes: trimOrNull(mealNotes),
              advanceNotes: trimOrNull(advanceNotes),
            })
          }
          disabled={saving}
          style={({ pressed }) => [
            styles.secondaryButton,
            styles.buttonFlex,
            pressed ? styles.buttonPressed : null,
            saving ? styles.buttonDisabled : null,
          ]}
        >
          {saving ? <ActivityIndicator color="#111827" /> : <Text style={styles.secondaryButtonText}>Save</Text>}
        </Pressable>

        <Pressable
          onPress={onPublish}
          disabled={publishing}
          style={({ pressed }) => [
            styles.primaryButton,
            styles.buttonFlex,
            pressed ? styles.buttonPressed : null,
            publishing ? styles.buttonDisabled : null,
          ]}
        >
          {publishing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Publish</Text>}
        </Pressable>
      </View>
    </View>
  );
}

interface CastCallsCardProps {
  calls: CastCallSummary[];
  savingId: string | null;
  onSave: (id: string, payload: { workStatus: string; onSetCall: string | null; remarks: string | null }) => void;
}

function CastCallsCard({ calls, savingId, onSave }: CastCallsCardProps) {
  const [drafts, setDrafts] = React.useState<
    Record<string, { workStatus: string; onSetCall: string; remarks: string }>
  >({});

  React.useEffect(() => {
    const nextDrafts: Record<string, { workStatus: string; onSetCall: string; remarks: string }> = {};
    calls.forEach((call) => {
      nextDrafts[call.id] = {
        workStatus: call.workStatus,
        onSetCall: formatTimeForInput(call.onSetCall),
        remarks: call.remarks ?? "",
      };
    });
    setDrafts(nextDrafts);
  }, [calls]);

  if (calls.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cast Calls</Text>
        <Text style={styles.emptyText}>No cast call rows for this day.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Cast Calls</Text>
      {calls.map((call) => {
        const draft = drafts[call.id] || {
          workStatus: call.workStatus,
          onSetCall: formatTimeForInput(call.onSetCall),
          remarks: call.remarks ?? "",
        };

        return (
          <View key={call.id} style={styles.rowCard}>
            <Text style={styles.rowTitle}>#{call.castNumber ?? "—"} {call.characterName}</Text>
            <Text style={styles.rowSubtitle}>{call.actorName || "No actor assigned"}</Text>

            <View style={styles.inlineFieldRow}>
              <Text style={styles.inlineLabel}>Status</Text>
              <TextInput
                style={[styles.input, styles.inlineInput]}
                value={draft.workStatus}
                onChangeText={(nextValue) =>
                  setDrafts((previous) => ({
                    ...previous,
                    [call.id]: { ...draft, workStatus: nextValue },
                  }))
                }
              />
            </View>

            <View style={styles.inlineFieldRow}>
              <Text style={styles.inlineLabel}>On-set</Text>
              <TextInput
                style={[styles.input, styles.inlineInput]}
                value={draft.onSetCall}
                placeholder="07:00"
                placeholderTextColor="#9CA3AF"
                onChangeText={(nextValue) =>
                  setDrafts((previous) => ({
                    ...previous,
                    [call.id]: { ...draft, onSetCall: nextValue },
                  }))
                }
              />
            </View>

            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={draft.remarks}
              multiline
              placeholder="Remarks"
              placeholderTextColor="#9CA3AF"
              onChangeText={(nextValue) =>
                setDrafts((previous) => ({
                  ...previous,
                  [call.id]: { ...draft, remarks: nextValue },
                }))
              }
            />

            <Pressable
              onPress={() =>
                onSave(call.id, {
                  workStatus: draft.workStatus,
                  onSetCall: timeOrNull(draft.onSetCall),
                  remarks: trimOrNull(draft.remarks),
                })
              }
              disabled={savingId === call.id}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed ? styles.buttonPressed : null,
                savingId === call.id ? styles.buttonDisabled : null,
              ]}
            >
              {savingId === call.id ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Text style={styles.secondaryButtonText}>Save Cast Update</Text>
              )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

interface DepartmentCallsCardProps {
  callSheetId: string;
  departmentCalls: DepartmentCallSummary[];
  crewCalls: CrewCallSummary[];
  savingKey: string | null;
  onSaveDepartment: (payload: { department: string; callTime: string; notes: string | null }) => void;
  onSaveCrew: (payload: {
    crewName: string;
    callTime: string;
    notes: string | null;
    sortOrder: number;
  }) => void;
}

function DepartmentCallsCard({
  callSheetId,
  departmentCalls,
  crewCalls,
  savingKey,
  onSaveDepartment,
  onSaveCrew,
}: DepartmentCallsCardProps) {
  const [departmentDrafts, setDepartmentDrafts] = React.useState<
    Record<string, { callTime: string; notes: string }>
  >({});
  const [crewDrafts, setCrewDrafts] = React.useState<Record<string, { callTime: string; notes: string }>>({});

  React.useEffect(() => {
    const nextDepartmentDrafts: Record<string, { callTime: string; notes: string }> = {};
    departmentCalls.forEach((entry) => {
      nextDepartmentDrafts[entry.id] = {
        callTime: formatTimeForInput(entry.callTime),
        notes: entry.notes ?? "",
      };
    });
    setDepartmentDrafts(nextDepartmentDrafts);

    const nextCrewDrafts: Record<string, { callTime: string; notes: string }> = {};
    crewCalls.forEach((entry) => {
      nextCrewDrafts[entry.id] = {
        callTime: formatTimeForInput(entry.callTime),
        notes: entry.notes ?? "",
      };
    });
    setCrewDrafts(nextCrewDrafts);
  }, [callSheetId, departmentCalls, crewCalls]);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Department & Crew Calls</Text>

      <Text style={styles.sectionLabel}>Departments</Text>
      {departmentCalls.length === 0 ? (
        <Text style={styles.emptyText}>No department call rows.</Text>
      ) : (
        departmentCalls.map((entry) => {
          const draft = departmentDrafts[entry.id] || {
            callTime: formatTimeForInput(entry.callTime),
            notes: entry.notes ?? "",
          };

          return (
            <View key={entry.id} style={styles.rowCard}>
              <Text style={styles.rowTitle}>{entry.department}</Text>
              <View style={styles.inlineFieldRow}>
                <Text style={styles.inlineLabel}>Call</Text>
                <TextInput
                  style={[styles.input, styles.inlineInput]}
                  value={draft.callTime}
                  placeholder="07:00"
                  placeholderTextColor="#9CA3AF"
                  onChangeText={(nextValue) =>
                    setDepartmentDrafts((previous) => ({
                      ...previous,
                      [entry.id]: { ...draft, callTime: nextValue },
                    }))
                  }
                />
              </View>

              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={draft.notes}
                multiline
                placeholder="Notes"
                placeholderTextColor="#9CA3AF"
                onChangeText={(nextValue) =>
                  setDepartmentDrafts((previous) => ({
                    ...previous,
                    [entry.id]: { ...draft, notes: nextValue },
                  }))
                }
              />

              <Pressable
                onPress={() =>
                  onSaveDepartment({
                    department: entry.department,
                    callTime: draft.callTime,
                    notes: trimOrNull(draft.notes),
                  })
                }
                disabled={savingKey === `department:${entry.department}`}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed ? styles.buttonPressed : null,
                  savingKey === `department:${entry.department}` ? styles.buttonDisabled : null,
                ]}
              >
                {savingKey === `department:${entry.department}` ? (
                  <ActivityIndicator color="#111827" />
                ) : (
                  <Text style={styles.secondaryButtonText}>Save Department Call</Text>
                )}
              </Pressable>
            </View>
          );
        })
      )}

      <Text style={styles.sectionLabel}>Crew Calls</Text>
      {crewCalls.length === 0 ? (
        <Text style={styles.emptyText}>No crew call rows.</Text>
      ) : (
        crewCalls.map((entry) => {
          const draft = crewDrafts[entry.id] || {
            callTime: formatTimeForInput(entry.callTime),
            notes: entry.notes ?? "",
          };

          return (
            <View key={entry.id} style={styles.rowCard}>
              <Text style={styles.rowTitle}>{entry.crewName}</Text>
              <View style={styles.inlineFieldRow}>
                <Text style={styles.inlineLabel}>Call</Text>
                <TextInput
                  style={[styles.input, styles.inlineInput]}
                  value={draft.callTime}
                  placeholder="07:00"
                  placeholderTextColor="#9CA3AF"
                  onChangeText={(nextValue) =>
                    setCrewDrafts((previous) => ({
                      ...previous,
                      [entry.id]: { ...draft, callTime: nextValue },
                    }))
                  }
                />
              </View>

              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={draft.notes}
                multiline
                placeholder="Notes"
                placeholderTextColor="#9CA3AF"
                onChangeText={(nextValue) =>
                  setCrewDrafts((previous) => ({
                    ...previous,
                    [entry.id]: { ...draft, notes: nextValue },
                  }))
                }
              />

              <Pressable
                onPress={() =>
                  onSaveCrew({
                    crewName: entry.crewName,
                    callTime: draft.callTime,
                    notes: trimOrNull(draft.notes),
                    sortOrder: entry.sortOrder,
                  })
                }
                disabled={savingKey === `crew:${entry.crewName}`}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed ? styles.buttonPressed : null,
                  savingKey === `crew:${entry.crewName}` ? styles.buttonDisabled : null,
                ]}
              >
                {savingKey === `crew:${entry.crewName}` ? (
                  <ActivityIndicator color="#111827" />
                ) : (
                  <Text style={styles.secondaryButtonText}>Save Crew Call</Text>
                )}
              </Pressable>
            </View>
          );
        })
      )}
    </View>
  );
}

interface ScheduleTabProps {
  shootingDays: ShootingDaySummary[];
  savingId: string | null;
  onUpdate: (dayId: string, updates: Partial<Pick<ShootingDaySummary, "status" | "generalCall" | "notes">>) => void;
}

function ScheduleTab({ shootingDays, savingId, onUpdate }: ScheduleTabProps) {
  const [drafts, setDrafts] = React.useState<
    Record<string, { status: ShootingDayStatus; generalCall: string; notes: string }>
  >({});

  React.useEffect(() => {
    const nextDrafts: Record<string, { status: ShootingDayStatus; generalCall: string; notes: string }> = {};
    shootingDays.forEach((day) => {
      nextDrafts[day.id] = {
        status: normalizeDayStatus(day.status),
        generalCall: formatTimeForInput(day.generalCall),
        notes: day.notes ?? "",
      };
    });
    setDrafts(nextDrafts);
  }, [shootingDays]);

  if (shootingDays.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Schedule</Text>
        <Text style={styles.emptyText}>No shooting days yet for this project.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Schedule</Text>
      {shootingDays.map((day) => {
        const draft = drafts[day.id] || {
          status: normalizeDayStatus(day.status),
          generalCall: formatTimeForInput(day.generalCall),
          notes: day.notes ?? "",
        };

        return (
          <View key={day.id} style={styles.rowCard}>
            <Text style={styles.rowTitle}>Day {day.dayNumber} • {prettyDate(day.date)}</Text>
            <Text style={styles.rowSubtitle}>Current status: {statusLabel(day.status)}</Text>

            <Text style={styles.sectionLabel}>Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {DAY_STATUSES.map((statusOption) => {
                const isActive = draft.status === statusOption.value;
                return (
                  <Pressable
                    key={`${day.id}-${statusOption.value}`}
                    onPress={() =>
                      setDrafts((previous) => ({
                        ...previous,
                        [day.id]: { ...draft, status: statusOption.value },
                      }))
                    }
                    style={({ pressed }) => [
                      styles.statusChip,
                      isActive ? styles.statusChipActive : null,
                      pressed ? styles.buttonPressed : null,
                    ]}
                  >
                    <Text style={[styles.statusChipText, isActive ? styles.statusChipTextActive : null]}>
                      {statusOption.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.inlineFieldRow}>
              <Text style={styles.inlineLabel}>General call</Text>
              <TextInput
                style={[styles.input, styles.inlineInput]}
                value={draft.generalCall}
                placeholder="07:00"
                placeholderTextColor="#9CA3AF"
                onChangeText={(nextValue) =>
                  setDrafts((previous) => ({
                    ...previous,
                    [day.id]: { ...draft, generalCall: nextValue },
                  }))
                }
              />
            </View>

            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={draft.notes}
              multiline
              placeholder="Notes"
              placeholderTextColor="#9CA3AF"
              onChangeText={(nextValue) =>
                setDrafts((previous) => ({
                  ...previous,
                  [day.id]: { ...draft, notes: nextValue },
                }))
              }
            />

            <Pressable
              onPress={() =>
                onUpdate(day.id, {
                  status: draft.status,
                  generalCall: timeOrNull(draft.generalCall),
                  notes: trimOrNull(draft.notes),
                })
              }
              disabled={savingId === day.id}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed ? styles.buttonPressed : null,
                savingId === day.id ? styles.buttonDisabled : null,
              ]}
            >
              {savingId === day.id ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Text style={styles.secondaryButtonText}>Save Day</Text>
              )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

interface CallSheetsTabProps {
  rows: CallSheetListRow[];
  publishingId: string | null;
  onPublish: (callSheetId: string) => void;
}

function CallSheetsTab({ rows, publishingId, onPublish }: CallSheetsTabProps) {
  if (rows.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Call Sheets</Text>
        <Text style={styles.emptyText}>No call sheets available yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Call Sheets</Text>
      {rows.map((row) => (
        <View key={row.id} style={styles.rowCard}>
          <Text style={styles.rowTitle}>Day {row.dayNumber} • {prettyDate(row.date)}</Text>
          <Text style={styles.rowSubtitle}>
            v{row.version} • {row.publishedAt ? "Published" : "Draft"}
          </Text>

          <Pressable
            onPress={() => onPublish(row.id)}
            disabled={publishingId === row.id}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed ? styles.buttonPressed : null,
              publishingId === row.id ? styles.buttonDisabled : null,
            ]}
          >
            {publishingId === row.id ? (
              <ActivityIndicator color="#111827" />
            ) : (
              <Text style={styles.secondaryButtonText}>Publish Update</Text>
            )}
          </Pressable>
        </View>
      ))}
    </View>
  );
}

interface PeopleTabProps {
  castCalls: CastCallSummary[];
  savingId: string | null;
  onSave: (id: string, payload: { workStatus: string; onSetCall: string | null; remarks: string | null }) => void;
}

function PeopleTab({ castCalls, savingId, onSave }: PeopleTabProps) {
  return <CastCallsCard calls={castCalls} savingId={savingId} onSave={onSave} />;
}

function MoreTab() {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>More (Web-Mirrored Sections)</Text>
      <Text style={styles.metaText}>This phase keeps navigation familiar while prioritizing day-of workflows.</Text>
      {[
        "Dashboard",
        "Assistant",
        "Script",
        "Scenes",
        "Locations",
        "Art",
        "Camera",
        "G&E",
        "Post",
        "Budget",
        "Settings",
      ].map((label) => (
        <View key={label} style={styles.moreRow}>
          <Text style={styles.moreText}>{label}</Text>
          <Text style={styles.moreSubtext}>Available in web with deep-link support next.</Text>
        </View>
      ))}
    </View>
  );
}

export default function App() {
  const supabase = React.useMemo(() => getSupabaseClient(), []);
  const configError = getConfigError();

  const [session, setSession] = React.useState<Session | null>(null);
  const [authLoading, setAuthLoading] = React.useState(true);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [authPending, setAuthPending] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const [projects, setProjects] = React.useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = React.useState(false);
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(null);

  const [activeTab, setActiveTab] = React.useState<AppTab>("today");
  const [overview, setOverview] = React.useState<DayOverview | null>(null);
  const [shootingDays, setShootingDays] = React.useState<ShootingDaySummary[]>([]);
  const [callSheetRows, setCallSheetRows] = React.useState<CallSheetListRow[]>([]);
  const [dataLoading, setDataLoading] = React.useState(false);
  const [dataError, setDataError] = React.useState<string | null>(null);

  const [daySavingId, setDaySavingId] = React.useState<string | null>(null);
  const [callSheetSavingId, setCallSheetSavingId] = React.useState<string | null>(null);
  const [castSavingId, setCastSavingId] = React.useState<string | null>(null);
  const [callsSavingKey, setCallsSavingKey] = React.useState<string | null>(null);
  const [publishingId, setPublishingId] = React.useState<string | null>(null);

  const [message, setMessage] = React.useState<{ kind: "error" | "success"; text: string } | null>(null);

  const activeProject = React.useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  const showMessage = React.useCallback((kind: "error" | "success", text: string) => {
    setMessage({ kind, text });
  }, []);

  React.useEffect(() => {
    if (!message) return;

    const timeout = setTimeout(() => {
      setMessage(null);
    }, 2600);

    return () => clearTimeout(timeout);
  }, [message]);

  const loadProjects = React.useCallback(async () => {
    setProjectsLoading(true);
    setDataError(null);

    const result = await fetchProjects();
    if (result.error || !result.data) {
      setProjects([]);
      setActiveProjectId(null);
      setProjectsLoading(false);
      setDataError(result.error || "Failed to load projects");
      return;
    }

    const projectsData = result.data;
    setProjects(projectsData);
    setActiveProjectId((current) => {
      if (current && projectsData.some((project) => project.id === current)) {
        return current;
      }
      return projectsData[0]?.id ?? null;
    });
    setProjectsLoading(false);
  }, []);

  const loadProjectData = React.useCallback(async () => {
    if (!activeProjectId) return;

    setDataLoading(true);
    setDataError(null);

    const [overviewResult, shootingDaysResult, callSheetListResult] = await Promise.all([
      fetchDayOverview(activeProjectId, formatDateForDb()),
      fetchShootingDays(activeProjectId),
      fetchCallSheetList(activeProjectId),
    ]);

    if (overviewResult.error || !overviewResult.data) {
      setOverview(null);
      setDataError(overviewResult.error || "Failed to load today view");
      setDataLoading(false);
      return;
    }

    if (shootingDaysResult.error || !shootingDaysResult.data) {
      setShootingDays([]);
      setDataError(shootingDaysResult.error || "Failed to load schedule");
      setDataLoading(false);
      return;
    }

    if (callSheetListResult.error || !callSheetListResult.data) {
      setCallSheetRows([]);
      setDataError(callSheetListResult.error || "Failed to load call sheets");
      setDataLoading(false);
      return;
    }

    setOverview(overviewResult.data);
    setShootingDays(shootingDaysResult.data);
    setCallSheetRows(callSheetListResult.data);
    setDataLoading(false);
  }, [activeProjectId]);

  React.useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    const bootstrap = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) {
        setAuthError(error.message);
      }

      setSession(data.session ?? null);
      setAuthLoading(false);
    };

    void bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  React.useEffect(() => {
    if (!session) {
      setProjects([]);
      setActiveProjectId(null);
      setOverview(null);
      setShootingDays([]);
      setCallSheetRows([]);
      return;
    }

    void loadProjects();
  }, [session, loadProjects]);

  React.useEffect(() => {
    if (!activeProjectId) return;
    void loadProjectData();
  }, [activeProjectId, loadProjectData]);

  React.useEffect(() => {
    if (!supabase || !activeProjectId || !session) return;

    const channel = supabase
      .channel(`mobile-project-${activeProjectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ShootingDay",
          filter: `projectId=eq.${activeProjectId}`,
        },
        () => {
          void loadProjectData();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "CallSheet",
        },
        () => {
          void loadProjectData();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ShootingDayCast",
        },
        () => {
          void loadProjectData();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "CallSheetDepartment",
        },
        () => {
          void loadProjectData();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "CallSheetCrewCall",
        },
        () => {
          void loadProjectData();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, activeProjectId, session, loadProjectData]);

  const handleSignIn = React.useCallback(async () => {
    if (!supabase) {
      setAuthError("Supabase client is unavailable.");
      return;
    }

    if (!email.trim() || !password.trim()) {
      setAuthError("Email and password are required.");
      return;
    }

    setAuthPending(true);
    setAuthError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setAuthPending(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    setPassword("");
    showMessage("success", "Signed in.");
  }, [supabase, email, password, showMessage]);

  const handleSignOut = React.useCallback(async () => {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) {
      showMessage("error", error.message);
      return;
    }

    setActiveTab("today");
    showMessage("success", "Signed out.");
  }, [supabase, showMessage]);

  const handleRefresh = React.useCallback(async () => {
    if (!activeProjectId) return;
    await loadProjectData();
    showMessage("success", "Updated from live data.");
  }, [activeProjectId, loadProjectData, showMessage]);

  const handleDayStatusChange = React.useCallback(
    async (nextStatus: ShootingDayStatus) => {
      if (!overview?.day) return;

      setDaySavingId(overview.day.id);
      const result = await updateShootingDay(overview.day.id, { status: nextStatus });
      setDaySavingId(null);

      if (result.error) {
        showMessage("error", result.error);
        return;
      }

      await loadProjectData();
      showMessage("success", "Day status updated.");
    },
    [overview, loadProjectData, showMessage],
  );

  const handleDayNotesSave = React.useCallback(
    async (notes: string | null) => {
      if (!overview?.day) return;

      setDaySavingId(overview.day.id);
      const result = await updateShootingDay(overview.day.id, { notes });
      setDaySavingId(null);

      if (result.error) {
        showMessage("error", result.error);
        return;
      }

      await loadProjectData();
      showMessage("success", "Day notes saved.");
    },
    [overview, loadProjectData, showMessage],
  );

  const handleScheduleDaySave = React.useCallback(
    async (
      dayId: string,
      updates: Partial<Pick<ShootingDaySummary, "status" | "generalCall" | "notes">>,
    ) => {
      setDaySavingId(dayId);
      const result = await updateShootingDay(dayId, updates);
      setDaySavingId(null);

      if (result.error) {
        showMessage("error", result.error);
        return;
      }

      await loadProjectData();
      showMessage("success", "Schedule row saved.");
    },
    [loadProjectData, showMessage],
  );

  const handleCallSheetSave = React.useCallback(
    async (payload: {
      nearestHospital: string | null;
      safetyNotes: string | null;
      parkingNotes: string | null;
      mealNotes: string | null;
      advanceNotes: string | null;
    }) => {
      if (!overview?.callSheet) return;

      setCallSheetSavingId(overview.callSheet.id);
      const result = await updateCallSheet(overview.callSheet.id, payload);
      setCallSheetSavingId(null);

      if (result.error) {
        showMessage("error", result.error);
        return;
      }

      await loadProjectData();
      showMessage("success", "Call sheet saved.");
    },
    [overview, loadProjectData, showMessage],
  );

  const handlePublishCallSheet = React.useCallback(
    async (callSheetId: string) => {
      setPublishingId(callSheetId);
      const result = await publishCallSheet(callSheetId);
      setPublishingId(null);

      if (result.error) {
        showMessage("error", result.error);
        return;
      }

      await loadProjectData();
      showMessage("success", "Call sheet published.");
    },
    [loadProjectData, showMessage],
  );

  const handleCastCallSave = React.useCallback(
    async (
      castCallId: string,
      payload: {
        workStatus: string;
        onSetCall: string | null;
        remarks: string | null;
      },
    ) => {
      setCastSavingId(castCallId);
      const result = await updateCastCall(castCallId, payload);
      setCastSavingId(null);

      if (result.error) {
        showMessage("error", result.error);
        return;
      }

      await loadProjectData();
      showMessage("success", "Cast call updated.");
    },
    [loadProjectData, showMessage],
  );

  const handleDepartmentCallSave = React.useCallback(
    async (payload: { department: string; callTime: string; notes: string | null }) => {
      if (!overview?.callSheet) return;
      if (!payload.callTime.trim()) {
        showMessage("error", "Department call time is required.");
        return;
      }

      const key = `department:${payload.department}`;
      setCallsSavingKey(key);
      const result = await upsertDepartmentCall({
        callSheetId: overview.callSheet.id,
        department: payload.department,
        callTime: payload.callTime,
        notes: payload.notes,
      });
      setCallsSavingKey(null);

      if (result.error) {
        showMessage("error", result.error);
        return;
      }

      await loadProjectData();
      showMessage("success", "Department call updated.");
    },
    [overview, loadProjectData, showMessage],
  );

  const handleCrewCallSave = React.useCallback(
    async (payload: {
      crewName: string;
      callTime: string;
      notes: string | null;
      sortOrder: number;
    }) => {
      if (!overview?.callSheet) return;
      if (!payload.callTime.trim()) {
        showMessage("error", "Crew call time is required.");
        return;
      }

      const key = `crew:${payload.crewName}`;
      setCallsSavingKey(key);
      const result = await upsertCrewCall({
        callSheetId: overview.callSheet.id,
        crewName: payload.crewName,
        callTime: payload.callTime,
        notes: payload.notes,
        sortOrder: payload.sortOrder,
      });
      setCallsSavingKey(null);

      if (result.error) {
        showMessage("error", result.error);
        return;
      }

      await loadProjectData();
      showMessage("success", "Crew call updated.");
    },
    [overview, loadProjectData, showMessage],
  );

  if (configError) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        <View style={styles.authContainer}>
          <Text style={styles.eyebrow}>ProdAI Mobile</Text>
          <Text style={styles.title}>Configuration required</Text>
          <MessageBanner kind="error" text={configError} />
        </View>
      </SafeAreaView>
    );
  }

  if (authLoading) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#111827" />
          <Text style={styles.metaText}>Loading session…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <AuthScreen
        loading={authPending}
        error={authError}
        email={email}
        password={password}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={handleSignIn}
      />
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>ProdAI Mobile</Text>
          <Text style={styles.headerTitle}>Day-of operations</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectRow}>
            {projects.map((project) => {
              const active = project.id === activeProjectId;
              return (
                <Pressable
                  key={project.id}
                  onPress={() => setActiveProjectId(project.id)}
                  style={({ pressed }) => [
                    styles.projectChip,
                    active ? styles.projectChipActive : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <Text style={[styles.projectChipText, active ? styles.projectChipTextActive : null]}>
                    {project.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.headerActions}>
            <Pressable
              onPress={handleRefresh}
              disabled={dataLoading || projectsLoading || !activeProjectId}
              style={({ pressed }) => [
                styles.secondaryButton,
                styles.buttonFlex,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Refresh</Text>
            </Pressable>
            <Pressable
              onPress={handleSignOut}
              style={({ pressed }) => [
                styles.secondaryButton,
                styles.buttonFlex,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Sign Out</Text>
            </Pressable>
          </View>

          <Text style={styles.metaText}>
            {activeProject
              ? `${activeProject.name} • ${statusLabel(activeProject.status)}`
              : projectsLoading
                ? "Loading projects…"
                : "No project selected"}
          </Text>
        </View>

        {message ? <MessageBanner kind={message.kind} text={message.text} /> : null}
        {dataError ? <MessageBanner kind="error" text={dataError} /> : null}

        <View style={styles.tabBar}>
          {(Object.keys(TAB_LABELS) as AppTab[]).map((tab) => {
            const active = tab === activeTab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={({ pressed }) => [
                  styles.tabButton,
                  active ? styles.tabButtonActive : null,
                  pressed ? styles.buttonPressed : null,
                ]}
              >
                <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{TAB_LABELS[tab]}</Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {dataLoading || projectsLoading ? (
            <View style={styles.centeredCard}>
              <ActivityIndicator color="#111827" />
              <Text style={styles.metaText}>Syncing latest updates…</Text>
            </View>
          ) : !activeProjectId ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No project</Text>
              <Text style={styles.emptyText}>You are signed in but have no assigned projects yet.</Text>
            </View>
          ) : activeTab === "today" ? (
            overview?.day ? (
              <>
                <DaySummaryCard
                  day={overview.day}
                  statusSaving={daySavingId === overview.day.id}
                  notesSaving={daySavingId === overview.day.id}
                  onStatusChange={handleDayStatusChange}
                  onNotesSave={handleDayNotesSave}
                />
                {overview.callSheet ? (
                  <CallSheetCard
                    callSheet={overview.callSheet}
                    saving={callSheetSavingId === overview.callSheet.id}
                    publishing={publishingId === overview.callSheet.id}
                    onSave={handleCallSheetSave}
                    onPublish={() => handlePublishCallSheet(overview.callSheet!.id)}
                  />
                ) : (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Call Sheet</Text>
                    <Text style={styles.emptyText}>No call sheet available for this shooting day.</Text>
                  </View>
                )}

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Scenes ({overview.scenes.length})</Text>
                  {overview.scenes.length === 0 ? (
                    <Text style={styles.emptyText}>No scenes assigned.</Text>
                  ) : (
                    overview.scenes.map((scene) => (
                      <View key={scene.id} style={styles.rowCard}>
                        <Text style={styles.rowTitle}>
                          Scene {scene.sceneNumber} • {scene.intExt}/{scene.dayNight}
                        </Text>
                        <Text style={styles.rowSubtitle}>{scene.synopsis || "No synopsis"}</Text>
                        <Text style={styles.metaText}>
                          {scene.locationName || scene.setName || "No location"} • {scene.pageCount} pgs
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                <CastCallsCard
                  calls={overview.castCalls}
                  savingId={castSavingId}
                  onSave={handleCastCallSave}
                />

                {overview.callSheet ? (
                  <DepartmentCallsCard
                    callSheetId={overview.callSheet.id}
                    departmentCalls={overview.departmentCalls}
                    crewCalls={overview.crewCalls}
                    savingKey={callsSavingKey}
                    onSaveDepartment={handleDepartmentCallSave}
                    onSaveCrew={handleCrewCallSave}
                  />
                ) : null}
              </>
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Today</Text>
                <Text style={styles.emptyText}>No shooting day is scheduled for this project.</Text>
              </View>
            )
          ) : activeTab === "schedule" ? (
            <ScheduleTab shootingDays={shootingDays} savingId={daySavingId} onUpdate={handleScheduleDaySave} />
          ) : activeTab === "callsheets" ? (
            <CallSheetsTab rows={callSheetRows} publishingId={publishingId} onPublish={handlePublishCallSheet} />
          ) : activeTab === "people" ? (
            <PeopleTab castCalls={overview?.castCalls || []} savingId={castSavingId} onSave={handleCastCallSave} />
          ) : (
            <MoreTab />
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F4F1EA",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  centeredCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 20,
  },
  authContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 26,
    gap: 12,
  },
  headerCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 10,
  },
  headerTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
    color: "#111827",
  },
  eyebrow: {
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontWeight: "700",
    fontSize: 11,
    color: "#6B5A3C",
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "700",
    color: "#1F2937",
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: "#374151",
  },
  content: {
    paddingBottom: 26,
    gap: 10,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  metaText: {
    fontSize: 13,
    color: "#4B5563",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: "#111827",
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  inlineFieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineLabel: {
    width: 70,
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "600",
  },
  inlineInput: {
    flex: 1,
  },
  chipRow: {
    gap: 8,
  },
  statusChip: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F9FAFB",
  },
  statusChipActive: {
    borderColor: "#111827",
    backgroundColor: "#111827",
  },
  statusChipText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "600",
  },
  statusChipTextActive: {
    color: "#FFFFFF",
  },
  rowCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 10,
    gap: 8,
    backgroundColor: "#FCFCFD",
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  rowSubtitle: {
    fontSize: 13,
    color: "#4B5563",
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#111827",
    minHeight: 40,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    minHeight: 40,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.86,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  buttonFlex: {
    flex: 1,
  },
  messageBanner: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },
  successBanner: {
    backgroundColor: "#ECFDF5",
    borderColor: "#86EFAC",
  },
  messageText: {
    fontSize: 13,
    color: "#111827",
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 19,
  },
  projectRow: {
    gap: 8,
  },
  projectChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  projectChipActive: {
    borderColor: "#111827",
    backgroundColor: "#111827",
  },
  projectChipText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
  },
  projectChipTextActive: {
    color: "#FFFFFF",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  tabButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  tabButtonActive: {
    backgroundColor: "#111827",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  moreRow: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 10,
    gap: 2,
  },
  moreText: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "700",
  },
  moreSubtext: {
    fontSize: 12,
    color: "#6B7280",
  },
});
