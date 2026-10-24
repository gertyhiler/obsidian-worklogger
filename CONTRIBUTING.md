# Contributing

Issues and pull requests are welcome in English or Russian. Describe the expected behavior, actual behavior, Obsidian version, operating system, and minimal reproduction using synthetic worklog data. Do not attach your vault or personal work records.

For changes, keep the interface small and preserve existing note data. Discuss substantial format or interaction changes in an issue first. Add regression tests for time calculations, parsing, and write safety when changing those behaviors.

Use Node.js 22 or newer. Run `npm ci`, then `npm run check`. Use `npm run format` to format JavaScript and CSS. Test interaction changes in a desktop test vault and explain what you checked in the pull request. Automated checks do not establish mobile support.

Translations should preserve token names and JSON keys; localize user-facing text only. Currency selection is formatting and denomination, never implicit conversion.

For a release, update `package.json`, its lockfile, `manifest.json`, `versions.json`, and `CHANGELOG.md` together. Publish a tag matching the manifest version exactly, without `v`. The release workflow builds and attaches `main.js`, `manifest.json`, and `styles.css`.
