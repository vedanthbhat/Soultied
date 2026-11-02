// swift-tools-version:5.9
import PackageDescription

// Everything in the iPhone app that isn't screens: the pixel room and characters, the letters and their
// questions, and the shapes of what's kept in the database. Plain Swift, so it also builds (and is
// checked against the website's renderer) on Linux.
let package = Package(
    name: "SoultiedCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "SoultiedCore", targets: ["SoultiedCore"]),
    ],
    targets: [
        .target(name: "SoultiedCore", resources: [.process("Resources")]),
        // draws scenes to raw files, to compare with the website's drawings pixel for pixel
        .executableTarget(name: "render-check", dependencies: ["SoultiedCore"]),
        .testTarget(name: "SoultiedCoreTests", dependencies: ["SoultiedCore"]),
    ]
)
