import SwiftUI
import ModeNoelCore

typealias Prefs = ModeNoelCore.Settings

// MARK: - Model shared with the app delegate

final class PanelModel: ObservableObject {
    @Published var active = false
    @Published var settings: Prefs { didSet { if settings != oldValue { onChange?(oldValue, settings) } } }
    @Published var loginItem = false
    @Published var countdown = ""
    var onToggle: (() -> Void)?
    var onChange: ((Prefs, Prefs) -> Void)?
    var onLogin: ((Bool) -> Void)?
    var onQuit: (() -> Void)?
    init(settings: Prefs) { self.settings = settings }
}

// MARK: - Palette

private enum C {
    static let navy0 = Color(red: 0.04, green: 0.07, blue: 0.19)
    static let navy1 = Color(red: 0.12, green: 0.16, blue: 0.36)
    static let red = Color(red: 0.79, green: 0.29, blue: 0.25)
    static let red2 = Color(red: 0.62, green: 0.18, blue: 0.18)
    static let gold = Color(red: 0.88, green: 0.72, blue: 0.29)
    static let cream = Color(red: 0.96, green: 0.92, blue: 0.85)
    static let pine = Color(red: 0.18, green: 0.36, blue: 0.31)
    static let card = Color.white.opacity(0.06)
    static let line = Color.white.opacity(0.11)
    static let dim = Color.white.opacity(0.55)
}

private func rounded(_ size: CGFloat, _ w: Font.Weight = .regular) -> Font { .system(size: size, weight: w, design: .rounded) }

// MARK: - Decorations

/// Soft snow falling behind the panel content.
private struct SnowBackdrop: View {
    private let flakes: [(x: Double, y: Double, r: Double, v: Double, p: Double)] = (0..<46).map { i in
        let s = Double(i)
        return (x: (s * 0.6180339).truncatingRemainder(dividingBy: 1), y: (s * 0.3819660 + 0.13).truncatingRemainder(dividingBy: 1),
                r: 0.8 + (s * 7).truncatingRemainder(dividingBy: 5) * 0.45, v: 0.025 + (s * 3).truncatingRemainder(dividingBy: 7) * 0.006, p: s)
    }
    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30)) { tl in
            Canvas { ctx, size in
                let t = tl.date.timeIntervalSinceReferenceDate
                for f in flakes {
                    let y = (f.y + t * f.v).truncatingRemainder(dividingBy: 1.05) * size.height - 6
                    let x = f.x * size.width + sin(t * 0.6 + f.p) * 8
                    ctx.fill(Path(ellipseIn: CGRect(x: x, y: y, width: f.r * 2, height: f.r * 2)), with: .color(.white.opacity(0.18 + f.r * 0.08)))
                }
            }
        }
        .allowsHitTesting(false)
    }
}

/// A string of twinkling bulbs across the top of the panel.
private struct Garland: View {
    let colors: [Color] = [C.red, C.gold, Color(red: 0.62, green: 0.85, blue: 0.63), Color(red: 1, green: 0.85, blue: 0.6), Color(red: 1, green: 0.55, blue: 0.42)]
    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 20)) { tl in
            Canvas { ctx, size in
                let t = tl.date.timeIntervalSinceReferenceDate, segs = 4, sw = size.width / CGFloat(segs), sag: CGFloat = 9
                var wire = Path()
                for k in 0..<segs {
                    wire.move(to: CGPoint(x: CGFloat(k) * sw, y: 2))
                    wire.addQuadCurve(to: CGPoint(x: CGFloat(k + 1) * sw, y: 2), control: CGPoint(x: CGFloat(k) * sw + sw / 2, y: 2 + sag * 2))
                }
                ctx.stroke(wire, with: .color(Color(red: 0.2, green: 0.26, blue: 0.2)), lineWidth: 1)
                var i = 0
                for x in stride(from: CGFloat(10), to: size.width, by: 17) {
                    let s = floor(x / sw), u = (x - s * sw) / sw, y = 2 + sag * 4 * u * (1 - u)
                    let tw = 0.55 + 0.45 * sin(t * 1.6 + Double(i) * 2.1)
                    let c = colors[i % colors.count]
                    ctx.fill(Path(ellipseIn: CGRect(x: x - 7, y: y - 1, width: 14, height: 14)), with: .color(c.opacity(0.22 * tw)))
                    ctx.fill(Path(ellipseIn: CGRect(x: x - 2, y: y + 2, width: 4, height: 6)), with: .color(c.opacity(0.45 + 0.55 * tw)))
                    i += 1
                }
            }
        }
        .frame(height: 22)
        .allowsHitTesting(false)
    }
}

