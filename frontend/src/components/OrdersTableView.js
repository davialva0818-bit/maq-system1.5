import React from 'react';
import { Plus, Minus } from 'lucide-react';

const COLS = ['', 'OS', 'Cliente', 'Produto', 'Status', 'Tipo', 'Cidade', 'Registro', ''];

export const OrdersTableView = ({ orders, expanded, onToggle, onOpen, statusColors, normalizeType, renderEditor, renderActions }) => (
  <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white" data-testid="orders-table">
    <table className="w-full text-sm">
      <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
        <tr>{COLS.map((c, i) => <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">{c}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {orders.map((o) => {
          const open = expanded.has(o.os_number);
          const sc = statusColors[o.status] || { bg: '#F3F4F6', text: '#4B5563' };
          return (
            <React.Fragment key={o.id || o.os_number}>
              <tr className="cursor-pointer hover:bg-gray-50" onClick={() => onOpen(o)} data-testid={`order-row-${o.os_number}`}>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => onToggle(o.os_number)} className="grid h-6 w-6 place-items-center rounded border border-gray-300 text-gray-600 hover:bg-gray-900 hover:text-white" data-testid={`expand-row-${o.os_number}`} title={open ? 'Recolher' : 'Expandir'}>
                    {open ? <Minus size={12} /> : <Plus size={12} />}
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-semibold text-gray-900">
                  {o.os_number}
                  {o.priority && <span className="ml-1 rounded bg-red-600 px-1 text-[10px] text-white">!</span>}
                </td>
                <td className="max-w-[180px] truncate px-3 py-2">{o.customer_name}</td>
                <td className="max-w-[220px] truncate px-3 py-2 text-gray-500">{o.product} {o.brand} {o.model}</td>
                <td className="px-3 py-2"><span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: sc.bg, color: sc.text }}>{o.status}</span></td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-purple-600">{normalizeType(o.service_type)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">{o.city}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-400">{o.registration_date}</td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>{renderActions(o)}</td>
              </tr>
              {open && (
                <tr className="bg-gray-50/60">
                  <td colSpan={COLS.length} className="px-4 pb-4">{renderEditor(o)}</td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  </div>
);
