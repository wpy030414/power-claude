#!/usr/bin/env swift
// macos-terminal.swift — Sakura Pink profile generator for macOS Terminal.app
// Usage: swift macos-terminal.swift <output-path> <claude-path> [bg-image-path] [--plist <plist-path>]
// Generates a binary plist (.terminal) file importable by Terminal.app
// With --plist: also writes the profile (incl. background bookmark) directly into
// Terminal.app's preferences plist. Must run while Terminal.app is NOT running.

import Foundation
import AppKit

guard CommandLine.arguments.count > 2 else {
    fputs("Usage: swift macos-terminal.swift <output-path> <claude-path> [bg-image-path] [--plist <plist-path>]\n", stderr)
    exit(1)
}

let outputPath = CommandLine.arguments[1]
let claudePath = CommandLine.arguments[2]
let backgroundImagePath = CommandLine.arguments.count > 3 ? CommandLine.arguments[3] : nil

// 解析 --plist 参数
var terminalPlistPath: String? = nil
if let idx = CommandLine.arguments.firstIndex(of: "--plist"), idx + 1 < CommandLine.arguments.count {
    terminalPlistPath = CommandLine.arguments[idx + 1]
}

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
    "name": "powerclaude",
    "ProfileCurrentVersion": 2.07,
    "type": "Window Settings",
    // 启动命令（打开终端默认进入 Claude Code）：
    // 键名大小写双写——实测 Terminal.app 读取 profile 持久化用大写键（CommandString），
    // 解析 .terminal 文件导入用小写键（commandString），双写保证两条链路都生效
    "CommandString": claudePath,
    "RunCommandAsShell": 0,
    "commandString": claudePath,
    "runCommandAsShell": false,
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

// 背景图（可选）：仅在提供路径时写入
// 实测结论（macOS 26）：
//   1. 新版 Terminal.app 只认 BackgroundImageBookmark（security-scoped bookmark），
//      外部直写明文 BackgroundImagePath 不生效（冷启动下实验验证）；
//      但外部自行构造 bookmark（结构同 GUI 生成）同样有效 —— 无需 open 导入流程。
//   2. bookmark 结构：NSKeyedArchiver 归档的 NSData（$objects = [$null, <bookmark data>]）
//   3. 透明度无 GUI 滑块，只能预烘焙：合成「樱花粉底色 + 18% 原图（适应模式居中）」的不透明 PNG。
//      Terminal 只会拉伸铺满窗口，画布宽高比取内容区比例（字符网格 × 字体度量）→ 无形变。
if let backgroundImagePath {
    let srcURL = URL(fileURLWithPath: backgroundImagePath)

    // 合成图输出路径（固定，覆盖式更新不影响 bookmark 的文件引用）
    let blendedURL = srcURL.deletingLastPathComponent()
        .appendingPathComponent("powerclaude-background-blended.png")

    var blended = false
    if let srcImage = NSImage(contentsOf: srcURL),
       let cgImage = srcImage.cgImage(forProposedRect: nil, context: nil, hints: nil) {
        let w = cgImage.width
        let h = cgImage.height
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        // noneSkipLast = RGB 无 alpha，输出不透明 PNG
        let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue)

        // 内容区宽高比 = 字符网格 × 字体度量（与 profile 的 columnCount/rowCount 一致）
        let cols = CGFloat(p["columnCount"] as! Int)
        let rows = CGFloat(p["rowCount"] as! Int)
        let layoutManager = NSLayoutManager()
        let lineHeight = layoutManager.defaultLineHeight(for: font)
        let charWidth = font.maximumAdvancement.width
        let targetAspect = (cols * charWidth) / (rows * lineHeight)

        // 画布：按目标宽高比创建（宽 1920 为基准）
        let canvasW = 1920
        let canvasH = Int((CGFloat(canvasW) / targetAspect).rounded())

        if let ctx = CGContext(data: nil, width: canvasW, height: canvasH,
                               bitsPerComponent: 8, bytesPerRow: 0,
                               space: colorSpace, bitmapInfo: bitmapInfo.rawValue) {
            let canvasRect = CGRect(x: 0, y: 0, width: canvasW, height: canvasH)
            // 底色：樱花粉 #FFF0F5
            ctx.setFillColor(red: 1.0, green: 240.0/255.0, blue: 245.0/255.0, alpha: 1.0)
            ctx.fill(canvasRect)

            // 原图 aspect-fit 居中（保持宽高比，等价于「适应模式」）
            let imgAspect = CGFloat(w) / CGFloat(h)
            let drawW: CGFloat
            let drawH: CGFloat
            if imgAspect > targetAspect {
                drawW = CGFloat(canvasW)
                drawH = drawW / imgAspect
            } else {
                drawH = CGFloat(canvasH)
                drawW = drawH * imgAspect
            }
            let drawRect = CGRect(x: (CGFloat(canvasW) - drawW) / 2,
                                  y: (CGFloat(canvasH) - drawH) / 2,
                                  width: drawW, height: drawH)
            ctx.setAlpha(0.18)
            ctx.draw(cgImage, in: drawRect)
            ctx.setAlpha(1.0)

            if let outImage = ctx.makeImage(),
               let dest = CGImageDestinationCreateWithURL(blendedURL as CFURL, "public.png" as CFString, 1, nil) {
                CGImageDestinationAddImage(dest, outImage, nil)
                CGImageDestinationFinalize(dest)
                blended = true
                let aspectStr = String(format: "%.3f", targetAspect)
                fputs("Created blended PNG (aspect \(aspectStr), \(canvasW)x\(canvasH), fit + 18%)\n", stderr)
            }
        }
    }

    let effectivePath = blended ? blendedURL.path : backgroundImagePath
    p["BackgroundImagePath"] = effectivePath

    // 构造 security-scoped bookmark（结构同 Terminal.app GUI 生成）
    let bgURL = URL(fileURLWithPath: effectivePath)
    do {
        let bookmarkData = try bgURL.bookmarkData(
            options: .withSecurityScope,
            includingResourceValuesForKeys: nil,
            relativeTo: nil
        )
        let archivedBookmark = try NSKeyedArchiver.archivedData(
            withRootObject: bookmarkData as NSData, requiringSecureCoding: false
        )
        p["BackgroundImageBookmark"] = archivedBookmark
        fputs("Created background bookmark (\(bookmarkData.count) bytes raw)\n", stderr)
    } catch {
        fputs("Warning: bookmark creation failed (\(error)); path-only fallback\n", stderr)
    }
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

// MARK: - Write plist

// 1) 裸 profile → .terminal 文件（可手动 open 导入，也作为产物留档）
let data = try! PropertyListSerialization.data(
    fromPropertyList: p, format: .binary, options: 0
)
try! data.write(to: URL(fileURLWithPath: outputPath))

// 2) --plist 模式：直写 Terminal.app 偏好（合并 profile，不动其他配置）
//    前提：Terminal.app 已退出；写入方负责 killall cfprefsd 刷新缓存
if let plistPath = terminalPlistPath {
    let fileURL = URL(fileURLWithPath: plistPath)
    let raw = try! Data(contentsOf: fileURL)
    var domain = try! PropertyListSerialization.propertyList(
        from: raw, format: nil
    ) as! [String: Any]
    var ws = (domain["Window Settings"] as? [String: Any]) ?? [:]
    ws["powerclaude"] = p
    domain["Window Settings"] = ws
    let out = try! PropertyListSerialization.data(
        fromPropertyList: domain, format: .binary, options: 0
    )
    try! out.write(to: fileURL)
    fputs("Wrote profile into \(plistPath)\n", stderr)
}

fputs("OK\n", stderr)
