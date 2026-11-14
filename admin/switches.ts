/**
 * Every game and every switch the owner can turn, in one place, for the admin page's "Games at a glance" and
 * "All switches" screens (owner, 12 Nov 2026: "the admin panel should cover it all").
 *
 * Nothing here can sign or send anything and nothing here holds a key or a token. It is plain data:
 *   - GAMES:     every game in the vault's game list (game-data/deployment.json → vaultGames), with the fixed values
 *                the owner's vault commands are pre-filled with;
 *   - VARIABLES: every GitHub repository variable a workflow reads (`vars.X` in .github/workflows). The admin page
 *                cannot set these (that would need a GitHub token), so it explains each one and opens the GitHub page;
 *   - LAUNCH:    the order of steps each game needs before it earns, with the dates the project docs give.
 *
 * tests/audit/admin.overview.test.ts keeps this complete: it fails when a game, a workflow variable or a game's
 * stake control is missing, so a new switch cannot ship without a card here.
 */

/** Opens only this repository's GitHub page (the admin page refuses any other link). */
export const VARIABLES_URL = "https://github.com/bawcejawn/KnodeGames/settings/variables/actions";

export type Game = {
  id: number;
  name: string;
  /** The admin area (AREAS id) that holds the game's own controls. */
  area: string;
  /** Weeks per season, the value `game-add` is pre-filled with (Survivor 2; the others pay weekly). */
  season: number;
  /** The free 2 + 1 VHP prize switch the owner set when the game was added (D-081, D-082). */
  freePrize: "on" | "off";
  /** False for game 1: the Daily Questions are already in the vault, so they are never added or applied. */
  addable: boolean;
};

/** Source: game-data/deployment.json (vaultGames) and the owner's free-prize decisions: the Vault chat's list of 3 Nov (D-081),
 *  changed for the Bracket to OFF on 11 Nov. The page flags any game whose live switch differs from this plan. */
export const GAMES: Game[] = [
  { id: 1, name: "Daily Questions", area: "question", season: 1, freePrize: "on", addable: false },
  { id: 2, name: "Who Signs Block X", area: "blockx", season: 1, freePrize: "on", addable: true },
  { id: 3, name: "Survivor", area: "survivor", season: 2, freePrize: "off", addable: true },
  { id: 4, name: "Fantasy Producers", area: "fantasy", season: 1, freePrize: "off", addable: true },
  { id: 6, name: "Block Golf", area: "golf", season: 1, freePrize: "off", addable: true },
  { id: 7, name: "Producer Race", area: "race", season: 1, freePrize: "on", addable: true },
  { id: 8, name: "Combo Card", area: "combo", season: 1, freePrize: "off", addable: true },
  { id: 9, name: "Producer Bracket", area: "bracket", season: 1, freePrize: "off", addable: true },
  { id: 13, name: "Last Node Standing", area: "lastnode", season: 1, freePrize: "on", addable: true },
];

export type Variable = {
  name: string;
  /** Game ids it belongs to; an empty list means the whole platform. */
  games: number[];
  /** What to type: shown next to the name. */
  format: string;
  what: string;
  when: string;
  /** Says plainly when a change cannot be undone or when it starts to count. */
  note?: string;
};

const TF = "true or false";
const WEEK = "a vault week number, e.g. 5";
const WEEKS = "vault week numbers, e.g. 5 or 5,6";

