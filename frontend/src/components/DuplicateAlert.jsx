import React from 'react';
import { Layers, Info } from 'lucide-react';

export default function DuplicateAlert({
  groupId,
  duplicateGroupId,
  confidence,
  className = '',
}) {
  const activeGroupId = groupId || duplicateGroupId;
  if (!activeGroupId) return null;

  const percentage = confidence ? Math.round(confidence * 100) : null;

  return (
    <div
      className={`p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 shadow-2xs space-y-1.5 ${className}`}
      role="status"
    >
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-800">
          <Layers className="w-4 h-4" />
        </div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
          Similar Complaint Nearby Detected
        </h4>
      </div>

      <p className="text-xs text-amber-800 leading-relaxed pl-9">
        CivicPulse AI geospatial engine matched this issue with an existing community report in this vicinity.{' '}
        Joined cluster group <strong className="font-mono text-amber-950 font-bold">{activeGroupId}</strong>
        {percentage ? ` with ${percentage}% location and text similarity.` : '.'}
      </p>

      <p className="text-[11px] text-amber-700 pl-9 flex items-center gap-1 font-medium">
        <Info className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Grouping ensures municipal officers resolve multiple nearby complaints in a single field dispatch.</span>
      </p>
    </div>
  );
}

