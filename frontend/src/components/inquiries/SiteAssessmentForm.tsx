import type { SiteAssessmentData } from '../../types';

export const emptySiteAssessmentData: SiteAssessmentData = {
  poolLengthFt: '',
  poolWidthFt: '',
  shallowDepthFt: '',
  deepDepthFt: '',
  interiorFinishAreaSqFt: '',
  poolPerimeterFt: '',
  deckAreaSqFt: '',
  hardscapeRemovalSqFt: '',
  yardPregradeAreaSqFt: '',
  spaDimensions: '',
  equipmentAccessWidthFt: '',
  accessRouteNotes: '',
  excavationNotes: '',
  gradingDrainageNotes: '',
  demolitionHaulNotes: '',
  restorationNotes: '',
  equipmentPadDistanceFt: '',
  electricalRunFt: '',
  electricalServiceNotes: '',
  gasRunFt: '',
  gasSourceAndUseNotes: '',
  utilityConstraints: '',
  raisedWallDimensions: '',
  wallVeneerAreaSqFt: '',
  waterFeatureCounts: '',
  scopeResponsibilities: '',
  estimateAssumptions: '',
};

type SurveyKey = keyof SiteAssessmentData;
type SurveyField = { key: SurveyKey; label: string; placeholder: string; multiline?: boolean };
type SurveyGroup = { title: string; description: string; fields: SurveyField[] };

const groups: SurveyGroup[] = [
  {
    title: 'Pool layout and surfaces',
    description: 'Approximate field measurements are fine; note the measurement source if it is not verified.',
    fields: [
      { key: 'poolLengthFt', label: 'Proposed pool length (ft)', placeholder: 'e.g. 30 or 28–32' },
      { key: 'poolWidthFt', label: 'Proposed pool width (ft)', placeholder: 'e.g. 14' },
      { key: 'shallowDepthFt', label: 'Shallow depth (ft)', placeholder: 'e.g. 3.5' },
      { key: 'deepDepthFt', label: 'Deep depth (ft)', placeholder: 'e.g. 6' },
      { key: 'interiorFinishAreaSqFt', label: 'Pool interior finish area (sq ft)', placeholder: 'If measured; otherwise leave blank' },
      { key: 'poolPerimeterFt', label: 'Pool perimeter / coping (linear ft)', placeholder: 'Approximate length' },
      { key: 'deckAreaSqFt', label: 'New deck / paver area (sq ft)', placeholder: 'Approximate area' },
      { key: 'hardscapeRemovalSqFt', label: 'Existing hardscape to remove (sq ft)', placeholder: 'Concrete, pavers, etc.' },
      { key: 'spaDimensions', label: 'Spa size or dimensions', placeholder: 'Attached / separate and approximate dimensions' },
    ],
  },
  {
    title: 'Access and earthwork',
    description: 'These conditions can materially change excavation, hauling, and restoration scope.',
    fields: [
      { key: 'equipmentAccessWidthFt', label: 'Narrowest equipment access (ft)', placeholder: 'Approximate clear width' },
      { key: 'yardPregradeAreaSqFt', label: 'Yard pre-grade area (sq ft)', placeholder: 'Approximate area affected' },
      { key: 'accessRouteNotes', label: 'Access route and obstacles', placeholder: 'Gates, walls, overhead wires, neighbor access, crane needs…', multiline: true },
      { key: 'excavationNotes', label: 'Excavation / soil conditions', placeholder: 'Rock, hard dig, groundwater, buried debris, or not yet verified…', multiline: true },
      { key: 'gradingDrainageNotes', label: 'Grade, retaining, and drainage', placeholder: 'Slopes, retaining needs, drainage flow, or known concerns…', multiline: true },
      { key: 'demolitionHaulNotes', label: 'Removal, disposal, and haul-off', placeholder: 'What must be removed and who is expected to handle it…', multiline: true },
      { key: 'restorationNotes', label: 'Yard restoration after construction', placeholder: 'Landscape / irrigation restoration and responsible party…', multiline: true },
    ],
  },
  {
    title: 'Utilities and equipment runs',
    description: 'Record approximate routes and distances; mark capacity or routing questions for verification.',
    fields: [
      { key: 'equipmentPadDistanceFt', label: 'Pool to equipment-pad route (ft)', placeholder: 'Approximate plumbing / equipment distance' },
      { key: 'electricalRunFt', label: 'Electrical conduit run (ft)', placeholder: 'Approximate panel-to-equipment route' },
      { key: 'electricalServiceNotes', label: 'Panel, circuits, and electrical needs', placeholder: 'Available capacity, GFCI, lighting conduit, or electrician review…', multiline: true },
      { key: 'gasRunFt', label: 'Gas line run (ft)', placeholder: 'Approximate source-to-equipment route, or N/A' },
      { key: 'gasSourceAndUseNotes', label: 'Gas source and planned use', placeholder: 'Meter/source, pool heater, fire feature, or capacity review…', multiline: true },
      { key: 'utilityConstraints', label: 'Utilities, septic, wells, easements', placeholder: 'Known locations, conflicts, permits, or items to locate/verify…', multiline: true },
    ],
  },
  {
    title: 'Features and estimate assumptions',
    description: 'Capture quantities and ownership assumptions, not prices. Unknown items should stay visible for follow-up.',
    fields: [
      { key: 'raisedWallDimensions', label: 'Raised / retaining feature walls', placeholder: 'Length × height, finish area, and which sides…' },
      { key: 'wallVeneerAreaSqFt', label: 'Wall veneer area (sq ft)', placeholder: 'Approximate finish area on all specified sides' },
      { key: 'waterFeatureCounts', label: 'Water features and quantities', placeholder: 'Sheer descents, bubblers, in-floor heads, drains, etc.' },
      { key: 'scopeResponsibilities', label: 'Included scope and responsibility', placeholder: 'Builder vs. homeowner work; removal, access, permits, restoration…', multiline: true },
      { key: 'estimateAssumptions', label: 'Open questions, allowances, exclusions', placeholder: 'Unverified measurements, utility locates, permits, or pricing assumptions…', multiline: true },
    ],
  },
];

