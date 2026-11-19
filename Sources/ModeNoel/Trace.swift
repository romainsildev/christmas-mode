import Foundation

/// Diagnostic log: ~/Library/Logs/ModeNoel.log
func trace(_ msg: String) {
    let url = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Logs/ModeNoel.log")
    let f = DateFormatter(); f.dateFormat = "HH:mm:ss.SSS"
    let line = "\(f.string(from: Date())) \(msg)\n"
    if let h = try? FileHandle(forWritingTo: url) { h.seekToEndOfFile(); h.write(line.data(using: .utf8)!); try? h.close() }
    else { try? line.write(to: url, atomically: true, encoding: .utf8) }
}
