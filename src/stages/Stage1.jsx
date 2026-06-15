import { useState } from 'react';
import { useDesign } from '../store.jsx';
import { POWER_SOURCES, COMPONENT_TEMPLATES } from '../config/data.js';
import { Panel, Field, NumberField, Button, Callout, Pill } from '../ui.jsx';
import StageShell from './StageShell.jsx';

const POWER_OPTIONS = [
  { id: 'lipo_1s', label: 'Rechargeable lithium battery', help: 'Best when the device must run unplugged and be recharged. Supplies about 3.0 to 4.2 volts. Light and energy dense. Most 3.3 volt parts need a small regulator.' },
  { id: 'coin_cell', label: 'Coin cell', help: 'Best for very low power devices that must last a long time. Supplies about 3 volts, enough to run many 3.3 volt chips directly. It cannot deliver large bursts of current.' },
  { id: 'usb_5v', label: 'USB, 5 volts', help: 'Best when the device stays plugged into a computer or a USB charger. Supplies a steady 5 volts. Step it down to 3.3 volts with a small regulator.' },
  { id: 'dc_barrel', label: 'Wall adapter, 12 volts', help: 'Best when the device sits near an outlet, or when something on the board needs the higher voltage such as a motor or a light strip. Step it down with a switching regulator, not a linear one, so you do not waste most of it as heat.' },
];

const SENSOR_KINDS = ['Temperature or humidity', 'Motion or orientation', 'Light', 'Distance', 'Other'];
const SIZE_OPTIONS = [
  { id: 'tiny', label: 'Very small, under 30 mm' },
  { id: 'small', label: 'Small, 30 to 60 mm' },
  { id: 'medium', label: 'Medium, 60 to 100 mm' },
  { id: 'none', label: 'No fixed size yet' },
];

// Turns the answers into the constraint seed and the starting parts list.
function buildStage1(a) {
  const seed = ['mcu_3v3'];
  if (a.power === 'lipo_1s' || a.power === 'usb_5v') seed.push('ldo_3v3');
  if (a.power === 'dc_barrel') seed.push('buck_5v', 'ldo_3v3');
  // A 3 volt coin cell can run a 3.3 volt chip directly, so no regulator is seeded.
  if (a.motors) seed.push('motor');
  if (a.sensors) seed.push('i2c_sensor');
  if (a.sound) seed.push('i2s_amp', 'speaker');

  const layerTarget = a.usbData ? 4 : 2;
  const copperOz = 1;
  return {
    idea: a.idea,
    projectType: 'custom',
    projectLabel: a.idea ? a.idea.slice(0, 60) : 'Custom board',
    powerSource: a.power,
    environment: a.portable ? 'portable' : 'benchtop',
    layerTarget,
    usesUsbData: a.usbData,
    sensorKinds: a.sensors ? a.sensorKinds : [],
    hasDisplay: a.display,
    sizeClass: a.sizeClass,
    sizeMm: { w: a.sizeW || null, h: a.sizeH || null },
    seedBlocks: seed,
    constraintSeed: { copperOz, layerTarget, usesUsbData: a.usbData, impedanceControlLikely: a.usbData },
    answers: a,
  };
}

function YesNo({ value, onChange }) {
  return (
    <div className="rail__row">
      <Button variant={value === true ? 'primary' : 'ghost'} onClick={() => onChange(true)}>Yes</Button>
      <Button variant={value === false ? 'primary' : 'ghost'} onClick={() => onChange(false)}>No</Button>
    </div>
  );
}

