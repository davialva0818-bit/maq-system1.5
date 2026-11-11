import React from 'react';
import { Clock, MapPin, Route as RouteIcon, AlertTriangle } from 'lucide-react';

const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`);

const KanbanColumn = ({ opt, checked, onToggle, onApply }) => (
  <div className={`flex min-w-[260px] flex-1 snap-start flex-col rounded-lg border-2 bg-white ${checked ? 'border-blue-600 ring-2 ring-blue-200' : 'border-blue-100'}`} data-testid={`kanban-col-${opt.key}`}>
    <div className="border-b border-gray-100 p-3">
      <div className="flex items-start gap-2">
        <input type="checkbox" checked={checked} onChange={() => onToggle(opt.key)} className="mt-0.5 h-4 w-4 rounded" data-testid={`proximity-check-${opt.key}`} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900">{opt.name}</div>
          <div className="truncate text-[11px] text-gray-500">{opt.meta.cities.join(' · ')}</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">{opt.orders.length} OS</span>
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{opt.meta.distance_km} km</span>
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{fmtMin(opt.meta.travel_minutes)} rodando</span>
        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">término ~{opt.meta.end_time}</span>
      </div>
      {opt.meta.neighborhoods.length > 0 && (
        <div className="mt-1.5 truncate text-[10px] text-gray-400">Bairros: {opt.meta.neighborhoods.join(', ')}</div>
      )}
    </div>
    <ol className="max-h-72 flex-1 space-y-1.5 overflow-y-auto p-2" data-testid={`kanban-list-${opt.key}`}>
      {opt.orders.map((o, i) => (
        <li key={o.os_number} className="rounded-md border border-gray-100 bg-gray-50 p-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-semibold text-gray-900">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-gray-900 text-[9px] text-white">{i + 1}</span>
              OS {o.os_number}
              {o.priority && <AlertTriangle className="h-3 w-3 text-red-600" />}
            </span>
            <span className="flex items-center gap-0.5 text-[10px] text-gray-500"><Clock className="h-3 w-3" />{o._eta}</span>
          </div>
          <div className="mt-0.5 truncate text-gray-700">{o.customer_name}</div>
          <div className="flex items-center gap-1 truncate text-[10px] text-gray-400">
            <MapPin className="h-3 w-3 shrink-0" />{[o.neighborhood, o.city].filter(Boolean).join(' · ')}
            {o._leg != null && <span className="ml-auto shrink-0">+{o._leg} min</span>}
          </div>
        </li>
      ))}
    </ol>
    <div className="border-t border-gray-100 p-2">
      <button type="button" onClick={() => onApply(opt)} className="flex w-full items-center justify-center gap-1 rounded-md bg-gray-900 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700" data-testid={`proximity-apply-${opt.key}`}>
        <RouteIcon className="h-3.5 w-3.5" />Usar este roteiro
      </button>
      <div className="mt-1 text-center text-[9px] text-gray-400">tempo por {opt.meta.source}</div>
    </div>
  </div>
);

export const RouteSuggestionsKanban = ({ options, selected, onToggle, onApply }) => (
  <div className="flex snap-x gap-2 overflow-x-auto pb-1" data-testid="route-kanban">
    {options.map((opt) => (
      <KanbanColumn key={opt.key} opt={opt} checked={selected.has(opt.key)} onToggle={onToggle} onApply={onApply} />
    ))}
  </div>
);
