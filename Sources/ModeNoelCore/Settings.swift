import Foundation

/// Every user choice of the Christmas Mode panel. Persisted as JSON under "settings".
public struct Settings: Codable, Equatable {
    // Snow
    public var snow: Double = 0.5            // 0 = a few flakes … 1 = blizzard
    public var piles = true                  // snow piles on windows
    public var ground = true                 // snow along the bottom of the screen
    public var cursor = true                 // the cursor pushes flakes around
    // Village
    public var people: Int = 2               // 0 nobody · 1 chill · 2 busy · 3 party
    public var skiers = true, workers = true, plow = true, penguins = true, kids = true, sleigh = true
    public var igloos = true, hat = true, garland = true
    // Vibes
    public var wallpaper = true, accent = true, fullscreen = false, countdownInMenuBar = true
    public var hideIcons = false             // wallpaper above desktop icons (clean screen recordings)
    // Sound
    public var music = false, jingle = true
    public var volume: Double = 0.6

    public init() {}

    // Decode older saved settings that lack newer keys (missing keys keep their defaults).
    public init(from decoder: Decoder) throws {
        self.init()
        let c = try decoder.container(keyedBy: CodingKeys.self)
        func get<T: Decodable>(_ k: CodingKeys, _ v: inout T) { if let x = try? c.decodeIfPresent(T.self, forKey: k) { v = x } }
        get(.snow, &snow); get(.piles, &piles); get(.ground, &ground); get(.cursor, &cursor)
        get(.people, &people); get(.skiers, &skiers); get(.workers, &workers); get(.plow, &plow); get(.penguins, &penguins)
        get(.kids, &kids); get(.sleigh, &sleigh); get(.igloos, &igloos); get(.hat, &hat); get(.garland, &garland)
        get(.wallpaper, &wallpaper); get(.accent, &accent); get(.fullscreen, &fullscreen); get(.countdownInMenuBar, &countdownInMenuBar)
        get(.hideIcons, &hideIcons); get(.music, &music); get(.jingle, &jingle); get(.volume, &volume)
    }

    public static func load(_ d: UserDefaults) -> Settings {
        if let data = d.data(forKey: "settings"), let s = try? JSONDecoder().decode(Settings.self, from: data) { return s }
        var s = Settings()
        // Keys from the first version's plain menu
        if let density = d.object(forKey: "density") as? Int { s.snow = [0.15, 0.5, 0.9][max(0, min(2, density))] }
        if let w = d.object(forKey: "wallpaper") as? Bool { s.wallpaper = w }
        if let m = d.object(forKey: "music") as? Bool { s.music = m }
        if let f = d.object(forKey: "fullscreen") as? Bool { s.fullscreen = f }
        return s
    }

    public func save(_ d: UserDefaults) {
        if let data = try? JSONEncoder().encode(self) { d.set(data, forKey: "settings") }
    }

    /// Options object handed to the web layers (`MN.setOpts(...)`).
    public var jsOptions: String {
        guard let data = try? JSONEncoder().encode(self), let s = String(data: data, encoding: .utf8) else { return "{}" }
        return s
    }
}
