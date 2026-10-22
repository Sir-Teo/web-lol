# Rift practice jungle calendars

Ordinary Rift practice now schedules the same twelve camps and shared river
controller as the interim lane match. Start practice, select Smite in either
summoner slot, and buy Gustwalker Hatchling, Scorchclaw Pup or Mosstomper Seedling
at the fountain. Scheduled monster kills can feed the purchased companion and
earn its existing Smite upgrades. Practice still supplies a sparring partner,
target dummy and practice tools; it does not supply a complete jungle-role team.

## Shared map initialization

`World` initializes the calendars whenever the battlefield is Rift, including
ordinary practice, lane matches and low-level empty-population Rift worlds. The
lane factory only supplies its roster and summoner loadout. Each world owns fresh
member slots, cleanup clocks, split-wave records, river IDs, shrines and selection
state. The controlled development fixture retains its isolated encounter setup.

The existing camp definitions, source locators, readiness lead-ins, pack members,
Krug offspring and death-based respawn rules are unchanged. Twelve ordinary camp
calendars supply 28 initial monsters; the shared controller adds both first
Scuttlers at 2:55 and selects one later river after the pair dies. The timing
baselines and local policies remain subject to the native-calibration limits in
[the camp notes](JUNGLE-CAMPS.md), [Krug notes](KRUG-CAMPS.md) and
[Scuttler notes](SCUTTLER.md). Moving initialization into the map does not establish
new native evidence for those policies.

Practice prepares all eleven monster rigs, including future Krug descendants,
and the existing Gromp effects before play. Their initial absence from the world
no longer means the scene can omit their assets. A purchased companion still
prepares only its selected rig. Unowned companion variants remain unloaded.

## Persistence

Schema 102 requires the full camp calendar and non-null river controller for
every Rift save, independent of practice versus lane mode. Other battlefields
reject those calendars. Existing member ownership, emergence protection,
respawn/split clocks, shrines, selection RNG and companion consistency checks
remain active. Restoration replaces constructor defaults with the validated
saved state; it does not restart a camp or create another owned companion.

Old schema/fingerprint files follow the existing incompatible-save handling.
There is no migration that invents elapsed camp history for earlier empty-jungle
practice saves. The independent fixture remains available for controlled tests.

## Validation and limits

The [verification ledger](reference/rift-practice-verification.json) records the
current commands and results. Focused simulation checks cover both populated and
empty Rift practice, all pack births, protected emergence, purchases and scheduled
Smite kills for all three companions, independent respawns, river shrines and later
shared births, exact continuation and malformed-save rejection.

Browser coverage includes a default-practice run that reaches the first ready
camp deadline on the uninterrupted live clock, then saves and reloads exactly.
The companion and camp interaction cases also use real menus, shop controls,
attack/Smite input and saved reloads. Their approach/health setup, later feeding
and calendar jumps remain diagnostics. They do not certify a naturally played
full jungle route, current native reward modifiers, a full match or visual parity.

Formal roles, jungle bots, epic objectives, full champion kits and roster,
consumables/undo, native effects/audio/visual comparison, delivery/offline and
complete-match performance acceptance remain in the project goal.
