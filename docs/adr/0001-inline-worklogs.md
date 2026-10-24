# ADR 0001: Inline, local worklogs

Status: Accepted

## Context

The desired interaction is a small timesheet in an ordinary Markdown report: select time, adjust entries, and reuse totals in surrounding prose. Separate daily notes and sidecar interval files make this workflow harder to maintain.

## Decision

Store the worklog as JSON in a `worklogger` fenced block in the owning Markdown note. Render it as an editable calendar in Reading view and persist edits back to that block. Keep period dates explicit and inclusive. Count the union of overlapping intervals per day.

Resolve `{.Time}`, `{.Rate}`, and `{.Cost}` only against their owning document. Keep tokens literal in the source. Recommend one worklog per note for unambiguous reporting.

Store currency and hourly rate with each worklog. Currency changes never perform foreign-exchange conversion. Keep interface language and the default currency in local plugin settings. Provide English and Russian, including an automatic language mode.

## Consequences

Notes remain portable and readable without the plugin, and their data travels with ordinary vault sync. Interactive rendering requires the plugin. Concurrent external edits require careful write handling; the plugin is not a collaboration or backup service. Plugin preferences are separate from note data. The initial release is desktop-only because mobile interaction has not been verified.