// MARK: - Controls

private struct FestiveSwitch: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button { withAnimation(.spring(response: 0.25, dampingFraction: 0.75)) { configuration.isOn.toggle() } } label: {
            HStack(spacing: 10) {
                configuration.label
                Spacer(minLength: 6)
                ZStack(alignment: configuration.isOn ? .trailing : .leading) {
                    Capsule().fill(configuration.isOn ? AnyShapeStyle(LinearGradient(colors: [C.red, C.red2], startPoint: .top, endPoint: .bottom)) : AnyShapeStyle(Color.white.opacity(0.14)))
                        .overlay(Capsule().stroke(configuration.isOn ? C.gold.opacity(0.7) : C.line, lineWidth: 1))
                        .frame(width: 38, height: 22)
                    Circle().fill(.white).frame(width: 18, height: 18).padding(2)
                        .shadow(color: .black.opacity(0.25), radius: 1.5, y: 1)
                        .overlay(Image(systemName: "snowflake").font(.system(size: 9, weight: .bold)).foregroundStyle(configuration.isOn ? C.red : .gray.opacity(0.6)))
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private struct Chip: View {
    let title: String, symbol: String
    @Binding var isOn: Bool
    var body: some View {
        Button { withAnimation(.easeOut(duration: 0.15)) { isOn.toggle() } } label: {
            VStack(spacing: 4) {
                Image(systemName: symbol).font(.system(size: 14, weight: .semibold)).frame(height: 16)
                Text(title).font(rounded(10.5, .medium)).lineLimit(1).minimumScaleFactor(0.8)
            }
            .foregroundStyle(isOn ? C.cream : C.dim)
            .frame(maxWidth: .infinity).frame(height: 46)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(isOn ? AnyShapeStyle(LinearGradient(colors: [C.red.opacity(0.95), C.red2], startPoint: .topLeading, endPoint: .bottomTrailing)) : AnyShapeStyle(C.card))
            )
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(isOn ? C.gold.opacity(0.65) : C.line, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(title)
    }
}

private struct Card<Content: View>: View {
    let title: String, symbol: String
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: symbol).foregroundStyle(C.gold).font(.system(size: 12, weight: .bold))
                Text(title.uppercased()).font(rounded(11, .bold)).tracking(1.2).foregroundStyle(C.gold)
            }
            content
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(C.card))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(C.line, lineWidth: 1))
    }
}

private struct Row: View {
    let title: String, symbol: String
    @Binding var isOn: Bool
    var body: some View {
        Toggle(isOn: $isOn) {
            HStack(spacing: 9) {
                Image(systemName: symbol).font(.system(size: 13, weight: .semibold)).foregroundStyle(C.gold).frame(width: 18)
                Text(title).font(rounded(13)).foregroundStyle(C.cream)
            }
        }
        .toggleStyle(FestiveSwitch())
    }
}

/// Slider with a snowflake knob and a red→gold track (native sliders look grey on the navy panel).
private struct FestiveSlider: View {
    @Binding var value: Double
    var body: some View {
        GeometryReader { g in
            let w = g.size.width, x = CGFloat(value) * (w - 20) + 10
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.12)).frame(height: 6)
                Capsule().fill(LinearGradient(colors: [C.red2, C.red, C.gold], startPoint: .leading, endPoint: .trailing))
                    .frame(width: max(6, x), height: 6)
                Circle().fill(.white).frame(width: 20, height: 20)
                    .shadow(color: .black.opacity(0.3), radius: 2, y: 1)
                    .overlay(Image(systemName: "snowflake").font(.system(size: 10, weight: .bold)).foregroundStyle(C.red))
                    .offset(x: x - 10)
            }
            .frame(height: 22)
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onChanged { v in
                value = min(1, max(0, Double((v.location.x - 10) / (w - 20))))
            })
        }
        .frame(height: 22)
    }
}