/** Every `vars.NAME` the workflows read, 12 Nov 2026. The test reads the workflow files to prove none is missing. */
export const VARIABLES: Variable[] = [
  // ── The whole platform ──
  { name: "BOT_ENABLED", games: [], format: TF, what: "Runs the hourly operator bot: it posts and resolves the Daily Questions, closes and finalizes weeks, posts the games' results to the vault and publishes game-data.", when: "Set false to stop the bot (for example while you fix something). Stakes and withdrawals are untouched.", note: "Takes effect on the next hourly run." },
  { name: "GAMES_ENABLED", games: [], format: TF, what: "Runs the hourly recorders for Who Signs Block X and the Producer Bracket (the workflow called KnodeGames recorders); each publishes to its own folder on the games-data branch.", when: "Set false to pause both recorders at once.", note: "Takes effect on the next run. The site keeps the last published files." },
  { name: "STATS_ENABLED", games: [], format: TF, what: "Publishes the public summary (stats.json, every 2 hours) that the home page's pool card and stats strip read.", when: "Set false to stop updating it; the site hides figures older than six hours.", note: "Takes effect on the next run." },
  { name: "NAMES_ENABLED", games: [], format: TF, what: "Runs the hourly job that reads Koinos @names and pool names from the chain.", when: "Set false to stop refreshing names.", note: "Takes effect on the next run." },
  { name: "PRIZES_FROM_WEEK", games: [2, 7], format: WEEK, what: "The first vault week Block X and the Producer Race are paid. It must be a plain week number.", when: "Set once, after the games are applied in the vault, and never unset it.", note: "NEVER leave it unset or mistyped: every Block X and Race paid week is then held, staked results included, and if it is not fixed within 3 days that week rolls over." },
  { name: "RPC", games: [], format: "a node address (URL)", what: "The Koinos node the workflows read from. When unset they use the default public node.", when: "Only if that node is down or slow." },
  { name: "RPC_CHECK", games: [], format: "a node address (URL)", what: "A second, independent node. Results are posted only when both nodes agree.", when: "Only if that node is down. Keep it a different operator from RPC, or the two-node check proves nothing." },
  { name: "RPC_VERIFY", games: [], format: "a node address (URL)", what: "An optional third node that the Race publish job uses to re-check each block's signer. When unset it uses RPC_CHECK.", when: "Only if that node is down." },
  { name: "PERSONAL_PRODUCER", games: [], format: "a producer address", what: "The producer the node watchdog checks every 15 minutes: if it is silent for 30 minutes or more the run fails and GitHub emails you.", when: "When you change which producer you want to watch." },
  { name: "VHP_RULER_ENABLED", games: [], format: TF, what: "Runs the VHP Ruler's data recorder and its fill jobs (read-only on the chain, no key).", when: "Set false only if the Ruler's recorder must stop; ask the Ruler chat first.", note: "Never edit the Ruler's own files from here; this switch only turns its jobs on or off." },
  { name: "VHP_KEEP_DAYS", games: [], format: "a number of days (default 30)", what: "How many days of VHP readings the Ruler's recorder keeps.", when: "Rarely. Raise it only if the Ruler chat asks for longer history." },
  { name: "TESTNET_GAMES_ENABLED", games: [], format: TF, what: "Runs the trial copies of the games on the Koinos Foundation testnet (test KOIN only).", when: "Set true while a game is on trial; false otherwise." },

  // ── Game 1: Daily Questions ──
  { name: "QUESTIONS_FROM_WEEK", games: [1], format: WEEK, what: "The vault week from which the Questions game is paid from its results file (v6.1's rule week).", when: "Set it only once v6.1 is uploaded (the question game's status prints the week).", note: "From that week, a week the vault reads as not shared fails the run instead of paying nothing." },
  { name: "QUESTIONS_HOLD", games: [1], format: WEEKS, what: "Holds those weeks' Questions results: they cannot go final, so nothing is paid for them.", when: "If a question or its results look wrong.", note: "Pair it with a reason below. Remove the week to let it go on, or use release." },
  { name: "QUESTIONS_HOLD_REASON", games: [1], format: "a short sentence", what: "The public reason shown for a hold.", when: "Whenever you set a hold." },
  { name: "QUESTIONS_RELEASE", games: [1], format: WEEKS, what: "Releases a held week once it has been checked.", when: "After a hold, when the week is right." },

  // ── Game 2: Who Signs Block X ──
  { name: "BLOCKX_RELEASE", games: [2], format: "<week>:<release code>, e.g. 5:0123456789abcdef", what: "Lets one held Block X week through, once. The code is printed with the hold.", when: "Only after the cause of that hold was checked.", note: "It releases only that week and only for that same hold reason." },

  // ── Game 6: Block Golf ──
  { name: "GOLF_ENABLED", games: [6], format: TF, what: "Runs the hourly Block Golf recorder.", when: "Set true to start practice weeks; false to stop. Stakes are untouched." },
  { name: "GOLF_STAKED_FROM_WEEK", games: [6], format: WEEK, what: "The vault week Block Golf first pays staked players.", when: "Once, after the game is applied in the vault and its status shows the week (and before that week's first run, Monday 00:57 UTC).", note: "PERMANENT: never change it once a week is published with it; the publish job refuses a change. If the apply slipped, do not set it." },
  { name: "GOLF_HOLD_WEEKS", games: [6], format: WEEKS, what: "Holds those weeks' Block Golf results so they cannot go final.", when: "If a week's course or results look wrong.", note: "Remove the week to release it. Anything that is not a plain list of numbers holds every week until fixed." },

  // ── Game 7: Producer Race ──
  { name: "RACE_ENABLED", games: [7], format: TF, what: "Runs the Race's hourly recorder and its VHP samples.", when: "Set false to stop the Race's recorder. Stakes are untouched." },
  { name: "RACE_HOLD_WEEKS", games: [7], format: WEEKS, what: "Holds those weeks' Race results so they cannot go final.", when: "If a week looks wrong.", note: "Remove the week to release it." },
  { name: "RACE_RULER_FROM_WEEK", games: [7], format: WEEK, what: "The vault week the Race is scored by the VHP Ruler. The week before is a trial week (it counts for nothing); every week from this one is live.", when: "The Race goes live on the Ruler from Week 1 (Mon 16 Nov, vault week 4).", note: "A week that has started never changes how it is scored, and a live week never goes back. Unset = the Race's own method." },

  // ── Game 9: Producer Bracket ──
  { name: "BRACKET_RULER_FROM_WEEK", games: [9], format: WEEK, what: "The vault week the Bracket is scored by the VHP Ruler (the week before is a trial week).", when: "When the Bracket's own Ruler PR is merged (Repo Lens GO first).", note: "A week that has started never changes how it is scored, and a live week never goes back. Unset = the Bracket's own method." },
  { name: "BRACKET_RULER_MODE", games: [9], format: "empty, or week:mode pairs like 6:B (modes A to D, weeks rising)", what: "Which VHP Ruler mode (A to D) the Bracket's day cards use from which vault week. Empty = mode A.", when: "Only when the Ruler chat and the owner choose a mode for a future week.", note: "A week that has started never changes mode (the publish job holds the Bracket if it would). Players are never told the mode." },
  { name: "BLOCKX_RULER_FROM_WEEK", games: [2], format: WEEK, what: "The vault week Block X is scored by the VHP Ruler (points = 100 × the ruler's multiplier, at most ×120). The week before is a trial week: the ruler box shows, but the old points count.", when: "5 (Week 2, from Sun 22 Nov 7 PM ET) if the Block X ruler PR merges by Fri 20 Nov noon ET, otherwise 6. Set it after the merge, before that week starts.", note: "A week that has started never changes how it is scored, and a live week never goes back. Before you first set it, unset = the old points (no ruler). Once set, never unset it or move it to a started week: the publish job refuses the change and stops publishing Block X, the Bracket and Questions until it is set back." },
  { name: "BRACKET_PRIZES_FROM_WEEK", games: [9], format: WEEK, what: "The first vault week the Vault pays the Bracket.", when: "After the Bracket is applied in the vault.", note: "Leave unset and no medals or prize lists are shown (it fails closed)." },
  { name: "BRACKET_RELEASE", games: [9], format: WEEKS, what: "Lets the Bracket re-read a week's seeding and hours, and record late picks, for those weeks.", when: "Only when the Bracket chat asks for a one-off release.", note: "A plain list like 3 or 3,4; anything else releases nothing." },
];