export default function Stage1() {
  const { state, setData } = useDesign();
  const saved = state.data.stage1?.answers;

  const [idea, setIdea] = useState(saved?.idea || '');
  const [power, setPower] = useState(saved?.power || '');
  const [portable, setPortable] = useState(saved?.portable ?? false);
  const [motors, setMotors] = useState(saved?.motors ?? false);
  const [sensors, setSensors] = useState(saved?.sensors ?? false);
  const [sensorKinds, setSensorKinds] = useState(saved?.sensorKinds || []);
  const [sound, setSound] = useState(saved?.sound ?? false);
  const [usbData, setUsbData] = useState(saved?.usbData ?? false);
  const [display, setDisplay] = useState(saved?.display ?? false);
  const [sizeClass, setSizeClass] = useState(saved?.sizeClass || '');
  const [sizeW, setSizeW] = useState(saved?.sizeW || '');
  const [sizeH, setSizeH] = useState(saved?.sizeH || '');

  const answers = { idea, power, portable, motors, sensors, sensorKinds, sound, usbData, display, sizeClass, sizeW, sizeH };
  const result = buildStage1(answers);
  const ready = !!power;

  const toggleKind = (k) => setSensorKinds((ks) => ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]);
  const save = () => setData('stage1', buildStage1(answers));

  return (
    <StageShell
      stageKey="stage1"
      title="Tell me about your board"
      lead="Answer what you can. Each answer picks the starting parts and the board rules for you, and you can change any of it later. If you are unsure on a question, leave it as No."
    >
      <Panel title="1. Your idea" kicker="In a sentence">
        <textarea
          className="input"
          rows={3}
          placeholder="For example: a small battery powered button that plays a sound when pressed."
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />
      </Panel>

      <Panel title="2. What powers it" kicker="Pick one. Each card explains when it fits.">
        <div className="choice-grid">
          {POWER_OPTIONS.map((o) => (
            <button key={o.id} className={`choice ${power === o.id ? 'is-sel' : ''}`} onClick={() => setPower(o.id)}>
              <div className="choice__label">{o.label}</div>
              <div className="choice__blurb">{o.help}</div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="3. Does it need to run unplugged" kicker="Portable or stationary">
        <YesNo value={portable} onChange={setPortable} />
        <div className="item__meta" style={{ marginTop: 8 }}>Yes leans toward a battery and a compact, low-power design.</div>
      </Panel>

      <Panel title="4. What it does" kicker="Toggle anything that applies">
        <div className="grid grid--2">
          <Field label="Drives a motor, relay, or solenoid"><YesNo value={motors} onChange={setMotors} /></Field>
          <Field label="Plays sound through a speaker"><YesNo value={sound} onChange={setSound} /></Field>
          <Field label="Connects to a computer over USB for data, not just power"><YesNo value={usbData} onChange={setUsbData} /></Field>
          <Field label="Has a display"><YesNo value={display} onChange={setDisplay} /></Field>
        </div>

        <div style={{ marginTop: 14 }}>
          <Field label="Reads any sensors"><YesNo value={sensors} onChange={setSensors} /></Field>
          {sensors && (
            <div style={{ marginTop: 10 }}>
              <div className="item__meta" style={{ marginBottom: 8 }}>What kind? Pick any.</div>
              <div className="btnrow">
                {SENSOR_KINDS.map((k) => (
                  <button key={k} className={`choice ${sensorKinds.includes(k) ? 'is-sel' : ''}`} style={{ padding: '8px 12px' }} onClick={() => toggleKind(k)}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="5. Roughly how small" kicker="Optional">
        <div className="choice-grid">
          {SIZE_OPTIONS.map((o) => (
            <button key={o.id} className={`choice ${sizeClass === o.id ? 'is-sel' : ''}`} onClick={() => setSizeClass(o.id)}>
              <div className="choice__label">{o.label}</div>
            </button>
          ))}
        </div>
        <div className="grid grid--2" style={{ marginTop: 12 }}>
          <Field label="Exact width, if you know it"><NumberField value={sizeW} onChange={setSizeW} suffix="mm" min={0} /></Field>
          <Field label="Exact height, if you know it"><NumberField value={sizeH} onChange={setSizeH} suffix="mm" min={0} /></Field>
        </div>
      </Panel>

      <Panel title="Starting point" kicker="What your answers set up">
        {!ready && <Callout tone="warn">Choose a power source above to continue.</Callout>}
        {ready && (
          <>
            <div className="stats" style={{ marginBottom: 14 }}>
              <div className="stat"><div className="stat__value" style={{ fontSize: 15 }}>{POWER_SOURCES[power]?.name}</div><div className="stat__label">Power source</div></div>
              <div className="stat"><div className="stat__value" style={{ fontSize: 15 }}>{result.layerTarget} layers</div><div className="stat__label">{result.usesUsbData ? 'For the USB pair' : 'Standard'}</div></div>
              <div className="stat"><div className="stat__value" style={{ fontSize: 15 }}>{result.environment}</div><div className="stat__label">Environment</div></div>
            </div>
            <div className="item__meta" style={{ marginBottom: 6 }}>Starting parts, which you can edit next:</div>
            <div className="btnrow" style={{ marginBottom: 14 }}>
              {result.seedBlocks.map((k, i) => <Pill key={i} tone="mask">{COMPONENT_TEMPLATES[k]?.name || k}</Pill>)}
            </div>
            {result.usesUsbData && <Callout tone="info">USB data needs a matched pair held near 90 ohms, which is far easier on 4 layers, so the layer target was set to 4.</Callout>}
          </>
        )}
        <div className="btnrow" style={{ marginTop: 8 }}>
          <Button variant="primary" onClick={save} disabled={!ready}>Save and continue</Button>
          {state.data.stage1 && ready && <span className="cite">Saved. The components stage is seeded from this.</span>}
        </div>
      </Panel>
    </StageShell>
  );
}
