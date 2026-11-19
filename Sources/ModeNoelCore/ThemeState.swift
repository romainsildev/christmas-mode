import Foundation

/// Where the global macOS preferences live (real impl: CFPreferences global domain).
public protocol DefaultsStore: AnyObject {
    func get(_ key: String) -> Any?
    func set(_ key: String, _ value: Any)
    func remove(_ key: String)
}

/// Applies the Christmas accent colour and restores the user's exact previous values,
/// even after a crash (originals are persisted to `stateURL` before anything changes).
public final class ThemeState {
    static let values: [String: Any] = [
        "AppleAccentColor": 0,
        "AppleHighlightColor": "1.000000 0.733333 0.721569 Red",
    ]

    private struct Saved: Codable {
        var active: Bool
        var accent: Int?
        var highlight: String?
    }

    private let store: DefaultsStore
    private let url: URL

    public init(store: DefaultsStore, stateURL: URL) {
        self.store = store
        self.url = stateURL
    }

    private func load() -> Saved? {
        guard let d = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(Saved.self, from: d)
    }

    private func save(_ s: Saved) {
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? JSONEncoder().encode(s).write(to: url, options: .atomic)
    }

    public func apply() {
        if load()?.active != true {
            save(Saved(active: true,
                       accent: (store.get("AppleAccentColor") as? NSNumber)?.intValue,
                       highlight: store.get("AppleHighlightColor") as? String))
        }
        for (k, v) in Self.values { store.set(k, v) }
    }

    public func restore() {
        guard let s = load(), s.active else { return }
        if let a = s.accent { store.set("AppleAccentColor", a) } else { store.remove("AppleAccentColor") }
        if let h = s.highlight { store.set("AppleHighlightColor", h) } else { store.remove("AppleHighlightColor") }
        save(Saved(active: false, accent: nil, highlight: nil))
    }

    /// Call at launch: if a previous run left the theme applied, put the user's colours back.
    @discardableResult public func recoverIfNeeded() -> Bool {
        guard load()?.active == true else { return false }
        restore()
        return true
    }
}
