import XCTest
import CoreGraphics
@testable import ModeNoelCore

final class ScreenShapeTests: XCTestCase {
    let main = ScreenShape(frame: CGRect(x: 0, y: 0, width: 1512, height: 982), scale: 2)

    func testSameScreensDoNotNeedRebuild() {
        // macOS fires didChangeScreenParameters in bursts during full-screen/Space transitions with nothing changed
        XCTAssertFalse(needsRebuild(built: [main], now: [main]))
    }

    func testAddedScreenNeedsRebuild() {
        let ext = ScreenShape(frame: CGRect(x: 1512, y: 0, width: 1920, height: 1080), scale: 1)
        XCTAssertTrue(needsRebuild(built: [main], now: [main, ext]))
    }

    func testResolutionChangeNeedsRebuild() {
        XCTAssertTrue(needsRebuild(built: [main], now: [ScreenShape(frame: CGRect(x: 0, y: 0, width: 1728, height: 1117), scale: 2)]))
    }
}
