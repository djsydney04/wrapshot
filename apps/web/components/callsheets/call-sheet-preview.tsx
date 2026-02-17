"use client";

import * as React from "react";
import { format } from "date-fns";
import type { CallSheetFullData } from "@/lib/actions/call-sheets";

interface CallSheetPreviewProps {
  data: CallSheetFullData;
}

export function CallSheetPreview({ data }: CallSheetPreviewProps) {
  const { callSheet, shootingDay, project, scenes, castCallTimes, departmentCalls, locations } = data;

  const formattedDate = (() => {
    try {
      return format(new Date(shootingDay.date), "EEEE, MMMM d, yyyy");
    } catch {
      return shootingDay.date;
    }
  })();

  const totalPages = scenes.reduce((sum, s) => sum + Number(s.scene.pageCount || 0), 0);

  return (
    <div className="bg-white dark:bg-zinc-950 border border-border rounded-lg print:border-none print:rounded-none">
      <div className="max-w-4xl mx-auto p-8 space-y-6 text-sm print:p-4">
        {/* Header */}
        <div className="text-center border-b-2 border-foreground pb-4">
          <h1 className="text-xl font-bold uppercase tracking-wide">
            {project?.name || "Production"}
          </h1>
          <p className="text-base font-semibold mt-1">CALL SHEET — DAY {shootingDay.dayNumber}</p>
          <p className="text-muted-foreground mt-1">{formattedDate}</p>
          {callSheet.publishedAt && (
            <p className="text-xs text-muted-foreground mt-1">Version {callSheet.version}</p>
          )}
        </div>

        {/* Production Info Row */}
        <div className="grid grid-cols-3 gap-4 border-b border-border pb-4">
          <div>
            <Label>General Call</Label>
            <Value>{shootingDay.generalCall || "TBD"}</Value>
          </div>
          <div>
            <Label>Shooting Call</Label>
            <Value>{shootingDay.shootingCall || "TBD"}</Value>
          </div>
          <div>
            <Label>Estimated Wrap</Label>
            <Value>{shootingDay.estimatedWrap || "TBD"}</Value>
          </div>
          {project?.director && (
            <div>
              <Label>Director</Label>
              <Value>{project.director}</Value>
            </div>
          )}
          {project?.producer && (
            <div>
              <Label>Producer</Label>
              <Value>{project.producer}</Value>
            </div>
          )}
          {project?.productionCompany && (
            <div>
              <Label>Production Co.</Label>
              <Value>{project.productionCompany}</Value>
            </div>
          )}
          {shootingDay.weatherNotes && (
            <div className="col-span-3">
              <Label>Weather</Label>
              <Value>{shootingDay.weatherNotes}</Value>
            </div>
          )}
          {callSheet.nearestHospital && (
            <div className="col-span-3">
              <Label>Nearest Hospital</Label>
              <Value>{callSheet.nearestHospital}</Value>
            </div>
          )}
        </div>

        {/* Scene Schedule */}
        {scenes.length > 0 && (
          <div>
            <SectionTitle>Scene Schedule</SectionTitle>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50 print:bg-gray-100">
                  <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold">Scene</th>
                  <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold">D/N</th>
                  <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold">I/E</th>
                  <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold">Synopsis</th>
                  <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold">Cast</th>
                  <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold">Pages</th>
                  <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold">Location</th>
                </tr>
              </thead>
              <tbody>
                {scenes.map((s) => (
                  <tr key={s.sceneId}>
                    <td className="border border-border px-2 py-1.5 font-mono font-semibold">
                      {s.scene.sceneNumber}
                    </td>
                    <td className="border border-border px-2 py-1.5">{s.scene.dayNight}</td>
                    <td className="border border-border px-2 py-1.5">{s.scene.intExt}</td>
                    <td className="border border-border px-2 py-1.5 max-w-[200px]">
                      {s.scene.synopsis || "—"}
                    </td>
                    <td className="border border-border px-2 py-1.5">
                      {s.scene.castMembers
                        ?.map((cm) => cm.castMember.castNumber)
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                    <td className="border border-border px-2 py-1.5">
                      {Number(s.scene.pageCount).toFixed(1)}
                    </td>
                    <td className="border border-border px-2 py-1.5">
                      {s.scene.setName || s.scene.location?.name || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 print:bg-gray-50 font-semibold">
                  <td colSpan={5} className="border border-border px-2 py-1.5 text-right">
                    Total Pages:
                  </td>
                  <td className="border border-border px-2 py-1.5">{totalPages.toFixed(1)}</td>
                  <td className="border border-border px-2 py-1.5"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Cast Call Times */}
        {castCallTimes.length > 0 && (
          <div>
            <SectionTitle>Cast</SectionTitle>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50 print:bg-gray-100">
                  <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold">#</th>
                  <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold">Character</th>
                  <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold">Actor</th>
                  <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold">Status</th>
                  <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold">Pickup</th>
                  <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold">MU/Hair</th>
                  <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold">On Set</th>
                  <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {castCallTimes.map((ct) => (
                  <tr key={ct.castMemberId}>
                    <td className="border border-border px-2 py-1.5 font-mono">
                      {ct.castMember?.castNumber || "—"}
                    </td>
                    <td className="border border-border px-2 py-1.5 font-medium">
                      {ct.castMember?.characterName || "—"}
                    </td>
                    <td className="border border-border px-2 py-1.5">
                      {ct.castMember?.actorName || "—"}
                    </td>
                    <td className="border border-border px-2 py-1.5 font-mono">
                      {ct.workStatus}
                    </td>
                    <td className="border border-border px-2 py-1.5">{ct.pickupTime || "—"}</td>
                    <td className="border border-border px-2 py-1.5">{ct.muHairCall || "—"}</td>
                    <td className="border border-border px-2 py-1.5">{ct.onSetCall || "—"}</td>
                    <td className="border border-border px-2 py-1.5">{ct.remarks || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Department Calls */}
        {departmentCalls.length > 0 && (
          <div>
            <SectionTitle>Department Calls</SectionTitle>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50 print:bg-gray-100">
                  <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold">Department</th>
                  <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold">Call Time</th>
                  <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {departmentCalls.map((dc) => (
                  <tr key={dc.id}>
                    <td className="border border-border px-2 py-1.5 font-medium">{dc.department}</td>
                    <td className="border border-border px-2 py-1.5">{dc.callTime}</td>
                    <td className="border border-border px-2 py-1.5">{dc.notes || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Location Info */}
        {locations.length > 0 && (
          <div>
            <SectionTitle>Location</SectionTitle>
            <div className="space-y-3">
              {locations.map((loc, idx) => (
                <div key={idx} className="border border-border rounded p-3">
                  <p className="font-semibold">{loc.name}</p>
                  {loc.address && <p className="text-muted-foreground">{loc.address}</p>}
                  {loc.contactName && (
                    <p className="text-muted-foreground">
                      Contact: {loc.contactName}
                      {loc.contactPhone ? ` — ${loc.contactPhone}` : ""}
                    </p>
                  )}
                  {loc.parkingNotes && (
                    <p className="text-muted-foreground">Parking: {loc.parkingNotes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes Sections */}
        {(callSheet.safetyNotes || callSheet.mealNotes || callSheet.parkingNotes || callSheet.advanceNotes) && (
          <div className="space-y-3">
            {callSheet.safetyNotes && (
              <div>
                <SectionTitle>Safety Notes</SectionTitle>
                <p className="whitespace-pre-wrap">{callSheet.safetyNotes}</p>
              </div>
            )}
            {callSheet.mealNotes && (
              <div>
                <SectionTitle>Meals</SectionTitle>
                <p className="whitespace-pre-wrap">{callSheet.mealNotes}</p>
              </div>
            )}
            {callSheet.parkingNotes && (
              <div>
                <SectionTitle>Parking</SectionTitle>
                <p className="whitespace-pre-wrap">{callSheet.parkingNotes}</p>
              </div>
            )}
            {callSheet.advanceNotes && (
              <div>
                <SectionTitle>Advance Schedule</SectionTitle>
                <p className="whitespace-pre-wrap">{callSheet.advanceNotes}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t-2 border-foreground pt-3 text-center text-xs text-muted-foreground print:mt-8">
          <p>
            Generated by wrapshoot
            {callSheet.publishedAt && ` — Published ${format(new Date(callSheet.publishedAt), "MMM d, yyyy h:mm a")}`}
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold uppercase tracking-wider mb-2 border-b border-border pb-1">
      {children}
    </h3>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function Value({ children }: { children: React.ReactNode }) {
  return <p className="font-medium">{children}</p>;
}
