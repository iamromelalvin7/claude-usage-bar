import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Limit, Snapshot } from '../types'

const snapshot = atom({ plugin: 'usage-bar', key: 'snapshot' } as const, null)

// Hotkeys 1-4 press these while the band has focus (ctrl+x tab). /m <name> works from the prompt.
const MODELS = [
  { key: '1', label: 'Opus', id: 'claude-opus-5-5' },
  { key: '2', label: 'Sonnet', id: 'claude-sonnet-5-5' },
  { key: '3', label: 'Haiku', id: 'claude-haiku-5-5' },
  { key: '4', label: 'Fable', id: 'claude-fable-5-2' },
] as const

const BAR = 10

function prettyModel(id: string): string {
  const m = /claude-([a-z]+)-(\d+)-(\d+)/.exec(id)
  const [, family = '', major = '', minor = ''] = m ?? []
  if (!m || !family) return id
  return `${family.charAt(0).toUpperCase()}${family.slice(1)} ${major}.${minor}`
}

function windowName(kind: string): string {
  if (kind === 'five_hour') return '5h'
  if (kind === 'seven_day') return 'week'
  return kind.replace(/_/g, ' ')
}

function untilReset(iso: string | undefined, now: number): string {
  if (!iso) return ''
  const ms = Date.parse(iso) - now
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const mins = Math.round(ms / 60000)
  if (mins < 60) return ` ↻${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return ` ↻${hours}h${String(mins % 60).padStart(2, '0')}m`
  return ` ↻${Math.round(hours / 24)}d`
}

function levelColor(pct: number) {
  return pct >= 90 ? 'error' : pct >= 70 ? 'warning' : 'success'
}

function statusText(s: Snapshot): string {
  const limits = s.limits.map(l => `${windowName(l.kind)} ${Math.round(l.percentUsed)}%`).join(' · ')
  const ctx = s.contextPercent !== undefined ? ` · ctx ${s.contextPercent}%` : ''
  return (limits ? `${prettyModel(s.model)} · ${limits}` : prettyModel(s.model)) + ctx
}

async function refresh($: EngineInterface) {
  const [model, usage] = await Promise.all([$.session.model(), $.session.usage()])
  const limits: Limit[] = usage.rateLimits.map(r => ({
    kind: r.kind,
    percentUsed: r.percentUsed,
    resetsAt: r.resetsAt,
  }))
  const { tokens, window, percent } = usage.context
  const contextPercent =
    percent ?? (tokens !== undefined && window > 0 ? Math.round((tokens / window) * 100) : undefined)
  const next: Snapshot = { model, limits, contextPercent }
  await update($, snapshot, () => next)
  $.ui.status(statusText(next))
}

async function switchTo($: EngineInterface, id: string) {
  await $.command.run({ command: 'model', args: id })
  await refresh($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'm',
      description: 'Switch model: /m opus | sonnet | haiku | fable',
      argumentHint: 'opus|sonnet|haiku|fable',
    })
    await refresh($)
    return result
  })

  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  // Refresh the band whenever the built-in /model runs, however it was triggered.
  on('command.run', { command: 'model' }, async ($, e, next) => {
    const result = await next(e)
    try {
      await refresh($)
    } catch {
      // the band just stays stale until the next measure
    }
    return result
  }).catch(($, e, next) => (next.called ? {} : next(e)))

  on('command.run', { command: 'm' }, async ($, e) => {
    const want = e.args.trim().toLowerCase()
    const pick = MODELS.find(m => m.label.toLowerCase() === want || m.key === want || m.id === want)
    if (!pick) {
      return {
        text: `Usage: /m ${MODELS.map(m => m.label.toLowerCase()).join(' | ')}`,
        isTextDisplayOnly: true,
      }
    }
    const result = await $.command.run({ command: 'model', args: pick.id })
    await refresh($)
    return { text: result.text ?? `Switched to ${pick.label}`, isTextDisplayOnly: true }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const s = await read($, snapshot)
    if (s === null) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const now = await $.clock.now()

    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        <Text bold color="claude">{prettyModel(s.model)}</Text>
        {s.limits.length === 0 ? (
          <Text dimColor>limits appear after the first reply</Text>
        ) : (
          s.limits.map(l => {
            const filled = Math.max(0, Math.min(BAR, Math.round((l.percentUsed / 100) * BAR)))
            return (
              <Box key={l.kind} flexDirection="row" columnGap={1}>
                <Text dimColor>{windowName(l.kind)}</Text>
                <Box flexDirection="row">
                  {filled > 0 ? <Box width={filled} height={1} backgroundColor={levelColor(l.percentUsed)} /> : null}
                  {filled < BAR ? <Box width={BAR - filled} height={1} backgroundColor="subtle" /> : null}
                </Box>
                <Text color={levelColor(l.percentUsed)}>{Math.round(l.percentUsed)}%</Text>
                <Text dimColor>{untilReset(l.resetsAt, now)}</Text>
              </Box>
            )
          })
        )}
        <Text dimColor>ctx {s.contextPercent !== undefined ? `${s.contextPercent}%` : '–'}</Text>
        <Box flexDirection="row" columnGap={1}>
          {MODELS.map(m => (
            <Button
              key={`model-${m.key}`}
              label={m.label}
              hotkey={m.key}
              plain
              onPress={() => switchTo($, m.id)}
            />
          ))}
        </Box>
      </Box>
    )
  })
}
