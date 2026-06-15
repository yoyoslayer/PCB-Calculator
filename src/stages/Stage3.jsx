import { useMemo, useState } from 'react';
import { useDesign } from '../store.jsx';
import { Panel, Field, Select, TextField, Button, Pill, Callout } from '../ui.jsx';
import StageShell from './StageShell.jsx';

const PIN_ROLES = [
  { value: 'gnd', label: 'GND' },
  { value: 'vcc', label: 'Power in (VCC/VDD)' },
  { value: 'vout', label: 'Power out (regulator)' },
  { value: 'sda', label: 'I2C SDA' },
  { value: 'scl', label: 'I2C SCL' },
  { value: 'dplus', label: 'USB D+' },
  { value: 'dminus', label: 'USB D-' },
  { value: 'io', label: 'GPIO / signal' },
  { value: 'analog', label: 'Analog' },
  { value: 'other', label: 'Other' },
];

// Quick pin sets so the user does not type boilerplate.
function quickPins(block) {
  const pins = [{ name: 'GND', role: 'gnd' }];
  if (block.role === 'regulator') { pins.push({ name: 'VIN', role: 'vcc' }, { name: 'VOUT', role: 'vout' }, { name: 'EN', role: 'io' }); }
  else { pins.push({ name: 'VCC', role: 'vcc' }); }
  const ifs = block.io?.interfaces || [];
  if (ifs.includes('i2c')) pins.push({ name: 'SDA', role: 'sda' }, { name: 'SCL', role: 'scl' });
  if (ifs.includes('usb')) pins.push({ name: 'D+', role: 'dplus' }, { name: 'D-', role: 'dminus' });
  return pins.map((p, i) => ({ ...p, id: `${block.id}-q${i}` }));
}

function buildNetlist(parts) {
  const nets = {};
  const push = (net, ref, pin) => { (nets[net] ||= []).push({ ref, pin }); };
  const unassigned = [];

  for (const part of parts) {
    for (const pin of part.pins || []) {
      switch (pin.role) {
        case 'gnd': push('GND', part.id, pin.name); break;
        case 'vcc': push(`${fmtV(part.vtyp)}_RAIL`, part.id, pin.name); break;
        case 'vout': push(`${fmtV(part.vtyp)}_RAIL`, part.id, pin.name); break;
        case 'sda': push('I2C_SDA', part.id, pin.name); break;
        case 'scl': push('I2C_SCL', part.id, pin.name); break;
        case 'dplus': push('USB_DP', part.id, pin.name); break;
        case 'dminus': push('USB_DM', part.id, pin.name); break;
        default: unassigned.push({ ref: part.id, pin: pin.name, role: pin.role });
      }
    }
  }
  const list = Object.entries(nets).map(([net, members]) => ({ net, members }));
  return { list, unassigned };
}
const fmtV = (v) => (v ? `${String(v).replace('.', 'V')}` : 'V');

export default function Stage3() {
  const { state, setData } = useDesign();
  const bom = state.data.stage2?.blocks;
  const saved = state.data.stage3;

  const [parts, setParts] = useState(() => {
    const base = (bom || []).map((b) => ({ id: b.id, name: b.name, role: b.role, vtyp: b.voltage.typ, pins: [] }));
    if (saved?.parts) {
      // merge saved pins onto current bom
      return base.map((p) => ({ ...p, pins: saved.parts.find((s) => s.id === p.id)?.pins || [] }));
    }
    return base;
  });

  const netlist = useMemo(() => buildNetlist(parts), [parts]);

  function addPin(partId) {
    setParts((ps) => ps.map((p) => p.id === partId
      ? { ...p, pins: [...p.pins, { id: `${partId}-${Date.now()}`, name: '', role: 'io' }] } : p));
  }
  function loadQuick(partId) {
    setParts((ps) => ps.map((p) => (p.id === partId ? { ...p, pins: quickPins(p) } : p)));
  }
  function updatePin(partId, pinId, patch) {
    setParts((ps) => ps.map((p) => p.id === partId
      ? { ...p, pins: p.pins.map((pn) => (pn.id === pinId ? { ...pn, ...patch } : pn)) } : p));
  }
  function removePin(partId, pinId) {
    setParts((ps) => ps.map((p) => p.id === partId ? { ...p, pins: p.pins.filter((pn) => pn.id !== pinId) } : p));
  }

  function save() { setData('stage3', { parts, netlist }); }

  if (!bom) {
    return (
      <StageShell stageKey="stage3" title="Map the pins" lead="Add your parts in Stage 2 first.">
        <Callout tone="warn" title="No BOM yet">Save a bill of materials in Layer 2 before mapping pins.</Callout>
      </StageShell>
    );
  }

  const totalPins = parts.reduce((s, p) => s + p.pins.length, 0);

  return (
    <StageShell
      stageKey="stage3"
      title="List the pins, get the connections"
      lead="Add the pins you will use on each part and tag each one's role. Use Quick pins to drop in the obvious ones. From the roles, the netlist below tells you exactly which pins to wire together in your schematic editor."
    >
      {parts.map((part) => (
        <Panel
          key={part.id}
          title={part.name}
          kicker={`${part.id} · ${part.role}`}
          action={<Button variant="ghost" onClick={() => loadQuick(part.id)}>Quick pins</Button>}
        >
          {part.pins.length === 0 && <div className="empty">No pins yet. Use Quick pins, or add the ones you need.</div>}
          <div className="itemlist">
            {part.pins.map((pin) => (
              <div key={pin.id} className="item">
                <div style={{ flex: 1 }}>
                  <TextField value={pin.name} onChange={(v) => updatePin(part.id, pin.id, { name: v })} placeholder="Pin name e.g. IO5" />
                </div>
                <div style={{ width: 200 }}>
                  <Select value={pin.role} onChange={(v) => updatePin(part.id, pin.id, { role: v })} options={PIN_ROLES} />
                </div>
                <Button variant="danger" onClick={() => removePin(part.id, pin.id)}>×</Button>
              </div>
            ))}
          </div>
          <div className="btnrow"><Button variant="ghost" onClick={() => addPin(part.id)}>+ Add pin</Button></div>
        </Panel>
      ))}

      <Panel title="Netlist" kicker={`${netlist.list.length} nets · ${totalPins} pins mapped`}>
        {netlist.list.length === 0 && <div className="empty">Tag some pins to generate nets.</div>}
        {netlist.list.length > 0 && (
          <table className="tbl">
            <thead><tr><th>Net</th><th>Connect these pins</th></tr></thead>
            <tbody>
              {netlist.list.map((n) => (
                <tr key={n.net}>
                  <td className="mono"><Pill tone={n.net === 'GND' ? 'default' : n.net.endsWith('RAIL') ? 'copper' : 'mask'}>{n.net}</Pill></td>
                  <td className="mono">{n.members.map((m) => `${m.ref}.${m.pin}`).join('  +  ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {netlist.unassigned.length > 0 && (
          <Callout tone="info" title="Wire these by hand">
            These pins are point-to-point and depend on your design intent, so the app does not auto-net them:{' '}
            <span className="mono">{netlist.unassigned.map((u) => `${u.ref}.${u.pin}`).join(', ')}</span>
          </Callout>
        )}
      </Panel>

      <div className="btnrow">
        <Button variant="primary" onClick={save}>Save netlist</Button>
        {saved && <span className="cite">Saved. Stage 4 groups these into a tidy schematic.</span>}
      </div>
    </StageShell>
  );
}
