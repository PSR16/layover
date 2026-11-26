# Layover

Layover is a mobile-first web app that helps existing volunteer groups coordinate dawn bird-collision patrols.

- Ranks tonight's patrol routes as low, elevated or high risk, with plain reasons.
- Opens claimable patrol slots that volunteers can take in one tap.
- Shows coordinators which routes and time windows have no coverage.

The app has two views: Volunteer (`#volunteer`) and Organization (`#org`).

## Safety

- Layover is a coordination tool for existing groups. It does not train people or replace a group's own protocols.
- Untrained people never handle birds. Only trained group members do, under their group's procedures.
- Risk is shown as low, elevated or high. It is not a prediction of bird deaths.

## Sample data

The data in the demo is sample data and is labelled as such in the app.

## Development

Requires Node 22.12 or newer.

```
npm ci          # install and set up git hooks
npm run dev     # start the dev server
npm run check   # lint, format, secret scan, tests, build
```

Commits use Conventional Commits and are checked by git hooks.

## License

[MIT](LICENSE)