private struct SliderRow: View {
    let low: String, high: String, lowIcon: String, highIcon: String
    @Binding var value: Double
    var body: some View {
        VStack(spacing: 4) {
            HStack(spacing: 8) {
                Image(systemName: lowIcon).font(.system(size: 10)).foregroundStyle(C.dim)
                FestiveSlider(value: $value)
                Image(systemName: highIcon).font(.system(size: 13)).foregroundStyle(C.cream)
            }
            HStack {
                Text(low); Spacer(); Text(high)
            }
            .font(rounded(10)).foregroundStyle(C.dim)
        }
    }
}

// MARK: - Panel

struct PanelView: View {
    @ObservedObject var m: PanelModel

    private func bind(_ k: WritableKeyPath<Prefs, Bool>) -> Binding<Bool> {
        Binding(get: { m.settings[keyPath: k] }, set: { m.settings[keyPath: k] = $0 })
    }

    private let peopleNames = ["None", "Chill", "Busy", "Party"]

    var body: some View {
        ZStack(alignment: .top) {
            LinearGradient(colors: [C.navy1, C.navy0], startPoint: .top, endPoint: .bottom)
            RadialGradient(colors: [C.gold.opacity(0.16), .clear], center: .topTrailing, startRadius: 4, endRadius: 220)
            SnowBackdrop()
            VStack(spacing: 9) {
                Garland().padding(.horizontal, -16).padding(.top, -6)
                header
                bigSwitch
                Card(title: "Snow", symbol: "snowflake") {
                    SliderRow(low: "A few flakes", high: "Blizzard", lowIcon: "snowflake", highIcon: "cloud.snow.fill",
                              value: Binding(get: { m.settings.snow }, set: { m.settings.snow = $0 }))
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 2), spacing: 8) {
                        Chip(title: "Piles on windows", symbol: "macwindow", isOn: bind(\.piles))
                        Chip(title: "Snow on the ground", symbol: "square.bottomhalf.filled", isOn: bind(\.ground))
                    }
                }
                Card(title: "The village", symbol: "house.fill") {
                    HStack(spacing: 6) {
                        ForEach(0..<4) { i in
                            Button { withAnimation(.easeOut(duration: 0.15)) { m.settings.people = i } } label: {
                                Text(peopleNames[i]).font(rounded(11.5, .semibold))
                                    .foregroundStyle(m.settings.people == i ? C.navy0 : C.cream.opacity(0.8))
                                    .frame(maxWidth: .infinity).frame(height: 26)
                                    .background(Capsule().fill(m.settings.people == i ? AnyShapeStyle(C.gold) : AnyShapeStyle(Color.white.opacity(0.07))))
                                    .contentShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                        Chip(title: "Skiers", symbol: "figure.skiing.downhill", isOn: bind(\.skiers))
                        Chip(title: "Shovelers", symbol: "person.fill", isOn: bind(\.workers))
                        Chip(title: "Snowplow", symbol: "truck.box.fill", isOn: bind(\.plow))
                        Chip(title: "Penguins", symbol: "bird.fill", isOn: bind(\.penguins))
                        Chip(title: "Snowmen", symbol: "figure.2.and.child.holdinghands", isOn: bind(\.kids))
                        Chip(title: "Santa", symbol: "gift.fill", isOn: bind(\.sleigh))
                        Chip(title: "Igloos & fire", symbol: "flame.fill", isOn: bind(\.igloos))
                        Chip(title: "Santa hat", symbol: "hat.widebrim.fill", isOn: bind(\.hat))
                        Chip(title: "Lights", symbol: "sparkles", isOn: bind(\.garland))
                    }
                }
                Card(title: "Vibes", symbol: "moon.stars.fill") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                        Chip(title: "Village wallpaper", symbol: "mountain.2.fill", isOn: bind(\.wallpaper))
                        Chip(title: "Red accent", symbol: "paintpalette.fill", isOn: bind(\.accent))
                        Chip(title: "Countdown", symbol: "calendar", isOn: bind(\.countdownInMenuBar))
                        Chip(title: "Full-screen apps", symbol: "arrow.up.left.and.arrow.down.right", isOn: bind(\.fullscreen))
                        Chip(title: "Hide icons", symbol: "eye.slash.fill", isOn: bind(\.hideIcons))
                        Chip(title: "Magic cursor", symbol: "cursorarrow.rays", isOn: bind(\.cursor))
                    }
                }
                Card(title: "Sound", symbol: "bell.fill") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 2), spacing: 8) {
                        Chip(title: "Sleigh bells", symbol: "bell.and.waves.left.and.right.fill", isOn: bind(\.jingle))
                        Chip(title: "Music box", symbol: "music.note", isOn: bind(\.music))
                    }
                    SliderRow(low: "Soft", high: "Loud", lowIcon: "speaker.fill", highIcon: "speaker.wave.3.fill",
                              value: Binding(get: { m.settings.volume }, set: { m.settings.volume = $0 }))
                }
                footer
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 14)
        }
        .frame(width: 372)
        .environment(\.colorScheme, .dark)
    }

    private var header: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(RadialGradient(colors: [C.gold.opacity(0.45), .clear], center: .center, startRadius: 2, endRadius: 26)).frame(width: 44, height: 44)
                Image(systemName: "snowflake").font(.system(size: 26, weight: .semibold)).foregroundStyle(LinearGradient(colors: [.white, C.gold], startPoint: .top, endPoint: .bottom))
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("Christmas Mode").font(rounded(23, .bold)).foregroundStyle(C.cream)
                Text(countdownLine).font(rounded(12.5, .medium)).foregroundStyle(C.gold)
            }
            Spacer()
        }
    }

    private var countdownLine: String {
        if m.countdown == "Xmas!" { return "Merry Christmas! 🎄" }
        let d = m.countdown.replacingOccurrences(of: "d", with: "")
        return d == "1" ? "Christmas is tomorrow!" : "\(d) days until Christmas"
    }

    private var bigSwitch: some View {
        Button { m.onToggle?() } label: {
            HStack(spacing: 10) {
                if m.active {
                    Circle().fill(Color(red: 0.45, green: 0.9, blue: 0.55)).frame(width: 9, height: 9)
                        .shadow(color: .green.opacity(0.8), radius: 4)
                    Text("Christmas magic is on").font(rounded(14.5, .semibold)).foregroundStyle(C.cream)
                    Spacer()
                    Text("Turn off").font(rounded(12, .semibold)).foregroundStyle(C.dim)
                } else {
                    Image(systemName: "sparkles").font(.system(size: 15, weight: .bold))
                    Text("Turn on the Christmas magic").font(rounded(15, .bold))
                    Spacer()
                }
                Text("⌃⌥N").font(.system(size: 10.5, weight: .semibold, design: .monospaced))
                    .padding(.horizontal, 6).padding(.vertical, 3)
                    .background(Capsule().fill(Color.black.opacity(0.22)))
                    .foregroundStyle(C.cream.opacity(0.8))
            }
            .foregroundStyle(C.cream)
            .padding(.horizontal, 16).frame(height: 44)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous).fill(m.active
                    ? AnyShapeStyle(LinearGradient(colors: [C.pine.opacity(0.9), C.pine.opacity(0.55)], startPoint: .leading, endPoint: .trailing))
                    : AnyShapeStyle(LinearGradient(colors: [C.red, C.red2], startPoint: .topLeading, endPoint: .bottomTrailing)))
            )
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(C.gold.opacity(0.75), lineWidth: 1.2))
            .shadow(color: (m.active ? Color.green : C.red).opacity(0.35), radius: 10, y: 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var footer: some View {
        HStack {
            Toggle(isOn: Binding(get: { m.loginItem }, set: { m.onLogin?($0) })) {
                Text("Open at login").font(rounded(12)).foregroundStyle(C.dim)
            }
            .toggleStyle(FestiveSwitch())
            .frame(width: 200)
            Spacer()
            Button { m.onQuit?() } label: {
                Text("Quit").font(rounded(12, .semibold)).foregroundStyle(C.cream.opacity(0.85))
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(Capsule().stroke(C.line, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 4)
    }
}
