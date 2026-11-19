import XCTest
@testable import ModeNoelCore

final class MemStore: DefaultsStore {
    var d: [String: Any] = [:]
    func get(_ k: String) -> Any? { d[k] }
    func set(_ k: String, _ v: Any) { d[k] = v }
    func remove(_ k: String) { d[k] = nil }
}

final class ThemeStateTests: XCTestCase {
    var url: URL!
    override func setUp() { url = FileManager.default.temporaryDirectory.appendingPathComponent("mn-\(UUID()).json") }

    func testApplySetsRedAccent() {
        let s = MemStore()
        ThemeState(store: s, stateURL: url).apply()
        XCTAssertEqual(s.get("AppleAccentColor") as? Int, 0)
        XCTAssertEqual(s.get("AppleHighlightColor") as? String, "1.000000 0.733333 0.721569 Red")
    }

    func testRestoreRemovesKeysThatWereAbsent() {
        let s = MemStore()
        let t = ThemeState(store: s, stateURL: url)
        t.apply(); t.restore()
        XCTAssertNil(s.get("AppleAccentColor"))
        XCTAssertNil(s.get("AppleHighlightColor"))
    }

    func testRestoreBringsBackExistingValues() {
        let s = MemStore(); s.set("AppleAccentColor", 4); s.set("AppleHighlightColor", "x Blue")
        let t = ThemeState(store: s, stateURL: url)
        t.apply(); t.apply(); t.restore()
        XCTAssertEqual(s.get("AppleAccentColor") as? Int, 4)
        XCTAssertEqual(s.get("AppleHighlightColor") as? String, "x Blue")
    }

    func testRestoresAfterCrash() {
        let s = MemStore(); s.set("AppleAccentColor", 2)
        ThemeState(store: s, stateURL: url).apply()        // app "crashes" here: no restore
        XCTAssertTrue(ThemeState(store: s, stateURL: url).recoverIfNeeded())
        XCTAssertEqual(s.get("AppleAccentColor") as? Int, 2)
        XCTAssertNil(s.get("AppleHighlightColor"))
        XCTAssertFalse(ThemeState(store: s, stateURL: url).recoverIfNeeded())
    }
}
