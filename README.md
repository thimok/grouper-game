# Grouper

A browser ride-loading simulator built with React and Vite.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run build` generates a static site in `dist`; `npm test` checks loading and dispatch rules.

## GitHub Pages

Push this project, including `package-lock.json` and `.github/workflows/deploy.yml`, to a public GitHub repository. In **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source. The workflow tests, builds, and deploys on every push to `main`; you can also run it manually from the Actions tab. If your default branch has another name, update `branches` in the workflow.

The workflow reads your Pages base path automatically, so repository names and custom domains need no hardcoded changes. Local development continues to use `/`. You can check a project-path build locally by setting `VITE_BASE_PATH` to `/grouper-game/` before running `npm run build`.

Choose one of the first three groups and click its seats in a single vehicle. The group loads automatically when you select the last seat. Before completing a group, click a selected seat again to deselect it or cancel the selection. After loading, Undo returns the group to its queue. Single riders fill remaining seats. Main queues replenish; Taron fastpass arrivals are intermittent. All five attractions retain separate shifts in local storage. Timed mode runs the currently selected attraction only, with 1×, 2× and 5× speed options.

Manual mode pauses the ride countdown and has a configurable minimum break from 0 to 300 seconds, defaulting to 10 seconds. This setting is saved in the browser and applies to the next manual departure. After departure, dispatch is disabled until the break ends and the departing vehicle is unavailable for loading. Hollander's other station remains loadable, but neither station can dispatch during the break. Cooldowns use real elapsed time, unaffected by simulation speed, and continue across attraction changes and browser reloads. Set 0 to disable the break. Timed mode follows the ride's usual dispatch intervals.

New groups are mostly pairs (45%) and fours (30%), with trios (18%), solo guests (4%), fives (2%), and sixes (1%). This applies to main, tour, side, and fastpass queues. Single-rider groups always contain one guest. Existing saved groups keep their sizes; reset a shift to immediately regenerate its queues.

Dispatch intervals: Danse Macabre 5 minutes; Hollander 2 minutes per station, offset by 1 minute; Symbolica 45 seconds; Joris en de Draak 2 minutes; Taron 1 minute. Manually dispatching a Hollander station schedules the other station next in 1 minute, keeping timed departures alternating.

Accessibility arrivals are generated for station A, reserving 1–3 seats in row 3 and counting those guests automatically. Symbolica is displayed front to back: Muziektour, Heldentour, Schattentour. Every row has exactly 3 seats.

Efficiency is total guests dispatched divided by total dispatched capacity. Operation score subtracts average fastpass wait penalties: guests waiting more than 3 departures cost 2 points each per departure, capped at 25 points. Fastpass arrival volume averages roughly half of train capacity per departure, with random gaps and bursts. Queue counts are simulated and intentionally unlimited for main and single-rider queues.
