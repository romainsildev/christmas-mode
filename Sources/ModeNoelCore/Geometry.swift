import CoreGraphics
import Foundation

/// A real app window, in screen-local points (top-left origin). z 0 = frontmost.
public struct WinInfo: Codable, Equatable {
    public var id: Int
    public var x: Double, y: Double, w: Double, h: Double
    public var z: Int
}

private func num(_ v: Any?) -> Double? {
    if let d = v as? Double { return d }
    if let i = v as? Int { return Double(i) }
    if let n = v as? NSNumber { return n.doubleValue }
    return nil
}

/// Turns `CGWindowListCopyWindowInfo` output (front-to-back) into snow surfaces for one screen.
/// `screenTopLeft` is the screen's top-left corner in global CG coordinates (y down).
public func localWindows(raw: [[String: Any]], screenTopLeft: CGPoint, screenSize: CGSize, ownPID: Int32) -> [WinInfo] {
    var out: [WinInfo] = []
    for w in raw {
        guard Int(num(w["kCGWindowLayer"]) ?? -1) == 0,
              (num(w["kCGWindowAlpha"]) ?? 1) > 0.05,
              Int32(num(w["kCGWindowOwnerPID"]) ?? -1) != ownPID,
              let b = w["kCGWindowBounds"] as? [String: Any],
              let gx = num(b["X"]), let gy = num(b["Y"]), let bw = num(b["Width"]), let bh = num(b["Height"]),
              bw >= 60, bh >= 60 else { continue }
        let x = gx - screenTopLeft.x, y = gy - screenTopLeft.y
        guard x < screenSize.width, x + bw > 0, y < screenSize.height, y + bh > 0 else { continue }
        out.append(WinInfo(id: Int(num(w["kCGWindowNumber"]) ?? 0), x: x, y: y, w: bw, h: bh, z: out.count))
    }
    return out
}

/// "37d" before Christmas, "Xmas!" on the day, next year's count after.
public func countdownText(now: Date, calendar: Calendar) -> String {
    let today = calendar.startOfDay(for: now)
    let year = calendar.component(.year, from: today)
    var xmas = calendar.date(from: DateComponents(year: year, month: 12, day: 25))!
    if today > xmas { xmas = calendar.date(from: DateComponents(year: year + 1, month: 12, day: 25))! }
    let days = calendar.dateComponents([.day], from: today, to: xmas).day ?? 0
    return days == 0 ? "Xmas!" : "\(days)d"
}

/// What matters about a screen for our layer windows (not its visible frame, which moves with the menu bar / Dock).
public struct ScreenShape: Equatable {
    public var frame: CGRect
    public var scale: CGFloat
    public init(frame: CGRect, scale: CGFloat) { self.frame = frame; self.scale = scale }
}

public func needsRebuild(built: [ScreenShape], now: [ScreenShape]) -> Bool { built != now }

/// The MacBook notch in screen-local points [x, y, w, h], or nil without a notch.
public func notchRect(leftAreaMaxX: Double, rightAreaMinX: Double, topInset: Double) -> [Double]? {
    guard topInset > 0, rightAreaMinX - leftAreaMaxX > 20 else { return nil }
    return [leftAreaMaxX, 0, rightAreaMinX - leftAreaMaxX, topInset]
}

/// The visible Dock bar in screen-local points [x, y, w, h], or nil when it is hidden / not on this screen.
public func dockRect(raw: [[String: Any]], screenTopLeft: CGPoint, screenSize: CGSize) -> [Double]? {
    for w in raw {
        guard (w["kCGWindowOwnerName"] as? String) == "Dock", Int(num(w["kCGWindowLayer"]) ?? -1) == 20,
              let b = w["kCGWindowBounds"] as? [String: Any],
              let gx = num(b["X"]), let gy = num(b["Y"]), let bw = num(b["Width"]), let bh = num(b["Height"]) else { continue }
        // the bar itself: much wider than tall, not a full-screen helper layer, inside this screen
        guard bh < 220, bw > bh * 2 else { continue }
        let x = gx - screenTopLeft.x, y = gy - screenTopLeft.y
        guard x >= -1, y >= 0, x + bw <= screenSize.width + 1, y + bh <= screenSize.height + 1 else { continue }
        return [x, y, bw, bh]
    }
    return nil
}
