# usage-bar

A Claude Code mod that keeps your plan's usage in view. A row above the prompt shows the current model,
your 5-hour and weekly rate-limit windows as colored bars with the percentage used and time until reset,
and the context-window fill. Press Opus, Sonnet, Haiku or Fable to switch models (or focus the row with
ctrl+x tab and press 1-4), or type `/m opus` from the prompt. The status line carries a compact summary too.

Rate-limit bars appear on Claude subscription plans after the first reply of a session. Switching models
runs the built-in `/model`, which also saves the choice as your default for new sessions.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install usage-bar --marketplace iamromelalvin7/claude-usage-bar
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

From a shell:

```
claude plugin install usage-bar --marketplace iamromelalvin7/claude-usage-bar
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with
`iamromelalvin7/claude-usage-bar`, then Add plugin.

## Customize

Edit the `MODELS` list at the top of `hooks/register.tsx` to change which models the buttons offer.

## License

MIT
