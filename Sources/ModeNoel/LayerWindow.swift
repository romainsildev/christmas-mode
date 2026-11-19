import AppKit
import WebKit

/// Forwards JS `webkit.messageHandlers.log.postMessage(...)` without retaining the window.
private final class LogProxy: NSObject, WKScriptMessageHandler {
    let tag: String
    init(tag: String) { self.tag = tag }
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        trace("[\(tag)] \(m.body)")
    }
}

/// Borderless, transparent, click-through window covering one screen and hosting a web layer.
final class LayerWindow: NSWindow, WKNavigationDelegate {
    enum Kind { case wallpaper, overlay }

    let kind: Kind
    let screenRef: NSScreen
    let web: WKWebView
    private(set) var ready = false

    init(screen: NSScreen, kind: Kind, webDir: URL, overFullScreen: Bool, aboveIcons: Bool = false) {
        self.kind = kind
        self.screenRef = screen
        let cfg = WKWebViewConfiguration()
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.userContentController.add(LogProxy(tag: kind == .overlay ? "overlay" : "wallpaper"), name: "log")
        cfg.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        web = WKWebView(frame: CGRect(origin: .zero, size: screen.frame.size), configuration: cfg)
        web.setValue(false, forKey: "drawsBackground")
        super.init(contentRect: screen.frame, styleMask: .borderless, backing: .buffered, defer: false)
        setFrame(screen.frame, display: false)
        isOpaque = false
        backgroundColor = .clear
        hasShadow = false
        ignoresMouseEvents = true
        isReleasedWhenClosed = false
        animationBehavior = .none
        switch kind {
        case .overlay:
            level = .statusBar
            var b: NSWindow.CollectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
            if overFullScreen { b.insert(.fullScreenAuxiliary) }
            collectionBehavior = b
        case .wallpaper:
            level = LayerWindow.wallpaperLevel(aboveIcons: aboveIcons)
            collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        }
        contentView = web
        web.navigationDelegate = self
        let page = webDir.appendingPathComponent(kind == .overlay ? "overlay.html" : "wallpaper.html")
        web.loadFileURL(page, allowingReadAccessTo: webDir.deletingLastPathComponent())
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        trace("web process terminated (\(kind == .overlay ? "overlay" : "wallpaper"))")
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        trace("page loaded (\(kind == .overlay ? "overlay" : "wallpaper"))")
    }

    /// Just above the real wallpaper, or above the desktop icons too (clean screen recordings).
    static func wallpaperLevel(aboveIcons: Bool) -> NSWindow.Level {
        NSWindow.Level(rawValue: Int(CGWindowLevelForKey(aboveIcons ? .desktopIconWindow : .desktopWindow)) + 1)
    }

    func setOverFullScreen(_ on: Bool) {
        if on { collectionBehavior.insert(.fullScreenAuxiliary) } else { collectionBehavior.remove(.fullScreenAuxiliary) }
    }

    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }

    func send(_ js: String) {
        web.evaluateJavaScript(js, completionHandler: nil)
    }
}
