import { useEffect, useRef, useState } from 'react'
import type { MeterConfig } from '../types'
import { METER_KEYS, type MeterValues, fmtMeter, meterColorClass } from '../gameLogic'

interface Props {
  meters: MeterValues
  meterConfigs: Record<string, MeterConfig>
}

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function MeterBar({ value, cfg }: { mKey: string; value: number; cfg: MeterConfig }) {
  const prevRef = useRef(value)
  const [displayed, setDisplayed] = useState(value)
  const [flash, setFlash] = useState(false)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const from = prevRef.current
    const to = value
    prevRef.current = to
    if (from === to) return

    setFlash(true)
    const timer = setTimeout(() => setFlash(false), 700)

    if (prefersReducedMotion()) {
      setDisplayed(to)
      return () => clearTimeout(timer)
    }

    cancelAnimationFrame(rafRef.current)
    const dur = 600
    const t0 = performance.now()
    function step(t: number) {
      const p = Math.min(1, (t - t0) / dur)
      const v = Math.round(from + (to - from) * (1 - (1 - p) ** 3))
      setDisplayed(v)
      if (p < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)

    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(rafRef.current)
    }
  }, [value])

  const pct = Math.max(0, Math.min(100, ((value - cfg.min) / (cfg.max - cfg.min)) * 100))
  const colorCls = meterColorClass(cfg, value)

  return (
    <div
      className={`meter${flash ? ' flash' : ''}`}
      aria-label={`${cfg.label}: ${fmtMeter(cfg, value)} of ${cfg.max}`}
    >
      <div className="meter-top">
        <span className="meter-nm mono">{cfg.short}</span>
        <span>
          <span className="meter-val">{fmtMeter(cfg, displayed)}</span>
          <span className="meter-max">/{cfg.max}</span>
        </span>
      </div>
      <div
        className="track"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={cfg.min}
        aria-valuemax={cfg.max}
        aria-label={cfg.hint}
      >
        <div className={`fill ${colorCls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function MeterHUD({ meters, meterConfigs }: Props) {
  return (
    <div className="hud" aria-label="Game meters">
      {METER_KEYS.map((k) => (
        <MeterBar key={k} mKey={k} value={meters[k]} cfg={meterConfigs[k]} />
      ))}
    </div>
  )
}