const fieldLabels: Record<SurveyKey, string> = Object.fromEntries(
  groups.flatMap((group) => group.fields.map(({ key, label }) => [key, label])),
) as Record<SurveyKey, string>;

export function siteAssessmentNarrative(value?: SiteAssessmentData | null) {
  if (!value) return [];
  return (Object.keys(emptySiteAssessmentData) as SurveyKey[])
    .map((key) => value[key]?.trim() ? `${fieldLabels[key]}: ${value[key].trim()}` : '')
    .filter((item): item is string => Boolean(item));
}

export default function SiteAssessmentForm({
  value,
  onChange,
  saving,
  onSave,
}: {
  value: SiteAssessmentData;
  onChange: (value: SiteAssessmentData) => void;
  saving: boolean;
  onSave: () => void;
}) {
  const update = (key: SurveyKey, next: string) => onChange({ ...value, [key]: next });

  return (
    <section className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4" aria-label="Pre-estimate field survey">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-950">Pre-estimate field survey</h3>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-gray-600">Capture the site quantities and conditions that shape the preliminary estimate. Use approximate values when needed and write “verify” instead of guessing.</p>
        </div>
        <button type="button" disabled={saving} onClick={onSave} className="shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? 'Saving…' : 'Save survey and notes'}</button>
      </div>
      <div className="space-y-2">
        {groups.map((group) => (
          <details key={group.title} className="rounded-lg border border-gray-200 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">{group.title}</summary>
            <div className="border-t border-gray-100 px-4 pb-4 pt-3">
              <p className="mb-3 text-xs leading-5 text-gray-500">{group.description}</p>
              <div className="grid items-start gap-x-4 gap-y-3 sm:grid-cols-2">
                {group.fields.map(({ key, label, placeholder, multiline }) => (
                  <label key={key} className={`block text-sm font-medium text-gray-800 ${multiline ? 'sm:col-span-2' : ''}`}>
                    {label}
                    {multiline ? (
                      <textarea rows={2} value={value[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal" />
                    ) : (
                      <input value={value[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal" />
                    )}
                  </label>
                ))}
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
