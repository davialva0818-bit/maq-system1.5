import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Check, Maximize2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

const OS_FIELDS = [
  ['registration_date', 'Data de Registro'], ['attendance_date', 'Data de Atendimento'],
  ['service_type', 'Tipo de Atendimento'], ['visit_fee', 'Taxa de Visita'],
  ['customer_name', 'Nome Completo', 2], ['email', 'Email'], ['phone1', 'Celular 1'],
  ['phone2', 'Celular 2'], ['landline', 'Fixo'], ['cep', 'CEP'], ['address', 'Endereço', 2],
  ['number', 'Número'], ['neighborhood', 'Bairro'], ['city', 'Cidade'], ['state', 'UF'],
  ['complement', 'Complemento'], ['reference_point', 'Ponto de Referência', 2],
  ['product', 'Produto'], ['brand', 'Marca'], ['model', 'Modelo'], ['serial_number', 'Número de Série'],
  ['batch', 'Batch (Versão Produto)'],
  ['reported_defect', 'Defeito Reclamado', 4, true], ['observations', 'Observações', 4, true],
];

const LAUDO_FIELDS = [
  ['technical_diagnosis', 'Diagnóstico Técnico', 2, true], ['required_parts', 'Peças Necessárias', 2, true],
  ['technician', 'Técnico', 2], ['voltage_f1f2', 'Tensão F1+F2'], ['voltage_f1_terra', 'Tensão F1+Terra'],
  ['voltage_f2_terra', 'Tensão F2+Terra'],
];

const inputCls = 'w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900';
const spanCls = { 1: '', 2: 'sm:col-span-2', 4: 'col-span-full' };

const Field = ({ label, span = 1, multiline, testId, ...props }) => (
  <label className={`flex flex-col gap-0.5 ${spanCls[span]}`}>
    <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</span>
    {multiline
      ? <textarea rows={2} className={`${inputCls} resize-y`} data-testid={testId} {...props} />
      : <input className={inputCls} data-testid={testId} {...props} />}
  </label>
);

export const OrderInlineEditor = ({ order, statuses, onPatch, onOpenFull }) => {
  const { getAuthHeader } = useAuth();
  const [tab, setTab] = useState('os');
  const [draft, setDraft] = useState(order);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setDraft(order); }, [order.os_number]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (key, value) => {
    if ((order[key] ?? '') === (value ?? '')) return;
    setSaving(true);
    try {
      await axios.put(`${API}/service-orders/${encodeURIComponent(order.os_number)}`, { [key]: value }, getAuthHeader());
      onPatch(order.os_number, { [key]: value });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao salvar campo');
      setDraft((d) => ({ ...d, [key]: order[key] }));
    } finally { setSaving(false); }
  };

  const bind = (key) => ({
    value: draft[key] ?? '',
    onChange: (e) => setDraft((d) => ({ ...d, [key]: e.target.value })),
    onBlur: (e) => save(key, e.target.value),
  });

  const renderFields = (fields) => fields.map(([key, label, span, multiline]) => (
    <Field key={key} label={label} span={span} multiline={multiline} testId={`inline-${key}-${order.os_number}`} {...bind(key)} />
  ));

  return (
    <div className="mt-3 border-t border-dashed border-gray-200 pt-3" onClick={(e) => e.stopPropagation()} data-testid={`inline-editor-${order.os_number}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md bg-gray-100 p-0.5 text-xs" role="tablist">
          {[['os', 'Dados da OS'], ['laudo', 'Dados para Laudo']].map(([k, l]) => (
            <button key={k} type="button" role="tab" onClick={() => setTab(k)} data-testid={`inline-tab-${k}-${order.os_number}`}
              className={`rounded px-3 py-1 font-medium transition-colors ${tab === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          {saving && <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Salvando</span>}
          {!saving && saved && <span className="flex items-center gap-1 text-green-600"><Check className="h-3 w-3" />Salvo</span>}
          <button type="button" onClick={() => onOpenFull(order)} className="flex items-center gap-1 text-gray-500 hover:text-gray-900" data-testid={`inline-open-full-${order.os_number}`}>
            <Maximize2 className="h-3 w-3" />Abrir OS completa
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tab === 'os' ? (
          <>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Status</span>
              <select className={inputCls} value={draft.status || ''} data-testid={`inline-status-${order.os_number}`}
                onChange={(e) => { setDraft((d) => ({ ...d, status: e.target.value })); save('status', e.target.value); }}>
                {[...new Set([...(statuses || []), draft.status].filter(Boolean))].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Prioridade</span>
              <button type="button" data-testid={`inline-priority-${order.os_number}`}
                onClick={() => { const v = !draft.priority; setDraft((d) => ({ ...d, priority: v })); save('priority', v); }}
                className={`${inputCls} text-left font-medium ${draft.priority ? 'border-red-300 bg-red-50 text-red-700' : ''}`}>
                {draft.priority ? 'PRIORITÁRIA' : 'Normal'}
              </button>
            </label>
            {renderFields(OS_FIELDS)}
          </>
        ) : (
          <>
            <label className="flex flex-col gap-0.5 sm:col-span-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Instalação Correta?</span>
              <select className={inputCls} value={draft.installation_correct || ''} data-testid={`inline-installation-${order.os_number}`}
                onChange={(e) => { setDraft((d) => ({ ...d, installation_correct: e.target.value })); save('installation_correct', e.target.value); }}>
                <option value="">Selecione...</option>
                {['SIM', 'NÃO', 'NÃO VERIFICADO'].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            {renderFields(LAUDO_FIELDS)}
            <p className="col-span-full text-[11px] text-gray-400">Fotos e assinatura ficam em “Abrir OS completa”.</p>
          </>
        )}
      </div>
    </div>
  );
};
