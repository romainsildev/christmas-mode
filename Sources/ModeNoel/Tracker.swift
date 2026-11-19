import AppKit
import ModeNoelCore

/// 30 Hz loop: real windows + mouse + clicks → every overlay; pause state → every layer.
final class Tracker {
    private var timer: Timer?
    private var clickMonitor: Any?
    private var pendingClicks: [CGPoint] = [] // global AppKit coords (bottom-left)
    private let ownPID = ProcessInfo.processInfo.processIdentifier
    var layers: () -> [LayerWindow]
    var paused = false
    var debug = UserDefaults.standard.bool(forKey: "debug")
    private var lastWallpaperPaused: Bool?

    init(layers: @escaping () -> [LayerWindow]) { self.layers = layers }

    func start() {
        stop()
        lastWallpaperPaused = nil
        clickMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown]) { [weak self] _ in
            self?.pendingClicks.append(NSEvent.mouseLocation)
        }
        let t = Timer(timeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in self?.tick() }
        RunLoop.main.add(t, forMode: .common)
        timer = t
    }

    func stop() {
        timer?.invalidate(); timer = nil
        if let m = clickMonitor { NSEvent.removeMonitor(m) }
        clickMonitor = nil
    }

    private struct Payload: Encodable {
        var wins: [WinInfo]?
        var mouse: [Double]
        var clicks: [[Double]]
        var paused: Bool
        var debug: Bool
        var menu: Double
        var notch: [Double]?
        var dock: [Double]?
    }

    private func tick() {
        let ls = layers()
        guard !ls.isEmpty else { return }
        let primaryH = NSScreen.screens.first?.frame.height ?? 0
        let raw = paused ? [] : (CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? [])
        let m = NSEvent.mouseLocation
        let clicks = pendingClicks; pendingClicks.removeAll()
        let enc = JSONEncoder()
        let wallpaperDirty = lastWallpaperPaused != paused
        lastWallpaperPaused = paused
        for l in ls {
            if l.kind == .wallpaper && !wallpaperDirty { continue }  // the wallpaper only needs pause changes
            let f = l.screenRef.frame
            let local = { (p: CGPoint) -> [Double] in [p.x - f.minX, f.maxY - p.y] }
            var p = Payload(wins: nil, mouse: local(m), clicks: clicks.filter { f.contains($0) }.map(local), paused: paused, debug: debug, menu: max(24, f.maxY - l.screenRef.visibleFrame.maxY))
            if l.kind == .overlay && !paused {
                let tl = CGPoint(x: f.minX, y: primaryH - f.maxY)
                p.wins = localWindows(raw: raw, screenTopLeft: tl, screenSize: f.size, ownPID: ownPID)
                p.dock = dockRect(raw: raw, screenTopLeft: tl, screenSize: f.size)
                if let a = l.screenRef.auxiliaryTopLeftArea, let b = l.screenRef.auxiliaryTopRightArea {
                    p.notch = notchRect(leftAreaMaxX: a.maxX, rightAreaMinX: b.minX, topInset: l.screenRef.safeAreaInsets.top)
                }
            }
            guard let data = try? enc.encode(p), let json = String(data: data, encoding: .utf8) else { continue }
            l.send("window.MN&&MN.update(\(json))")
        }
    }
}
