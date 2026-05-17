// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: red; icon-glyph: magic;
// ======================================================
// DELIVERY DASHBOARD WIDGET
// Supports:
// - Lock Screen Inline
// - Lock Screen Rectangular
// - Small Widget
// - Medium Widget
// - CarPlay-style large display
//
// Put route.json in Scriptable/iCloud/Documents
// ======================================================

// ======================================================
// AUTO UPDATE CONFIG
// ======================================================

const SCRIPT_VERSION = "1.0.0"

const UPDATE_INFO_URL =
  "https://raw.githubusercontent.com/Jalla-js/DeliveryDashboard/refs/heads/main/version.json"

// ======================================================
// FILE SETUP
// ======================================================

const fm = FileManager.iCloud()

// ======================================================
// UPDATE SYSTEM
// ======================================================

let updateAvailable = false
let latestVersion = SCRIPT_VERSION

async function checkForUpdates() {

  try {

    const req = new Request(UPDATE_INFO_URL)

    req.timeoutInterval = 5

    const info = await req.loadJSON()

    latestVersion = info.version || SCRIPT_VERSION

    if (latestVersion !== SCRIPT_VERSION) {

      updateAvailable = true

      // ONLY ASK TO UPDATE INSIDE APP
      if (!config.runsInWidget) {

        let alert = new Alert()

        alert.title = "Update Available"

        alert.message =
          `Version ${latestVersion} is available.\n\n` +
          `Current version: ${SCRIPT_VERSION}`

        alert.addAction("Update Now")
        alert.addCancelAction("Later")

        let result = await alert.present()

        if (result === 0) {

          await installUpdate(info.script)

        }
      }
    }

  } catch (e) {

    console.log("Update check failed")
    console.log(e)

  }
}

// ======================================================
// INSTALL UPDATE
// ======================================================

async function installUpdate(url) {

  try {

    let req = new Request(url)

    let newCode = await req.loadString()

    let path = module.filename

    fm.writeString(path, newCode)

    let n = new Notification()

    n.title = "Widget Updated"

    n.body = `Updated to ${latestVersion}`

    await n.schedule()

    Safari.open(
      "scriptable:///run/" +
      encodeURIComponent(Script.name())
    )

  } catch (e) {

    let a = new Alert()

    a.title = "Update Failed"

    a.message = String(e)

    await a.present()

  }
}

// ======================================================
// CHECK FOR UPDATES
// ======================================================

await checkForUpdates()

// ======================================================
// ROUTE FILES
// ======================================================

const routePath = fm.joinPath(
  fm.documentsDirectory(),
  "route.json"
)

const logPath = fm.joinPath(
  fm.documentsDirectory(),
  "route_log.json"
)

// ======================================================
// LOAD DATA
// ======================================================

if (!fm.fileExists(routePath)) {
  return finishError("No route data")
}

let data

try {

  data = JSON.parse(
    fm.readString(routePath)
  )

} catch {

  return finishError("Invalid JSON")

}

// ======================================================
// SAFE VALUES
// ======================================================

const delivered = safeNum(data.delivered)
const total = safeNum(data.total)

const now = new Date()

const start = new Date(data.start)
const end = new Date(data.end)

if (isNaN(start) || isNaN(end)) {
  return finishError("Bad time data")
}

// ======================================================
// TIME CALCULATIONS
// ======================================================

let totalMinutes = (end - start) / 60000
let elapsedMinutes = (now - start) / 60000

totalMinutes = Math.max(totalMinutes, 1)
elapsedMinutes = Math.max(elapsedMinutes, 1)

const totalHours = totalMinutes / 60
const elapsedHours = elapsedMinutes / 60

// ======================================================
// PERFORMANCE CALCULATIONS
// ======================================================

const percent = total > 0
  ? Math.round((delivered / total) * 100)
  : 0

const expected =
  (elapsedMinutes / totalMinutes) * total

const diff = delivered - expected

const activeHours =
  Math.max(elapsedHours, 0.33)

let pace = delivered / activeHours

pace = Math.max(pace, 1)
pace = Math.min(pace, 60)

const remaining =
  Math.max(total - delivered, 0)

const hoursLeft = remaining / pace

const eta = new Date(
  now.getTime() + hoursLeft * 3600000
)

const etaStr = eta.toLocaleTimeString([], {
  hour: "2-digit",
  minute: "2-digit"
})

const remainingMinutes =
  Math.round(hoursLeft * 60)

const hrsLeft =
  Math.floor(remainingMinutes / 60)

const minsLeft =
  remainingMinutes % 60

const remainingText =
  hrsLeft > 0
    ? `${hrsLeft}h ${minsLeft}m left`
    : `${minsLeft}m left`

// ======================================================
// STATUS TEXT
// ======================================================

let statusText = ""
let statusColor = Color.orange()

