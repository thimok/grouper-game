# Grouper

A browser ride-loading simulator with seven attractions, built with React and Vite.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run build` generates a static site in `dist`; `npm test` checks loading and dispatch rules.

## GitHub Pages

Push this project, including `package-lock.json` and `.github/workflows/deploy.yml`, to a public GitHub repository. In **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source. The workflow tests, builds, and deploys on every push to `main`; you can also run it manually from the Actions tab. If your default branch has another name, update `branches` in the workflow.

The workflow reads your Pages base path automatically, so repository names and custom domains need no hardcoded changes. Local development continues to use `/`. You can check a project-path build locally by setting `VITE_BASE_PATH` to `/grouper-game/` before running `npm run build`.

Choose one of the first three groups and click its seats in a single vehicle. The group loads automatically when you select the last seat. Before completing a group, click a selected seat again to deselect it or cancel the selection. After loading, Undo returns the group to its queue. Single riders fill remaining seats. Main queues replenish; Taron and Hagrid fastpass arrivals are intermittent. All seven attractions retain separate shifts in local storage; adding the new attractions preserves existing saved shifts. Only the currently selected attraction runs, with 1×, 2× and 5× speed options in timed mode.

Manual mode pauses the ride countdown and has a configurable minimum break from 0 to 300 seconds, defaulting to 10 seconds. This setting is saved in the browser and applies to the next manual departure. After departure, dispatch is disabled until the break ends and the departing vehicle is unavailable for loading. Hollander's other station remains loadable, but neither station can dispatch during the break. Cooldowns use real elapsed time, unaffected by simulation speed, and continue across attraction changes and browser reloads. Set 0 to disable the break. Timed mode follows the ride's usual dispatch intervals.

New groups are mostly pairs (45%) and fours (30%), with trios (18%), solo guests (4%), fives (2%), and sixes (1%). This applies to main, tour, side, and fastpass queues. Single-rider groups always contain one guest. Existing saved groups keep their sizes; reset a shift to immediately regenerate its queues.

Dispatch intervals: Danse Macabre 5 minutes; Hollander 2 minutes per station, offset by 1 minute; Symbolica 45 seconds; Joris en de Draak 2 minutes; Taron 1 minute. Manually dispatching a Hollander station schedules the other station next in 1 minute, keeping timed departures alternating.

Accessibility arrivals are generated for station A, reserving 1–3 seats in row 3 and counting those guests automatically. Symbolica is displayed front to back: Muziektour, Heldentour, Schattentour. Every row has exactly 3 seats.

Efficiency is total guests dispatched divided by total dispatched capacity. Operation score subtracts average fastpass wait penalties: guests waiting more than 3 departures cost 2 points each per departure, capped at 25 points. Fastpass arrival volume averages roughly half of train capacity per departure, with random gaps and bursts. Queue counts are simulated and intentionally unlimited for main and single-rider queues.

## Hagrid's Motorbike Adventure

Seven cars with two seats each, with normal, fastpass, and single-rider queues. In manual mode, **Start next train** admits a train. Once admitted, the moving platform runs continuously in both modes. Seats can be reserved in approaching cars; completed groups board automatically when their cars enter the loading window. A group can span cars, but must stay in the same train. Seats in cars that have passed loading cannot be assigned or undone.

The default game timings are 6 seconds between cars, a 12-second loading window per car, and an 8-second gap after departure. These are simulation settings, not verified real operating intervals. They can be adjusted before admitting a train. The manual minimum break extends the gap when it is longer. Timed mode admits trains automatically, but the player must still give final dispatch clearance in both modes after car 7 arrives and assigned guests are boarded. Empty seats reduce efficiency and do not cause an e-stop.

An unfinished group selection reaching its earliest car's loading deadline, or a train reaching the exit without clearance, triggers an e-stop. **Recover platform** takes 15 simulation seconds and returns its assigned groups to their queues. Each e-stop subtracts 10 operation-score points. Cancelling an unfinished selection clears its seat reservations.

## Rise of the Resistance

Four stations, A–D. Each has two eight-person vehicles, each with two rows of four. The four row colors within every station are Red, Blue, Silver, and Orange. Groups must stay within one vehicle. Normal and single-rider queues are supported; the preshow is omitted.

**Mark ready** adds a station to the departure queue and locks its loading assignments. Readiness order determines departure order, so A → C → B → D is supported. **Cancel ready** removes that station and reopens loading. In manual mode, **Dispatch next** sends the first queued station when the configured minimum break permits. Timed mode sends the first queued station at each 25-second departure slot; an empty queue misses that slot. Switching to manual pauses the slot countdown.

After departure, that station is unavailable for 15 simulation seconds while replacement vehicles arrive, in either mode. Other stations remain loadable. This replacement delay is separate from the manual departure cooldown. All ride timings and e-stop behavior are game rules rather than exact reproductions of operational safety systems.
