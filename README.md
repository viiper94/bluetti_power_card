# Bluetti Power Card

A custom Lovelace card for [Home Assistant](https://www.home-assistant.io/) that shows the power flow of a portable power station and lets you control it. It was designed for Bluetti, but it is not tied to Bluetti: it works with any power station or battery system whose integration provides the entities listed below.
 
The card does **not** talk to the device itself. It only maps entities provided by another integration (for example the Bluetti2MQTT add-on) and displays and controls them.

## Features

- Power flow view with four nodes: **DC charging** (PV), **AC charging** (grid), **DC discharging** and **AC discharging**. Connection lines animate while power flows.
- **State of charge** ring in the centre, with a battery icon and colour that follow the level.
- **Time left**: time to empty while discharging, time to full while charging. Uses your sensors, or estimates it from battery capacity and current power.
- **Controls**: AC output switch, DC output switch, and charging mode buttons (silent / standard / turbo, built from the options of your select entity).
- Optional red **power button** for a master power switch.
- Visual editor for matching entities, no YAML required.

## Compatibility
 
Because the card only reads and controls Home Assistant entities, it works with any device that provides them, regardless of brand or how the data gets into Home Assistant (MQTT, Bluetooth, cloud, Modbus, ...). You need:
 
- power sensors for the inputs and outputs you want to show (DC in, AC in, DC out, AC out),
- a battery percentage sensor,
- optionally, switches for AC/DC output, a select entity for the charging mode, and time-remaining sensors.
Everything is optional and unmapped parts are hidden or dimmed, so a device without, for example, a charging mode select still works. The node labels (PV, Grid, DC, AC) are fixed, so map the closest matching entities.
 
The card has been used with a Bluetti power station. Compatibility with other brands depends on the entities their integrations provide, so if you try it with another device, feel free to open an issue or pull request with your results.

## Installation

### HACS (custom repository)

[![Add to HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=viiper94&repository=bluetti_power_card&category=plugin)

Or add it manually: 
1. In HACS, open the menu, choose **Custom repositories** and add this repository as type **Dashboard**.
2. Install **Bluetti Power Card** and reload the browser.

### Manual

1. Copy `bluetti-power-card.js` to `/config/www/`.
2. Go to **Settings → Dashboards → ⋮ → Resources** and add `/local/bluetti-power-card.js` as a **JavaScript module**.
3. Hard-refresh the browser.

## Configuration

Add the card from the card picker ("Bluetti Power Card") and match your entities in the visual editor, or use YAML:

```yaml
type: custom:bluetti-power-card
dc_charging: sensor.bluetti_dc_input_power
ac_charging: sensor.bluetti_ac_input_power
dc_discharging: sensor.bluetti_dc_output_power
ac_discharging: sensor.bluetti_ac_output_power
soc: sensor.bluetti_battery_percent
time_remaining: sensor.bluetti_time_remaining
ac_switch: switch.bluetti_ac_output
dc_switch: switch.bluetti_dc_output
charging_mode: select.bluetti_charging_mode
availability_entity: binary_sensor.bluetti_online
```

### Options

| Option | Required | Description |
| --- | --- | --- |
| `dc_charging` | no | DC input power sensor (PV node) |
| `ac_charging` | no | AC input power sensor (grid node) |
| `dc_discharging` | no | DC output power sensor |
| `ac_discharging` | no | AC output power sensor |
| `soc` | no | Battery state of charge sensor (%) |
| `time_remaining` | no | Single sensor with the remaining time, used for both directions |
| `time_to_full` | no | Time to full sensor, takes priority while charging |
| `time_to_empty` | no | Time to empty sensor, takes priority while discharging |
| `capacity_wh` | no | Battery capacity in Wh, used to estimate the time if no time sensor works |
| `ac_switch` | no | AC output switch (`switch` or `input_boolean`) |
| `dc_switch` | no | DC output switch (`switch` or `input_boolean`) |
| `charging_mode` | no | `select` or `input_select` entity for the charging mode |
| `power_switch` | no | Switch for the optional power button |
| `availability_entity` | no | Binary sensor that is `off` when the device is offline |
| `stale_after` | no | Mark SOC and power readings unavailable if not updated for this many seconds |

Power sensors can report in W or kW. Time sensors can report in seconds, minutes, hours or days, or be timestamp sensors. Anything you leave out is hidden or dimmed.

## Notes

- The charging direction is derived from input minus output power: charging if input is higher, discharging if output is higher, idle otherwise.
- This project is not affiliated with Bluetti or any other power station manufacturer.

## License

MIT
