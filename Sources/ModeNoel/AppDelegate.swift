import AppKit
import SwiftUI
import ServiceManagement
import ModeNoelCore

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var item: NSStatusItem!
    private var layers: [LayerWindow] = []
    private lazy var tracker = Tracker { [weak self] in self?.layers ?? [] }
    private var hotKey: HotKey?
    private let defaults = UserDefaults.standard
    private lazy var theme = ThemeState(
        store: GlobalPrefs(),
        stateURL: FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("ModeNoel/theme.json"))
    private(set) var active = false
    private lazy var model = PanelModel(settings: Prefs.load(defaults))
    private let popover = NSPopover()
    private var settings: Prefs { model.settings }

    private var webDir: URL {
        if let dev = ProcessInfo.processInfo.environment["MODENOEL_WEB"], !dev.isEmpty { return URL(fileURLWithPath: dev) }
        return Bundle.main.resourceURL!.appendingPathComponent("web")
    }

    func applicationDidFinishLaunching(_ n: Notification) {
        if let i = CommandLine.arguments.firstIndex(of: "--render-panel"), i + 1 < CommandLine.arguments.count {
            MainActor.assumeIsolated { renderPanel(to: CommandLine.arguments[i + 1]) }; exit(0)
        }
        theme.recoverIfNeeded()
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.imagePosition = .imageLeading
        item.button?.target = self
        item.button?.action = #selector(statusClicked)
        item.button?.sendAction(on: [.leftMouseUp, .rightMouseUp])
        setUpPanel()
        refreshStatusItem()
        hotKey = HotKey { [weak self] in self?.toggle() }

        let nc = NotificationCenter.default
        nc.addObserver(self, selector: #selector(screensChanged), name: NSApplication.didChangeScreenParametersNotification, object: nil)
        let wc = NSWorkspace.shared.notificationCenter
        wc.addObserver(self, selector: #selector(pause(_:)), name: NSWorkspace.screensDidSleepNotification, object: nil)
        wc.addObserver(self, selector: #selector(resume(_:)), name: NSWorkspace.screensDidWakeNotification, object: nil)
        wc.addObserver(self, selector: #selector(pause(_:)), name: NSWorkspace.sessionDidResignActiveNotification, object: nil)
        wc.addObserver(self, selector: #selector(resume(_:)), name: NSWorkspace.sessionDidBecomeActiveNotification, object: nil)
        let dc = DistributedNotificationCenter.default()
        dc.addObserver(self, selector: #selector(pause(_:)), name: NSNotification.Name("com.apple.screenIsLocked"), object: nil)
        dc.addObserver(self, selector: #selector(resume(_:)), name: NSNotification.Name("com.apple.screenIsUnlocked"), object: nil)

        Timer.scheduledTimer(withTimeInterval: 600, repeats: true) { [weak self] _ in self?.refreshStatusItem() }
        let firstLaunch = !defaults.bool(forKey: "launchedBefore")
        defaults.set(true, forKey: "launchedBefore")
        if firstLaunch || defaults.bool(forKey: "active") || CommandLine.arguments.contains("--on") { setActive(true) }
        if firstLaunch { DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { [weak self] in self?.showPanel() } }  // show where the settings live
        if CommandLine.arguments.contains("--panel") { DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in self?.showPanel() } }
    }

    func applicationWillTerminate(_ n: Notification) {
        let keep = active
        setActive(false, animated: false)
        defaults.set(keep, forKey: "active") // reopen in the same state next login
    }

    /// Dev helper: draw the settings panel into a PNG (visual check without opening the menu bar).
    @MainActor private func renderPanel(to path: String) {
        model.countdown = countdownText(now: Date(), calendar: .current)
        model.active = CommandLine.arguments.contains("--as-active")
        let r = ImageRenderer(content: PanelView(m: model))
        r.scale = 2
        if let img = r.nsImage, let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
           let png = rep.representation(using: .png, properties: [:]) { try? png.write(to: URL(fileURLWithPath: path)) }
    }

    // MARK: on / off

    @objc func toggle() { setActive(!active) }

    private var generation = 0

    func setActive(_ on: Bool, animated: Bool = true) {
        guard on != active else { return }
        trace("setActive \(on)")
        active = on
        model.active = on
        generation += 1
        defaults.set(on, forKey: "active")
        if on {
            if settings.accent { theme.apply() }
            buildLayers()
            tracker.start()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in self?.greet() }
        } else {
            tracker.stop()
            let closing = layers, gen = generation
            layers.removeAll()
            let teardown = { [weak self] in
                closing.forEach { $0.orderOut(nil); $0.close() }
                if self?.generation == gen { self?.theme.restore() }
            }
            if animated && !closing.isEmpty {
                closing.forEach { $0.send("MN.outro&&MN.outro()") }   // snow slides off, lights go out, fade
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5, execute: teardown)
            } else { teardown() }
        }
        refreshStatusItem()
    }

    private func greet() {
        let cd = countdownText(now: Date(), calendar: .current)
        let days = cd.replacingOccurrences(of: "d", with: "")
        let text = cd == "Xmas!" ? "Merry Christmas!" : (days == "1" ? "Christmas Mode is on · Christmas is tomorrow" : "Christmas Mode is on · \(days) days to go")
        overlays.forEach {
            $0.send("MN.intro&&MN.intro()")
            $0.send("MN.banner&&MN.banner(\"\(text)\")")
            if settings.jingle { $0.send("MN.jingle&&MN.jingle()") }
        }
    }

    private var overlays: [LayerWindow] { layers.filter { $0.kind == .overlay } }

    private func buildLayers() {
        trace("buildLayers")
        builtShapes = currentShapes()
        layers.forEach { $0.close() }
        layers = []
        for s in NSScreen.screens {
            if settings.wallpaper { layers.append(LayerWindow(screen: s, kind: .wallpaper, webDir: webDir, overFullScreen: false, aboveIcons: settings.hideIcons)) }
            layers.append(LayerWindow(screen: s, kind: .overlay, webDir: webDir, overFullScreen: settings.fullscreen))
        }
        layers.forEach { $0.orderFrontRegardless() }
        for l in layers { trace("layer \(l.kind) num=\(l.windowNumber) frame=\(l.frame) level=\(l.level.rawValue) visible=\(l.isVisible) onActiveSpace=\(l.isOnActiveSpace)") }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in self?.pushOptions() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in self?.pushOptions() }
    }

    /// Add or remove only the wallpaper windows, so the snow on the overlay is kept.
    private func syncWallpaper() {
        let has = layers.contains { $0.kind == .wallpaper }
        if settings.wallpaper && !has {
            let w = NSScreen.screens.map { LayerWindow(screen: $0, kind: .wallpaper, webDir: webDir, overFullScreen: false, aboveIcons: settings.hideIcons) }
            w.forEach { $0.orderFrontRegardless() }
            layers.insert(contentsOf: w, at: 0)
        } else if !settings.wallpaper && has {
            layers.filter { $0.kind == .wallpaper }.forEach { $0.orderOut(nil); $0.close() }
            layers.removeAll { $0.kind == .wallpaper }
        }
    }

    private func pushOptions() {
        let js = "MN.setOpts&&MN.setOpts(\(settings.jsOptions))"
        layers.forEach { $0.send(js) }
    }

    private func settingsChanged(_ old: Prefs, _ new: Prefs) {
        new.save(defaults)
        if active {
            if old.wallpaper != new.wallpaper { syncWallpaper() }
            if old.fullscreen != new.fullscreen { overlays.forEach { $0.setOverFullScreen(new.fullscreen) } }
            if old.hideIcons != new.hideIcons { layers.filter { $0.kind == .wallpaper }.forEach { $0.level = LayerWindow.wallpaperLevel(aboveIcons: new.hideIcons) } }
            if old.accent != new.accent { new.accent ? theme.apply() : theme.restore() }
            pushOptions()
        }
        if old.countdownInMenuBar != new.countdownInMenuBar { refreshStatusItem() }
    }

    private var builtShapes: [ScreenShape] = []
    private var rebuildWork: DispatchWorkItem?
    private func currentShapes() -> [ScreenShape] { NSScreen.screens.map { ScreenShape(frame: $0.frame, scale: $0.backingScaleFactor) } }

    // macOS fires this in bursts (full-screen / Space transitions) even when nothing changed:
    // only rebuild for a real screen change, once the burst is over.
    @objc private func screensChanged() {
        guard active else { return }
        rebuildWork?.cancel()
        let w = DispatchWorkItem { [weak self] in
            guard let self, self.active else { return }
            let now = self.currentShapes()
            if needsRebuild(built: self.builtShapes, now: now) { trace("screens really changed → rebuild"); self.buildLayers() }
            else { trace("screen burst ignored (nothing changed)") }
        }
        rebuildWork = w
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6, execute: w)
    }
    @objc private func pause(_ n: Notification) { trace("pause \(n.name.rawValue)"); tracker.paused = true; layers.forEach { $0.send("MN.update&&MN.update({paused:true})") } }
    @objc private func resume(_ n: Notification) { trace("resume \(n.name.rawValue)"); tracker.paused = false }

    // MARK: status item + panel

    private func refreshStatusItem() {
        let cd = countdownText(now: Date(), calendar: .current)
        model.countdown = cd
        item.button?.image = NSImage(systemSymbolName: active ? "snowflake.circle.fill" : "snowflake", accessibilityDescription: "Christmas Mode")
        item.button?.title = settings.countdownInMenuBar ? " " + cd : ""
        item.button?.toolTip = "Christmas Mode — click: settings · right-click: on/off"
    }

    private func setUpPanel() {
        model.onToggle = { [weak self] in self?.toggle() }
        model.onChange = { [weak self] old, new in self?.settingsChanged(old, new) }
        model.onLogin = { [weak self] on in self?.setLogin(on) }
        model.onQuit = { NSApp.terminate(nil) }
        model.loginItem = SMAppService.mainApp.status == .enabled
        let host = NSHostingController(rootView: PanelView(m: model))
        host.sizingOptions = .preferredContentSize
        popover.contentViewController = host
        popover.behavior = .transient
        popover.animates = true
        popover.appearance = NSAppearance(named: .darkAqua)
    }

    @objc private func statusClicked() {
        if NSApp.currentEvent?.type == .rightMouseUp { toggle(); return }
        popover.isShown ? popover.performClose(nil) : showPanel()
    }

    private func showPanel() {
        guard let b = item.button else { return }
        model.loginItem = SMAppService.mainApp.status == .enabled
        refreshStatusItem()
        NSApp.activate(ignoringOtherApps: true)
        popover.show(relativeTo: b.bounds, of: b, preferredEdge: .minY)
    }

    private func setLogin(_ on: Bool) {
        do { on ? try SMAppService.mainApp.register() : try SMAppService.mainApp.unregister() }
        catch { trace("login item: \(error.localizedDescription)") }
        model.loginItem = SMAppService.mainApp.status == .enabled
    }
}
