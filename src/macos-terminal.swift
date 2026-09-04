#!/usr/bin/env swift
// macos-terminal.swift — Sakura Pink profile generator for macOS Terminal.app
// Usage: swift macos-terminal.swift <output-path> <claude-path> [background-image-path]
// Generates a binary plist (.terminal) file importable by Terminal.app
// background-image-path is optional; when omitted, no background image keys are written

import Foundation
import AppKit

guard CommandLine.arguments.count > 2 else {
    fputs("Usage: swift macos-terminal.swift <output-path> <claude-path> [background-image-path]\n", stderr)
    exit(1)
}

let outputPath = CommandLine.arguments[1]
let claudePath = CommandLine.arguments[2]
let backgroundImagePath = CommandLine.arguments.count > 3 ? CommandLine.arguments[3] : nil

// MARK: - Color palette (matches theme.ts SAKURA_PINK_SCHEME)

struct RGB { let r, g, b: Double }

func hex(_ s: String) -> RGB {
    let h = s.hasPrefix("#") ? String(s.dropFirst()) : s
    return RGB(
        r: Double(Int(h.prefix(2), radix: 16)!) / 255.0,
        g: Double(Int(h.dropFirst(2).prefix(2), radix: 16)!) / 255.0,
        b: Double(Int(h.dropFirst(4).prefix(2), radix: 16)!) / 255.0
    )
}

let bg     = hex("#FFF0F5")
let fg     = hex("#A63A6E")
let cursor = hex("#E86A92")
let sel    = hex("#FFB8CC")

let ansi: [RGB] = [
    hex("#4A3640"), hex("#FF6B8A"), hex("#5FB77E"), hex("#F0A65E"),
    hex("#6FA9E6"), hex("#CC5BA8"), hex("#4FB0C0"), hex("#995E78"),
    hex("#8A7280"), hex("#FF85A0"), hex("#7CCB98"), hex("#F8BE7A"),
    hex("#8DBEF0"), hex("#DE74BE"), hex("#66C8D6"), hex("#E4B4C8"),
]

// MARK: - Font (system monospace 13pt)

let font = NSFont.monospacedSystemFont(ofSize: 13, weight: .regular)

// MARK: - NSKeyedArchiver color encoder
// Terminal.app stores colors as NSKeyedArchiver binary plist blobs (NSData in parent plist)

func colorData(_ c: RGB) -> Data {
    let color = NSColor(
        calibratedRed: CGFloat(c.r), green: CGFloat(c.g),
        blue: CGFloat(c.b), alpha: 1.0
    )
    return try! NSKeyedArchiver.archivedData(
        withRootObject: color, requiringSecureCoding: false
    )
}

// MARK: - Build profile dictionary

var p: [String: Any] = [
    "name": "PowerClaude",
    "ProfileCurrentVersion": 2.07,
    "type": "Window Settings",
    "runCommandAsShell": false,
    "commandString": claudePath,
    "shellExitAction": 1,
    "Font": try! NSKeyedArchiver.archivedData(
        withRootObject: font, requiringSecureCoding: false
    ),
    "BackgroundColor": colorData(bg),
    "TextColor": colorData(fg),
    "TextBoldColor": colorData(fg),
    "CursorColor": colorData(cursor),
    "CursorTextColor": colorData(bg),
    "SelectionColor": colorData(sel),
    "TextInverseColor": colorData(sel),
    "UseBrightBold": true,
    "ShowRepresentedURLInTitle": true,
    "ShowActiveProcessInTitle": true,
    "columnCount": 120,
    "rowCount": 36,
    "BackgroundAlphaInactive": 0.92,
]

// 背景图（可选）：仅在提供路径时写入，避免破坏无背景配置
if let backgroundImagePath {
    p["BackgroundImageFilename"] = backgroundImagePath
    // 不透明度：这里有意不写 BackgroundImageOcclusion（透明度键名/取值存疑）
    // 避免武断破坏配置；要渐变效果可后续在真机验证后补充
}

// ANSI 16 colors
let keys = [
    "ANSIBlackColor", "ANSIRedColor", "ANSIGreenColor", "ANSIYellowColor",
    "ANSIBlueColor", "ANSIMagentaColor", "ANSICyanColor", "ANSIWhiteColor",
    "ANSIBrightBlackColor", "ANSIBrightRedColor", "ANSIBrightGreenColor", "ANSIBrightYellowColor",
    "ANSIBrightBlueColor", "ANSIBrightMagentaColor", "ANSIBrightCyanColor", "ANSIBrightWhiteColor",
]
for (i, c) in ansi.enumerated() {
    p[keys[i]] = colorData(c)
}

// MARK: - Write binary plist

let data = try! PropertyListSerialization.data(
    fromPropertyList: p, format: .binary, options: 0
)
try! data.write(to: URL(fileURLWithPath: outputPath))
fputs("OK\n", stderr)