if (diff >= 8) {

  statusText = "🔥 Flying today"
  statusColor = Color.green()

}
else if (diff >= 3) {

  statusText =
    `↑ Ahead by ${Math.round(diff)}`

  statusColor = Color.green()

}
else if (diff > -3) {

  statusText = "→ On pace"
  statusColor = Color.orange()

}
else {

  statusText =
    `↓ Behind by ${Math.round(Math.abs(diff))}`

  statusColor = Color.red()

}

// ======================================================
// FINISHED?
// ======================================================

if (remaining <= 0) {

  showFinishedWidget()
  return

}

// ======================================================
// WIDGET SELECTOR
// ======================================================

let widget

switch (config.widgetFamily) {

  case "accessoryInline":
    widget = createInlineWidget()
    break

  case "accessoryRectangular":
    widget = createLockRectWidget()
    break

  case "small":
    widget = createSmallWidget()
    break

  case "medium":
    widget = createMediumWidget()
    break

  case "large":
    widget = createCarPlayWidget()
    break

  default:
    widget = createMediumWidget()
    break
}

Script.setWidget(widget)
Script.complete()

// ======================================================
// INLINE LOCK SCREEN
// ======================================================

function createInlineWidget() {

  let w = new ListWidget()

  let t = w.addText(
    `${delivered}/${total} • ${percent}%`
  )

  t.font = Font.mediumSystemFont(12)
  t.textColor = Color.white()

  return w
}

// ======================================================
// RECTANGULAR LOCK SCREEN
// ======================================================

function createLockRectWidget() {

  let w = new ListWidget()

  setBackground(w)

  addUpdateBanner(w)

  let top = w.addText(`${delivered}/${total}`)

  top.font = Font.boldSystemFont(18)
  top.textColor = Color.white()

  w.addSpacer(2)

  let bar = w.addText(
    makeBar(delivered, total, 12)
  )

  bar.font =
    Font.mediumMonospacedSystemFont(8)

  bar.textColor = Color.green()

  w.addSpacer(3)

  let s = w.addText(statusText)

  s.font = Font.mediumSystemFont(11)
  s.textColor = statusColor

  return w
}

// ======================================================
// SMALL WIDGET
// ======================================================

function createSmallWidget() {

  let w = new ListWidget()

  setBackground(w)

  addUpdateBanner(w)

  let top = w.addText(`${delivered}/${total}`)

  top.font = Font.boldSystemFont(28)
  top.textColor = Color.white()

  w.addSpacer(4)

  let bar = w.addText(
    makeBar(delivered, total, 14)
  )

  bar.font =
    Font.mediumMonospacedSystemFont(9)

  bar.textColor = Color.green()

  w.addSpacer(6)

  let pct = w.addText(
    `${percent}% complete`
  )

  pct.font = Font.mediumSystemFont(12)
  pct.textColor = Color.lightGray()

  w.addSpacer(4)

  let st = w.addText(statusText)

  st.font = Font.mediumSystemFont(11)
  st.textColor = statusColor

  w.addSpacer()

  let bottom = w.addText(
    `${pace.toFixed(0)}/hr • ETA ${etaStr}`
  )

  bottom.font = Font.mediumSystemFont(10)
  bottom.textColor = Color.lightGray()

  return w
}

// ======================================================
// MEDIUM WIDGET
// ======================================================

function createMediumWidget() {

  let w = new ListWidget()

  setBackground(w)

  addUpdateBanner(w)

  let main = w.addStack()

  // LEFT
  let left = main.addStack()
  left.layoutVertically()

  let big = left.addText(`${delivered}/${total}`)

  big.font = Font.boldSystemFont(34)
  big.textColor = Color.white()

  left.addSpacer(6)

  let progress = left.addText(
    makeBar(delivered, total, 18)
  )

  progress.font =
    Font.mediumMonospacedSystemFont(10)

  progress.textColor = Color.green()

  left.addSpacer(6)

  let pct = left.addText(
    `${percent}% complete`
  )

  pct.font = Font.mediumSystemFont(13)
  pct.textColor = Color.lightGray()

  // SPACER
  main.addSpacer()

  // RIGHT
  let right = main.addStack()
  right.layoutVertically()

  let stat = right.addText(statusText)

  stat.font = Font.mediumSystemFont(14)
  stat.textColor = statusColor

  right.addSpacer(10)

  let paceText = right.addText(
    `${pace.toFixed(0)} parcels/hr`
  )

  paceText.font =
    Font.mediumSystemFont(13)

  paceText.textColor = Color.white()

  right.addSpacer(4)

  let etaText = right.addText(
    `ETA ${etaStr}`
  )

  etaText.font =
    Font.mediumSystemFont(13)

  etaText.textColor = Color.white()

  right.addSpacer(4)

  let remain = right.addText(
    remainingText
  )

  remain.font =
    Font.mediumSystemFont(13)

  remain.textColor = Color.lightGray()

  w.addSpacer()

  let footer = w.addText(
    phaseText()
  )

  footer.font =
    Font.mediumSystemFont(11)

  footer.textColor =
    new Color("#888888")

  return w
}