/** One step of a game's launch. `check` names the read-only admin button that proves it (admin/actions.ts). */
export type Step = { text: string; check?: string };
export type Launch = { game: number; steps: Step[]; dates?: string };

/** The order every staked game follows to start earning (Vault chat, 3 Nov), then what is special about each. */
export const STANDARD_STEPS: Step[] = [
  { text: "Set the game's free-prize switch first (ON or OFF), before adding the game. A game with no switch follows its --free registration, which is ON.", check: "glance-prizes" },
  { text: "Announce the game in the vault (Add a game, step 1). Players get 48 hours' notice.", check: "glance-vault" },
  { text: "After the 48 hours, and before the announcement expires after seven more days, apply it (step 2). A game applied in vault week W earns from week W + 1.", check: "glance-vault" },
  { text: "Check the vault now says \"staked + free prize, from week <n>\" with the week you expect. If it names the wrong week, stop and tell the Vault chat.", check: "glance-vault" },
  { text: "Set the game's GitHub switches (the All switches screen lists each one) in the order its own runbook gives.", check: "glance-golf" },
];

export const LAUNCH: Launch[] = [
  { game: 1, steps: [{ text: "Already in the vault. From v6.1's rule week it is paid from its results file like every game: set QUESTIONS_FROM_WEEK once v6.1 is uploaded.", check: "glance-questions" }], dates: "v6.1 rule week: Mon 16 Nov (vault week 4 = Week 1)." },
  { game: 2, steps: [{ text: "Live and staked. Nothing to start. Use Hold or Release only if a week looks wrong.", check: "glance-picks" }], dates: "Pays from the week of Mon 9 Nov (vault week 3, a test week), then Week 1 from Mon 16 Nov." },
  { game: 3, steps: [{ text: "Season 1 needs its Repo Lens pass and a testnet season first. Then: free prize OFF, Add a game (season 2), apply.", check: "glance-vault" }], dates: "Planned Season 1: Mon 16 Nov." },
  { game: 4, steps: [{ text: "Needs its fix-checks and a full test week first. Then: free prize OFF, Add a game, apply.", check: "glance-vault" }], dates: "Launches on the Ruler (owner, 11 Nov)." },
  { game: 6, steps: [{ text: "Game 6 is added (12 Nov, about 3:16 PM ET). Apply it in vault week 4 (Sun 15 Nov 7:00 PM ET to Sat 21 Nov before 3:16 PM ET; aim for Mon 16 Nov), then set GOLF_STAKED_FROM_WEEK to the week the status shows (5) before Sun 22 Nov 7:57 PM ET.", check: "glance-golf" }], dates: "Applying before Sun 15 Nov 7:00 PM ET is wrong: Golf would earn from Week 1 while it is practice-only. After Sat 21 Nov 3:16 PM ET the announcement has expired." },
  { game: 7, steps: [{ text: "Live and staked. Scored by the Ruler from Week 1: RACE_RULER_FROM_WEEK = 4 (Mon 16 Nov).", check: "glance-race" }], dates: "Ruler live from Week 1 (Mon 16 Nov)." },
  { game: 8, steps: [{ text: "Needs fix-check 4 and the Picks v2 (CARD) upgrade and its audit first. Then: free prize OFF, Add a game, apply.", check: "glance-vault" }], dates: "Launches on the Ruler (owner, 11 Nov)." },
  { game: 9, steps: [{ text: "Needs its fix-check, then: free prize OFF first (owner, 11 Nov: the Bracket's pages say no free prize is paid), then Add a game, then apply it during vault week 4 (Week 1: Mon 16 to Sun 22 Nov) so its practice week and first paid week match its page, then BRACKET_PRIZES_FROM_WEEK, and its Ruler switch with its own Repo Lens GO.", check: "glance-vault" }], dates: "Ruler switch: PR by Fri 20 Nov 12:00 ET to be live from Week 2 (Mon 23 Nov), otherwise Week 3 (Mon 30 Nov)." },
  { game: 13, steps: [{ text: "Needs its round-3 review and 48 hours of sampler readings. Then: Add a game (free prize ON), apply.", check: "glance-vault" }], dates: "Launches on the Ruler (owner, 11 Nov)." },
];
