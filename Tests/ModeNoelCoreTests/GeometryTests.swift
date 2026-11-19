import XCTest
import CoreGraphics
@testable import ModeNoelCore

final class GeometryTests: XCTestCase {
    func raw(_ pid: Int32, _ layer: Int, _ x: Double, _ y: Double, _ w: Double, _ h: Double, alpha: Double = 1, id: Int = 1) -> [String: Any] {
        ["kCGWindowOwnerPID": pid, "kCGWindowLayer": layer, "kCGWindowAlpha": alpha, "kCGWindowNumber": id,
         "kCGWindowBounds": ["X": x, "Y": y, "Width": w, "Height": h]]
    }

    func testFilter() {
        let list = [
            raw(10, 0, 100, 100, 400, 300, id: 1),           // keep (front)
            raw(10, 24, 0, 0, 1512, 33, id: 2),              // menu bar layer → drop
            raw(10, 0, 50, 50, 300, 200, alpha: 0, id: 3),   // invisible → drop
            raw(99, 0, 60, 60, 300, 200, id: 4),             // own app → drop
            raw(10, 0, 10, 10, 40, 300, id: 5),              // too narrow → drop
            raw(10, 0, 5000, 100, 300, 200, id: 6),          // off-screen → drop
            raw(11, 0, 200, 200, 500, 400, id: 7),           // keep (back)
        ]
        let out = localWindows(raw: list, screenTopLeft: .zero, screenSize: CGSize(width: 1512, height: 982), ownPID: 99)
        XCTAssertEqual(out.map(\.id), [1, 7])
        XCTAssertEqual(out.map(\.z), [0, 1])
    }

    func testLocalCoords() {
        let out = localWindows(raw: [raw(10, 0, 1612, 150, 400, 300)], screenTopLeft: CGPoint(x: 1512, y: 100),
                               screenSize: CGSize(width: 1920, height: 1080), ownPID: 99)
        XCTAssertEqual(out.first?.x, 100)
        XCTAssertEqual(out.first?.y, 50)
        XCTAssertEqual(out.first?.w, 400)
    }

    func cal() -> Calendar { var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Paris")!; return c }
    func day(_ y: Int, _ m: Int, _ d: Int) -> Date { cal().date(from: DateComponents(year: y, month: m, day: d, hour: 18))! }

    func testCountdown() {
        XCTAssertEqual(countdownText(now: day(2026, 11, 18), calendar: cal()), "37d")
        XCTAssertEqual(countdownText(now: day(2026, 12, 25), calendar: cal()), "Xmas!")
        XCTAssertEqual(countdownText(now: day(2026, 12, 26), calendar: cal()), "364d")
    }
}

final class NotchDockTests: XCTestCase {
    func testNotchIsTheGapBetweenTheTwoMenuBarAreas() {
        XCTAssertEqual(notchRect(leftAreaMaxX: 662, rightAreaMinX: 850, topInset: 32), [662, 0, 188, 32])
    }

    func testNoNotchWithoutTopInset() {
        XCTAssertNil(notchRect(leftAreaMaxX: 0, rightAreaMinX: 0, topInset: 0))
        XCTAssertNil(notchRect(leftAreaMaxX: 700, rightAreaMinX: 700, topInset: 32))
    }

    func testDockIsFoundAmongWindowServerEntries() {
        let dockBar: [String: Any] = ["kCGWindowOwnerName": "Dock", "kCGWindowLayer": 20,
                                      "kCGWindowBounds": ["X": 400.0, "Y": 910.0, "Width": 700.0, "Height": 72.0]]
        let fullScreenDockLayer: [String: Any] = ["kCGWindowOwnerName": "Dock", "kCGWindowLayer": 20,
                                                  "kCGWindowBounds": ["X": 0.0, "Y": 0.0, "Width": 1512.0, "Height": 982.0]]
        let other: [String: Any] = ["kCGWindowOwnerName": "Safari", "kCGWindowLayer": 0,
                                    "kCGWindowBounds": ["X": 0.0, "Y": 900.0, "Width": 700.0, "Height": 72.0]]
        let r = dockRect(raw: [other, fullScreenDockLayer, dockBar], screenTopLeft: .zero, screenSize: CGSize(width: 1512, height: 982))
        XCTAssertEqual(r, [400, 910, 700, 72])
    }

    func testHiddenDockMeansNoDock() {
        XCTAssertNil(dockRect(raw: [], screenTopLeft: .zero, screenSize: CGSize(width: 1512, height: 982)))
    }
}