// ======================================================
// LARGE WIDGET
// ======================================================

function createCarPlayWidget() {

  let w = new ListWidget()

  setBackground(w)

  addUpdateBanner(w)

  let title = w.addText(
    "DELIVERY DASHBOARD"
  )

  title.font = Font.boldSystemFont(14)
  title.textColor = Color.orange()

  w.addSpacer(10)

  let count = w.addText(
    `${delivered}/${total}`
  )

  count.font = Font.boldSystemFont(52)
  count.textColor = Color.white()

  w.addSpacer(10)

  let progress = w.addText(
    makeBar(delivered, total, 28)
  )

  progress.font =
    Font.mediumMonospacedSystemFont(14)

  progress.textColor = Color.green()

  w.addSpacer(10)

  let status = w.addText(statusText)

  status.font = Font.boldSystemFont(20)
  status.textColor = statusColor

  w.addSpacer(12)

  let row = w.addStack()

  let paceBox = row.addStack()
  paceBox.layoutVertically()

  let p1 = paceBox.addText("PACE")

  p1.font = Font.mediumSystemFont(10)
  p1.textColor = Color.gray()

  let p2 = paceBox.addText(
    `${pace.toFixed(0)}/HR`
  )

  p2.font = Font.boldSystemFont(22)
  p2.textColor = Color.white()

  row.addSpacer(24)

  let etaBox = row.addStack()
  etaBox.layoutVertically()

  let e1 = etaBox.addText("ETA")

  e1.font = Font.mediumSystemFont(10)
  e1.textColor = Color.gray()

  let e2 = etaBox.addText(etaStr)

  e2.font = Font.boldSystemFont(22)
  e2.textColor = Color.white()

  row.addSpacer(24)

  let remBox = row.addStack()
  remBox.layoutVertically()

  let r1 = remBox.addText("REMAINING")

  r1.font = Font.mediumSystemFont(10)
  r1.textColor = Color.gray()

  let r2 = remBox.addText(
    `${remaining}`
  )

  r2.font = Font.boldSystemFont(22)
  r2.textColor = Color.white()

  return w
}

// ======================================================
// FINISHED WIDGET
// ======================================================

function showFinishedWidget() {

  let w = new ListWidget()

  setBackground(w)

  addUpdateBanner(w)

  let top = w.addText(
    "✅ Route Complete"
  )

  top.font = Font.boldSystemFont(24)
  top.textColor = Color.green()

  w.addSpacer(10)

  let stat = w.addText(
    `${delivered} parcels delivered`
  )

  stat.font = Font.mediumSystemFont(16)
  stat.textColor = Color.white()

  w.addSpacer(4)

  let paceText = w.addText(
    `${(delivered / totalHours).toFixed(1)} parcels/hr`
  )

  paceText.font =
    Font.mediumSystemFont(14)

  paceText.textColor = Color.lightGray()

  Script.setWidget(w)
  Script.complete()
}

// ======================================================
// HELPERS
// ======================================================

function safeNum(n) {
  return Number(n) || 0
}

function finishError(message) {

  let w = new ListWidget()

  w.backgroundColor =
    new Color("#111111")

  let t = w.addText(message)

  t.textColor = Color.red()
  t.font = Font.boldSystemFont(16)

  Script.setWidget(w)
  Script.complete()
}

function makeBar(current, total, size = 12) {

  let pct =
    total > 0
      ? current / total
      : 0

  let filled =
    Math.round(pct * size)

  return (
    "■".repeat(filled) +
    "□".repeat(size - filled)
  )
}

function setBackground(widget) {

  let gradient = new LinearGradient()

  gradient.locations = [0, 1]

  gradient.colors = [
    new Color("#1c1c1e"),
    new Color("#111111")
  ]

  widget.backgroundGradient = gradient

  widget.setPadding(14, 14, 14, 14)
}

function phaseText() {

  let hour = now.getHours()

  if (hour < 11) {
    return "Good start to the route"
  }

  if (hour < 15) {
    return "Peak delivery hours"
  }

  if (hour < 18) {
    return "Final afternoon push"
  }

  return "Final stretch"
}

// ======================================================
// UPDATE BANNER
// ======================================================

function addUpdateBanner(widget) {

  if (!updateAvailable) return

  let banner = widget.addStack()

  banner.backgroundColor =
    new Color("#ff9500", 0.18)

  banner.cornerRadius = 8

  banner.setPadding(4, 6, 4, 6)

  let text = banner.addText(
    "NEW VERSION • Run in Scriptable"
  )

  text.font = Font.boldSystemFont(9)

  text.textColor =
    new Color("#ff9500")

  widget.addSpacer(8)
}