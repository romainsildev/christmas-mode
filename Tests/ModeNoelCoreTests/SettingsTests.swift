import XCTest
@testable import ModeNoelCore

final class SettingsTests: XCTestCase {
    func fresh() -> UserDefaults { let d = UserDefaults(suiteName: "mn-\(UUID())")!; return d }

    func testDefaultsAreFestiveButQuiet() {
        let s = Settings.load(fresh())
        XCTAssertEqual(s.snow, 0.5)
        XCTAssertEqual(s.people, 2)
        XCTAssertTrue(s.wallpaper && s.garland && s.piles && s.accent && s.jingle)
        XCTAssertFalse(s.music)
        XCTAssertFalse(s.fullscreen)
        XCTAssertFalse(s.hideIcons)   // recording-friendly option, off by default
    }

    func testMigratesOldMenuKeys() {
        let d = fresh()
        d.set(0, forKey: "density"); d.set(false, forKey: "wallpaper"); d.set(true, forKey: "music"); d.set(true, forKey: "fullscreen")
        let s = Settings.load(d)
        XCTAssertEqual(s.snow, 0.15)
        XCTAssertFalse(s.wallpaper)
        XCTAssertTrue(s.music)
        XCTAssertTrue(s.fullscreen)
    }

    func testSaveThenLoadRoundTrips() {
        let d = fresh()
        var s = Settings.load(d)
        s.people = 3; s.skiers = false; s.volume = 0.2; s.countdownInMenuBar = false
        s.save(d)
        XCTAssertEqual(Settings.load(d), s)
    }

    func testJavaScriptOptionsCarryEveryLayerSwitch() throws {
        var s = Settings.load(fresh())
        s.sleigh = false
        let obj = try JSONSerialization.jsonObject(with: Data(s.jsOptions.utf8)) as! [String: Any]
        XCTAssertEqual(obj["sleigh"] as? Bool, false)
        for k in ["snow", "people", "skiers", "workers", "plow", "penguins", "kids", "igloos", "hat", "garland", "piles", "ground", "cursor", "music", "volume"] {
            XCTAssertNotNil(obj[k], k)
        }
    }

    func testSettingsSavedByAnOlderVersionStillLoad() {
        let d = fresh()
        d.set(Data(#"{"snow":0.9,"people":3,"skiers":false}"#.utf8), forKey: "settings")   // no newer keys
        let s = Settings.load(d)
        XCTAssertEqual(s.people, 3)
        XCTAssertFalse(s.skiers)
        XCTAssertFalse(s.hideIcons)
    }
}
