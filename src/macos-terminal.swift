#!/usr/bin/env swift
// macos-terminal.swift — Sakura Pink profile generator for macOS Terminal.app
// Usage: swift macos-terminal.swift <output-path> <claude-path>
// Generates a binary plist (.terminal) file importable by Terminal.app

import Foundation
import AppKit

guard CommandLine.arguments.count > 2 else {
    fputs("Usage: swift macos-terminal.swift <output-path> <claude-path>\n", stderr)
    exit(1)
}

let outputPath = CommandLine.arguments[1]
let claudePath = CommandLine.arguments[2]

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
let fg     = hex("#8B2252")
let cursor = hex("#C07080")
let sel    = hex("#F0C8D8")

let ansi: [RGB] = [
    hex("#5A3A4A"), hex("#C07080"), hex("#6B8E6B"), hex("#B8865A"),
    hex("#6A7FA8"), hex("#A8658A"), hex("#5A8A8A"), hex("#8B5A6A"),
    hex("#8B7A80"), hex("#C07080"), hex("#80A080"), hex("#D4A060"),
    hex("#8090C0"), hex("#C080A0"), hex("#70A0A0"), hex("#D4A8B8"),
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
