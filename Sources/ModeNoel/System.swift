import AppKit
import Carbon.HIToolbox
import ModeNoelCore

/// Global (all apps) preferences via CFPreferences.
final class GlobalPrefs: DefaultsStore {
    private let app = kCFPreferencesAnyApplication
    func get(_ key: String) -> Any? { CFPreferencesCopyValue(key as CFString, app, kCFPreferencesCurrentUser, kCFPreferencesAnyHost) }
    func set(_ key: String, _ value: Any) { CFPreferencesSetValue(key as CFString, value as CFPropertyList, app, kCFPreferencesCurrentUser, kCFPreferencesAnyHost); sync() }
    func remove(_ key: String) { CFPreferencesSetValue(key as CFString, nil, app, kCFPreferencesCurrentUser, kCFPreferencesAnyHost); sync() }
    private func sync() {
        CFPreferencesSynchronize(app, kCFPreferencesCurrentUser, kCFPreferencesAnyHost)
        let c = DistributedNotificationCenter.default()
        c.postNotificationName(NSNotification.Name("AppleColorPreferencesChangedNotification"), object: nil, userInfo: nil, deliverImmediately: true)
        c.postNotificationName(NSNotification.Name("AppleAquaColorVariantChanged"), object: nil, userInfo: nil, deliverImmediately: true)
    }
}

/// ⌃⌥N anywhere toggles the mode (Carbon hot key: no permission needed).
final class HotKey {
    private var ref: EventHotKeyRef?
    private static var action: (() -> Void)?

    init(action: @escaping () -> Void) {
        HotKey.action = action
        var spec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(GetApplicationEventTarget(), { _, _, _ in
            DispatchQueue.main.async { HotKey.action?() }
            return noErr
        }, 1, &spec, nil, nil)
        let id = EventHotKeyID(signature: OSType(0x4D4E4F45), id: 1) // 'MNOE'
        RegisterEventHotKey(UInt32(kVK_ANSI_N), UInt32(controlKey | optionKey), id, GetApplicationEventTarget(), 0, &ref)
    }
}
