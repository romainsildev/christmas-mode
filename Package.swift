// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "ModeNoel",
    platforms: [.macOS(.v14)],
    targets: [
        .target(name: "ModeNoelCore"),
        .executableTarget(name: "ModeNoel", dependencies: ["ModeNoelCore"]),
        .testTarget(name: "ModeNoelCoreTests", dependencies: ["ModeNoelCore"]),
    ],
    swiftLanguageModes: [.v5]
)
